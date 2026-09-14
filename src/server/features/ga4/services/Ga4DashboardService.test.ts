import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Ga4RunReportResponse } from "@/server/lib/ga4Client";
import { makeGa4Connection } from "./ga4-test-fixtures";
import { Ga4DashboardService } from "./Ga4DashboardService";

const mocks = vi.hoisted(() => ({
  getByProjectId: vi.fn(),
  runReport: vi.fn(),
}));

// Only the storage and Google API boundaries are substituted. The overview,
// normalization, dates and dashboard projection run their real implementations.
vi.mock("@/server/features/ga4/repositories/Ga4ConnectionRepository", () => ({
  Ga4ConnectionRepository: { getByProjectId: mocks.getByProjectId },
}));
vi.mock("@/server/lib/ga4Client", () => ({
  createGa4DataClient: () => ({ runReport: mocks.runReport }),
}));

const metrics = [
  "sessions",
  "activeUsers",
  "engagedSessions",
  "engagementRate",
  "keyEvents",
  "transactions",
  "purchaseRevenue",
];

function googleReport(
  sessions: string,
  options: { date?: string; metadata?: Ga4RunReportResponse["metadata"] } = {},
): Ga4RunReportResponse {
  return {
    dimensionHeaders: options.date ? [{ name: "date" }] : [],
    metricHeaders: metrics.map((name) => ({ name })),
    rows: [
      {
        dimensionValues: options.date ? [{ value: options.date }] : [],
        metricValues: [sessions, "7", "2", "0.5", "1", "0", "0"].map(
          (value) => ({ value }),
        ),
      },
    ],
    rowCount: 1,
    metadata: options.metadata,
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-14T12:00:00Z"));
  mocks.getByProjectId.mockResolvedValue(
    makeGa4Connection({ propertyCurrencyCode: "EUR" }),
  );
});

afterEach(() => vi.useRealTimers());

describe("GA4 dashboard report", () => {
  it("preserves property, actual dates and provider quality limitations", async () => {
    mocks.runReport
      .mockResolvedValueOnce(
        googleReport("0", {
          metadata: {
            schemaRestrictionResponse: {
              activeMetricRestrictions: [{ metricName: "sessions" }],
            },
          },
        }),
      )
      .mockResolvedValueOnce(googleReport("4"))
      .mockResolvedValueOnce({
        ...googleReport("2", {
          date: "20260912",
          metadata: {
            subjectToThresholding: true,
            samplingMetadatas: [
              { samplesReadCount: "100", samplingSpaceSize: "1000" },
            ],
          },
        }),
        rowCount: 500,
      });

    const report = await Ga4DashboardService.getReport({ projectId: "p1" });

    expect(report).toMatchObject({
      source: {
        provider: "google_analytics",
        propertyId: "properties/123",
        propertyDisplayName: "Example",
      },
      request: {
        resolvedDateRange: { startDate: "2026-08-17", endDate: "2026-09-13" },
        previousDateRange: { startDate: "2026-07-20", endDate: "2026-08-16" },
        propertyTimeZone: "America/New_York",
        currencyCode: "EUR",
      },
      reportMetadata: { hasLimitedData: true },
      warnings: ["trend_truncated"],
      totals: { sessions: null, activeUsers: 7 },
    });
  });

  it("keeps restricted and missing daily sessions unknown rather than zero", async () => {
    mocks.runReport
      .mockResolvedValueOnce(googleReport("3"))
      .mockResolvedValueOnce(googleReport("4"))
      .mockResolvedValueOnce(
        googleReport("0", {
          date: "20260912",
          metadata: {
            schemaRestrictionResponse: {
              activeMetricRestrictions: [{ metricName: "sessions" }],
            },
          },
        }),
      );

    const report = await Ga4DashboardService.getReport({ projectId: "p1" });

    expect(report.trend).toHaveLength(28);
    expect(report.trend.slice(-2)).toEqual([
      { date: "2026-09-12", sessions: null },
      { date: "2026-09-13", sessions: null },
    ]);
  });

  it("distinguishes an empty overview from an explicitly reported zero", async () => {
    mocks.runReport
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce(googleReport("4"))
      .mockResolvedValueOnce({});
    const empty = await Ga4DashboardService.getReport({ projectId: "p1" });
    expect(empty).toMatchObject({
      currentRowReturned: false,
      totals: { sessions: null },
    });
    expect(empty.trend.every((day) => day.sessions === null)).toBe(true);

    mocks.runReport
      .mockResolvedValueOnce(googleReport("0"))
      .mockResolvedValueOnce(googleReport("4"))
      .mockResolvedValueOnce(googleReport("0", { date: "20260912" }));
    const zero = await Ga4DashboardService.getReport({ projectId: "p1" });
    expect(zero).toMatchObject({
      currentRowReturned: true,
      totals: { sessions: 0 },
    });
    expect(zero.trend.slice(-2)).toEqual([
      { date: "2026-09-12", sessions: 0 },
      { date: "2026-09-13", sessions: null },
    ]);
  });
});
