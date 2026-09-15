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
  it("includes fresh Google observations consistently in report, details and export", async () => {
    mocks.query.mockImplementation(async (_site, request) =>
      request.dataState === "all"
        ? [
            {
              keys: [
                request.dimensions?.[0] === "date" ? request.endDate : "cue",
              ],
              clicks: 4,
              impressions: 20,
              ctr: 0.2,
              position: 3,
            },
          ]
        : [],
    );
    const data = {
      projectId: "authorized-project",
      dateRange: "last_7_days" as const,
      startDate: "2026-09-08",
      endDate: "2026-09-14",
      dataState: "all" as const,
    };
    const report = await getSearchPerformanceReport({ data });
    expect(report).toMatchObject({
      totals: { clicks: 4 },
      freshness: { dataState: "all", lastAvailableDate: "2026-09-14" },
    });
    await getSearchPerformanceTable({ data: { ...data, dimension: "query" } });
    await exportSearchPerformanceTable({
      data: { ...data, dimension: "page" },
    });
    expect(mocks.query).toHaveBeenCalledTimes(6);
    for (const [, request] of mocks.query.mock.calls)
      expect(request.dataState).toBe("all");
  });
  it("applies custom dates to totals, daily rows, detail rows and export", async () => {
    mocks.query.mockResolvedValue([]);
    const data = {
      projectId: "authorized-project",
      dateRange: "last_28_days" as const,
      startDate: "2026-09-02",
      endDate: "2026-09-08",
    };
    const report = await getSearchPerformanceReport({ data });
    expect(report).toMatchObject({
      range: {
        startDate: data.startDate,
        endDate: data.endDate,
        prevStartDate: "2026-08-26",
        prevEndDate: "2026-09-01",
      },
    });
    if (report.connected) expect(report.trend).toHaveLength(7);
    mocks.query.mockClear();
    await getSearchPerformanceTable({
      data: { ...data, dimension: "query", page: 1, pageSize: 25 },
    });
    await exportSearchPerformanceTable({
      data: { ...data, dimension: "page" },
    });
    for (const [, request] of mocks.query.mock.calls) {
      expect(request).toMatchObject({
        startDate: data.startDate,
        endDate: data.endDate,
        dataState: "final",
      });
    }
  });
  it.each([
    { startDate: "2026-09-10" },
    { startDate: "2026-09-10", endDate: "2026-09-01" },
    { startDate: "2026-02-30", endDate: "2026-03-01" },
    { startDate: "2026-01-01", endDate: "2026-09-01" },
  ])(
    "rejects invalid explicit dates before requesting Google: %j",
    async (dates) => {
      await expect(async () =>
        getSearchPerformanceReport({
          data: {
            projectId: "authorized-project",
            dateRange: "last_28_days",
            ...dates,
          },
        }),
      ).rejects.toThrow();
      expect(mocks.query).not.toHaveBeenCalled();
    },
  );
  it("returns dated trend observations with gaps, not invented zero traffic", async () => {
    mocks.query.mockImplementation(async (_site, request) => {
      if (request.dimensions?.[0] !== "date") return [];
      return [
        {
          keys: ["2026-08-17"],
          clicks: 0,
          impressions: 20,
          ctr: 0,
          position: 8,
        },
        {
          keys: ["2026-08-15"],
          clicks: 2,
          impressions: 100,
          ctr: 0.02,
          position: 4,
        },
      ].filter(
        (row) =>
          row.keys[0] >= request.startDate && row.keys[0] <= request.endDate,
      );
    });
    const result = await getSearchPerformanceReport({
      data: { projectId: "authorized-project", dateRange: "last_28_days" },
    });
    expect(result).toMatchObject({
      trend: [
        {
          date: "2026-08-15",
          clicks: 2,
          impressions: 100,
          ctr: 0.02,
          position: 4,
        },
        {
          date: "2026-08-16",
          clicks: null,
          impressions: null,
          ctr: null,
          position: null,
        },
        { date: "2026-08-17", clicks: 0, impressions: 20, ctr: 0, position: 8 },
        ...Array.from({ length: 25 }, (_, i) => ({
          date: new Date(Date.UTC(2026, 7, 18 + i)).toISOString().slice(0, 10),
          clicks: null,
          impressions: null,
          ctr: null,
          position: null,
        })),
      ],
      totals: { clicks: 2, impressions: 120 },
    });
    expect(mocks.query).toHaveBeenCalledTimes(4);
  });
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

describe("complete-period comparison", () => {
  it.each([
    ["final", null, true],
    ["final", "2026-09-07", false],
    ["final", "2026-09-04", false],
    ["all", null, false],
  ] as const)(
    "checks both daily windows (%s, missing %s)",
    async (dataState, missingDate, comparisonAvailable) => {
      mocks.query.mockImplementation(async (_site, request) => {
        if (request.dimensions?.[0] !== "date") return [];
        const rows: GscSearchAnalyticsRow[] = [];
        for (
          let ms = Date.parse(request.startDate);
          ms <= Date.parse(request.endDate);
          ms += 86400000
        ) {
          const date = new Date(ms).toISOString().slice(0, 10);
          if (date !== missingDate)
            rows.push({
              keys: [date],
              clicks: 1,
              impressions: 10,
              ctr: 0.1,
              position: 3,
            });
        }
        return rows;
      });
      const report = await getSearchPerformanceReport({
        data: {
          projectId: "authorized-project",
          dateRange: "last_7_days",
          startDate: "2026-09-06",
          endDate: "2026-09-08",
          dataState,
        },
      });
      expect(report).toMatchObject({
        freshness: {
          lastAvailableDate: "2026-09-08",
          comparisonAvailable,
        },
      });
    },
  );
});
