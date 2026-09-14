import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type * as Router from "@tanstack/react-router";
import { describe, expect, it, vi } from "vitest";
import { AuditHealthCard, BacklinkPulseCard, GscCard } from "./DashboardCards";
import { sumSearchTotals } from "@/server/features/gsc/searchPerformanceReport";
import { DashboardPage } from "./DashboardPage";

// Keep the actual cards; replace only browser routing and server RPC boundaries.
vi.mock("@/serverFunctions/searchPerformance", () => ({
  getSearchPerformanceReport: vi.fn(),
}));
vi.mock("@/serverFunctions/gsc", () => ({
  getGscConnection: vi.fn(),
  startSelfHostedGscLink: vi.fn(),
}));
vi.mock("@/serverFunctions/ga4", () => ({
  getGa4Connection: vi.fn(),
  startSelfHostedGa4Link: vi.fn(),
}));
vi.mock("@/serverFunctions/dashboard", () => ({
  getDashboardActivation: vi.fn(),
  getDashboardOverview: vi.fn(),
  refreshDashboardBacklinkSnapshot: vi.fn(),
  dismissDashboardGa4Card: vi.fn(),
  setDashboardStepDismissed: vi.fn(),
  markDashboardCompetitorClicked: vi.fn(),
}));
vi.mock("@/serverFunctions/workspace", () => ({
  getWorkspaceMergeStatus: vi.fn(),
  mergeLegacyWorkspaces: vi.fn(),
}));
vi.mock("@/serverFunctions/organization", () => ({
  getOrganizationContext: vi.fn(),
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

describe("dashboard backlink state", () => {
  it.each([false, true])(
    "warns about stale snapshots even when the refresh RPC falls back successfully (failed=%s)",
    (failed) => {
      const html = renderToStaticMarkup(
        createElement(BacklinkPulseCard, {
          projectId: "project-a",
          backlinks: {
            domain: "example.com",
            rank: null,
            backlinks: 125,
            referringDomains: 30,
            newBacklinks: null,
            lostBacklinks: null,
            newReferringDomains: null,
            lostReferringDomains: null,
            capturedAt: "2026-09-01T12:00:00Z",
            stale: true,
          },
          refreshing: false,
          failed,
        }),
      );
      expect(html).toContain('role="alert"');
      expect(html).toContain(
        failed ? "Refresh failed" : "This snapshot is stale",
      );
      expect(html).toContain("not current totals");
      expect(html).toContain("snapshot");
      expect(html).toContain(">125<");
      expect(html).not.toContain("No backlink totals are available");
    },
  );

  it("shows an unavailable first snapshot as an error, not setup success", () => {
    const html = renderToStaticMarkup(
      createElement(BacklinkPulseCard, {
        projectId: "project-a",
        backlinks: null,
        refreshing: false,
        failed: true,
      }),
    );

    expect(html).toContain("Could not load a backlink snapshot");
    expect(html).toContain("DataForSEO");
    expect(html).not.toContain("nothing to set up");
    expect(html).not.toContain("Taking your first snapshot");
  });
  it("keeps pending and not-yet-available snapshots distinct", () => {
    const pending = renderToStaticMarkup(
      createElement(BacklinkPulseCard, {
        projectId: "project-a",
        backlinks: null,
        refreshing: true,
      }),
    );
    expect(pending).toContain("Taking your first snapshot");
    expect(pending).toContain("aria-busy");
    const empty = renderToStaticMarkup(
      createElement(BacklinkPulseCard, {
        projectId: "project-a",
        backlinks: null,
        refreshing: false,
      }),
    );
    expect(empty).toContain("No backlink snapshot is available yet");
    expect(empty).toContain("may incur provider charges");
    expect(empty).not.toContain("nothing to set up");
  });
});

describe("dashboard overview failure", () => {
  it("shows unavailable state instead of setup/healthy cards when the overview fails", () => {
    const client = new QueryClient({
      defaultOptions: {
        queries: { retry: false, retryOnMount: false, staleTime: Infinity },
      },
    });
    client.setQueryData(["dashboardActivation", "project-a"], {
      domain: "example.com",
      ga4: {
        connected: false,
        propertyDisplayName: null,
        cardDismissedAt: "2026-09-10",
      },
      gsc: { connected: false, siteUrl: null },
      mcp: { authorizedAt: null, firstToolCallAt: null, cardDismissedAt: null },
      competitorClickedAt: null,
      hasMultipleProjects: false,
      hasTeammate: false,
      dismissedSteps: [],
    });
    client
      .getQueryCache()
      .build(client, { queryKey: ["dashboardOverview", "project-a"] })
      .setState({
        status: "error",
        error: new Error("fixture upstream error"),
      });
    const html = renderToStaticMarkup(
      createElement(
        QueryClientProvider,
        { client },
        createElement(DashboardPage, { projectId: "project-a" }),
      ),
    );
    client.clear();
    expect(html).toContain("Could not load the audit and backlink overview");
    expect(html).not.toContain("No backlink snapshot is available yet");
    expect(html).not.toContain("Run an audit");
    expect(html).not.toContain("fixture upstream error");
  });
});

describe("GSC card metric meaning", () => {
  it("renders undefined rates and position as unavailable, while keeping zero counts", () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: Infinity } },
    });
    client.setQueryData(["dashboardGscReport", "project-a"], {
      connected: true,
      range: {
        startDate: "2026-08-15",
        endDate: "2026-09-11",
        prevStartDate: "2026-07-18",
        prevEndDate: "2026-08-14",
      },
      totals: sumSearchTotals([]),
      prevTotals: sumSearchTotals([]),
      countries: [],
      strikingDistance: [],
    });
    const html = renderToStaticMarkup(
      createElement(
        QueryClientProvider,
        { client },
        createElement(GscCard, { projectId: "project-a", connected: true }),
      ),
    );
    client.clear();
    expect(html).not.toContain("0.0%");
    expect(html).toContain("—");
    expect(html).toContain(">0<");
    expect(html).toContain("2026-08-15 to 2026-09-11");
    expect(html).toContain("PT (America/Los_Angeles)");
    expect(html).toContain("finalized data only");
    expect(html).toContain("No impressions were returned");
  });
  it("still displays 0.0% CTR when there are impressions and zero clicks", () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: Infinity } },
    });
    client.setQueryData(["dashboardGscReport", "project-a"], {
      connected: true,
      range: {
        startDate: "2026-08-15",
        endDate: "2026-09-11",
        prevStartDate: "2026-07-18",
        prevEndDate: "2026-08-14",
      },
      totals: sumSearchTotals([
        { clicks: 0, impressions: 10, ctr: 0, position: 7 },
      ]),
      prevTotals: sumSearchTotals([]),
      countries: [],
      strikingDistance: [],
    });
    const html = renderToStaticMarkup(
      createElement(
        QueryClientProvider,
        { client },
        createElement(GscCard, { projectId: "project-a", connected: true }),
      ),
    );
    client.clear();
    expect(html).toContain(">0.0%<");
    expect(html).not.toContain("No impressions were returned");
  });
});

describe("dashboard audit completeness", () => {
  it.each([
    ["failed", 3, "The last crawl failed"],
    ["running", 3, "Crawl in progress"],
    ["completed", 0, "No pages were crawled"],
  ] as const)(
    "does not claim health for a %s crawl of %i pages",
    (status, pagesCrawled, message) => {
      const html = renderToStaticMarkup(
        createElement(AuditHealthCard, {
          projectId: "project-a",
          audit: {
            status,
            pagesCrawled,
            startedAt: "2026-09-10",
            topIssues: [],
            totalIssueTypes: 0,
          },
        }),
      );
      expect(html).toContain(message);
      expect(html).not.toContain("site looks healthy");
      expect(html).not.toContain("No issues found");
    },
  );

  it("reports the assessed scope for a completed crawl with no issues", () => {
    const html = renderToStaticMarkup(
      createElement(AuditHealthCard, {
        projectId: "project-a",
        audit: {
          status: "completed",
          pagesCrawled: 3,
          startedAt: "2026-09-10",
          topIssues: [],
          totalIssueTypes: 0,
        },
      }),
    );
    expect(html).toContain("No issues found in the 3 pages crawled");
  });
});
