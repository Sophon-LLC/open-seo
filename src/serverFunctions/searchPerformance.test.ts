import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  GscSearchAnalyticsRequest,
  GscSearchAnalyticsRow,
} from "@/server/lib/gscClient";
import {
  exportSearchPerformanceTable,
  getSearchPerformanceReport,
  getSearchPerformanceTable,
} from "./searchPerformance";
import { GscApiError } from "@/server/lib/gscErrors";

const mocks = vi.hoisted(() => ({
  query:
    vi.fn<
      (
        site: string,
        request: GscSearchAnalyticsRequest,
      ) => Promise<GscSearchAnalyticsRow[]>
    >(),
  storedConnections: [
    {
      siteUrl: "sc-domain:example.com",
      connectedByUserId: "user-a",
      gscAccountId: "account-a",
      connectedAccountEmail: null,
    },
  ],
}));

// RPC dispatch/auth context, storage and Google are the only substituted
// boundaries. The actual handler, schema, service, repository, date resolver
// and aggregation are exercised. This is not an auth-middleware test.
vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => {
    let parse: ((value: unknown) => unknown) | undefined;
    const builder = {
      middleware: () => builder,
      validator: (schema: { parse: (value: unknown) => unknown }) => {
        parse = (value) => schema.parse(value);
        return builder;
      },
      handler:
        (
          handler: (input: {
            data: unknown;
            context: { projectId: string };
          }) => unknown,
        ) =>
        ({ data }: { data: unknown }) => {
          if (!parse) throw new Error("A request validator is required");
          return handler({
            data: parse(data),
            context: { projectId: "authorized-project" },
          });
        },
    };
    return builder;
  },
}));
vi.mock("@/serverFunctions/middleware", () => ({ requireProjectContext: [] }));
vi.mock("cloudflare:workers", () => ({ env: {} }));
vi.mock("@/db", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({ limit: async () => mocks.storedConnections }),
      }),
    }),
  },
}));
vi.mock("@/server/lib/gscClient", () => ({
  createGscClient: () => ({ querySearchAnalytics: mocks.query }),
}));

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-14T12:00:00Z"));
  mocks.query.mockReset();
});

describe("bounded Search Performance export", () => {
  it.each([0, 999, 1000, 1001])(
    "discloses the row ceiling for %i available rows without unbounded pagination",
    async (availableRows) => {
      const available = Array.from({ length: availableRows }, (_, i) => ({
        keys: [`example-${i}`],
        clicks: 0,
        impressions: 10,
        ctr: 0,
        position: 7,
      }));
      mocks.query.mockImplementation(async (_site, request) =>
        available.slice(
          request.startRow ?? 0,
          (request.startRow ?? 0) + (request.rowLimit ?? 1000),
        ),
      );
      const result = await exportSearchPerformanceTable({
        data: {
          projectId: "authorized-project",
          dimension: "query",
          dateRange: "last_28_days",
        },
      });
      expect(result).toMatchObject({
        range: { startDate: "2026-08-15", endDate: "2026-09-11" },
        coverage: {
          rowLimit: 1000,
          returnedRows: Math.min(availableRows, 1000),
          mayBeTruncated: availableRows >= 1000,
        },
      });
      expect(result.rows).toHaveLength(Math.min(availableRows, 1000));
      expect(mocks.query).toHaveBeenCalledTimes(1);
      expect(mocks.query.mock.calls[0][1].dataState).toBe("final");
    },
  );
});
afterEach(() => vi.useRealTimers());

describe("Search Performance report contract", () => {
  it("excludes fresh nonfinal rows from totals and comparisons", async () => {
    mocks.query.mockImplementation(async (_site, request) => {
      if (request.dimensions?.[0] !== "date") return [];
      return [
        {
          keys: [request.startDate],
          clicks: request.dataState === "final" ? 2 : 99,
          impressions: 100,
          ctr: 0.02,
          position: 7,
        },
      ];
    });
    const result = await getSearchPerformanceReport({
      data: { projectId: "authorized-project", dateRange: "last_28_days" },
    });
    expect(result).toMatchObject({
      connected: true,
      range: {
        startDate: "2026-08-15",
        endDate: "2026-09-11",
        prevStartDate: "2026-07-18",
        prevEndDate: "2026-08-14",
      },
      totals: { clicks: 2 },
      prevTotals: { clicks: 2 },
    });
    for (const [site, request] of mocks.query.mock.calls) {
      expect(site).toBe("sc-domain:example.com");
      expect(request.dataState).toBe("final");
    }
  });

  it("keeps paginated rows on the same finalized basis as the overview", async () => {
    mocks.query.mockImplementation(async (_site, request) => [
      {
        keys: ["example query"],
        clicks: request.dataState === "final" ? 0 : 99,
        impressions: 10,
        ctr: 0,
        position: 5,
      },
    ]);
    const result = await getSearchPerformanceTable({
      data: {
        projectId: "authorized-project",
        dateRange: "last_28_days",
        dimension: "query",
        page: 1,
        pageSize: 25,
      },
    });
    expect(result).toMatchObject({
      connected: true,
      rows: [{ clicks: 0, ctr: 0, impressions: 10 }],
    });
  });
  it("propagates a provider outage instead of manufacturing zero totals", async () => {
    mocks.query.mockRejectedValue(new GscApiError(503, "Upstream unavailable"));
    await expect(
      getSearchPerformanceReport({
        data: { projectId: "authorized-project", dateRange: "last_28_days" },
      }),
    ).rejects.toMatchObject({ status: 503 });
  });
  it("requires reconnection on denied property access, not a zero-traffic report", async () => {
    mocks.query.mockRejectedValue(new GscApiError(403, "Forbidden"));
    await expect(
      getSearchPerformanceReport({
        data: { projectId: "authorized-project", dateRange: "last_28_days" },
      }),
    ).resolves.toEqual({ connected: false });
  });
});
