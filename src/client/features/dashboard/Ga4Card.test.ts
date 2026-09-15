import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type * as Router from "@tanstack/react-router";
import { describe, expect, it, vi } from "vitest";
import { Ga4Card } from "./Ga4Card";
import type { Ga4DashboardReport } from "@/server/features/ga4/services/Ga4DashboardService";

// Replace only RPC and router boundaries; the real card, query cache, stats
// and number formatters render the report returned by the dashboard contract.
vi.mock("@/serverFunctions/ga4", () => ({
  getGa4DashboardReport: vi.fn(),
  getGa4Connection: vi.fn(),
  listGa4Properties: vi.fn(),
  setGa4Property: vi.fn(),
  disconnectGa4: vi.fn(),
  startSelfHostedGa4Link: vi.fn(),
}));
vi.mock("@/serverFunctions/gsc", () => ({
  getGscConnection: vi.fn(),
  startSelfHostedGscLink: vi.fn(),
}));
vi.mock("@/serverFunctions/dashboard", () => ({
  dismissDashboardGa4Card: vi.fn(),
}));
vi.mock("@/serverFunctions/projects", () => ({ getProjects: vi.fn() }));
vi.mock("@/serverFunctions/googleAccounts", () => ({
  getGoogleAccountRemovalImpact: vi.fn(),
  removeGoogleAccount: vi.fn(),
}));
vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof Router>()),
  Link: ({ children }: { children: ReactNode }) =>
    createElement("a", null, children),
}));

function makeReport(): Ga4DashboardReport {
  return {
    connected: true,
    source: {
      provider: "google_analytics",
      propertyId: "properties/123",
      propertyDisplayName: "Example property",
    },
    request: {
      requestedDateRange: null,
      resolvedDateRange: { startDate: "2026-08-17", endDate: "2026-09-13" },
      previousDateRange: { startDate: "2026-07-20", endDate: "2026-08-16" },
      propertyTimeZone: "America/New_York",
      currencyCode: "EUR",
      channel: "organic_search",
      trend: "daily",
    },
    currentRowReturned: true,
    totals: { sessions: 10, activeUsers: 7, engagementRate: 0.5, keyEvents: 2 },
    prevTotals: {
      sessions: 5,
      activeUsers: 7,
      engagementRate: 0.5,
      keyEvents: 1,
    },
    trend: [{ date: "2026-09-13", sessions: 10 }],
    reportMetadata: {
      hasLimitedData: false,
      reports: Array.from({ length: 3 }, () => ({
        dataLossFromOtherRow: false,
        subjectToThresholding: false,
        sampling: [],
        restrictedMetrics: [],
        emptyReason: null,
        hasLimitedData: false,
      })),
    },
    warnings: [],
  };
}

function renderReport(report: Ga4DashboardReport): string {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  client.setQueryData(["dashboardGa4Report", "project-a"], report);
  const html = renderToStaticMarkup(
    createElement(
      QueryClientProvider,
      { client },
      createElement(Ga4Card, { projectId: "project-a", connected: true }),
    ),
  );
  client.clear();
  return html;
}

describe("GA4 dashboard card", () => {
  it("does not describe unavailable sessions as no organic traffic", () => {
    const report = makeReport();
    report.totals.sessions = null;
    report.reportMetadata.hasLimitedData = true;
    report.reportMetadata.reports[0].hasLimitedData = true;
    report.reportMetadata.reports[0].restrictedMetrics = [
      { metricName: "sessions", restrictedMetricTypes: [] },
    ];

    const html = renderReport(report);

    expect(html).toContain("Organic session count unavailable");
    expect(html).toContain("Active users");
    expect(html).toContain("—");
    expect(html).not.toContain("No organic search traffic recorded");
  });

  it("distinguishes no returned rows from a reported zero", () => {
    const empty = makeReport();
    empty.currentRowReturned = false;
    empty.totals = {
      sessions: null,
      activeUsers: null,
      engagementRate: null,
      keyEvents: null,
    };
    empty.trend = [{ date: "2026-09-13", sessions: null }];
    const emptyHtml = renderReport(empty);
    expect(emptyHtml).toContain("GA4 returned no rows for this period");
    expect(emptyHtml).not.toContain("0 organic sessions");

    const zero = makeReport();
    zero.totals.sessions = 0;
    zero.trend = [{ date: "2026-09-13", sessions: 0 }];
    const zeroHtml = renderReport(zero);
    expect(zeroHtml).toContain(
      "GA4 reports 0 organic sessions for this period",
    );
    expect(zeroHtml).not.toContain("GA4 returned no rows");
    expect(zeroHtml).not.toContain("Organic session count unavailable");
  });

  it.each([
    ["sampling", "sampled data"],
    ["thresholding", "thresholding"],
    ["restriction", "restricted metrics: sessions"],
    ["other-row", "data loss from the (other) row"],
    ["empty", "GA4 empty reason: permission_limited"],
    ["truncated", "Daily trend is truncated"],
  ])(
    "explains %s limitations and withholds growth comparisons",
    (kind, notice) => {
      const report = makeReport();
      const metadata = report.reportMetadata.reports[1];
      if (kind === "sampling") {
        metadata.sampling = [
          { samplesReadCount: "100", samplingSpaceSize: "1000" },
        ];
      } else if (kind === "thresholding") {
        metadata.subjectToThresholding = true;
      } else if (kind === "restriction") {
        metadata.restrictedMetrics = [
          { metricName: "sessions", restrictedMetricTypes: [] },
        ];
      } else if (kind === "other-row") {
        metadata.dataLossFromOtherRow = true;
      } else if (kind === "empty") {
        metadata.emptyReason = "permission_limited";
      } else {
        report.warnings = ["trend_truncated"];
      }
      if (!["empty", "truncated"].includes(kind)) {
        metadata.hasLimitedData = true;
        report.reportMetadata.hasLimitedData = true;
      }

      const html = renderReport(report);

      expect(html).toContain(notice);
      expect(html).toContain("Period comparisons unavailable");
      expect(html).not.toContain("▲");
      expect(html).not.toContain("▼");
    },
  );

  it("identifies the property, actual periods, timezone and reported currency", () => {
    const html = renderReport(makeReport());
    for (const value of [
      "Example property",
      "properties/123",
      "2026-08-17",
      "2026-09-13",
      "2026-07-20",
      "2026-08-16",
      "America/New_York",
      "EUR",
    ]) {
      expect(html).toContain(value);
    }
    expect(html).toContain("▲ 100%");
    expect(html).toContain("View daily values");
    expect(html).not.toContain("Data quality limitations");
  });

  it("does not invent a currency when the property has not reported one", () => {
    const report = makeReport();
    report.request.currencyCode = "";
    const html = renderReport(report);
    expect(html).toContain("Currency not reported");
    expect(html).not.toContain("USD");
  });

  it("labels unreported trend dates as gaps, not zero-session days", () => {
    const report = makeReport();
    report.trend = [
      { date: "2026-09-12", sessions: null },
      { date: "2026-09-13", sessions: 0 },
    ];
    expect(renderReport(report)).toContain(
      "Unreported daily values remain gaps, not zero",
    );

    report.trend = [{ date: "2026-09-13", sessions: null }];
    expect(renderReport(report)).toContain(
      "No daily session values were returned",
    );
  });
});
