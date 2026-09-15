import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { GscCard } from "./GscCard";
vi.mock("@/serverFunctions/keywords", () => ({ saveKeywords: vi.fn() }));
vi.mock("@/client/lib/posthog", () => ({ captureClientEvent: vi.fn() }));
vi.mock("@/serverFunctions/searchPerformance", () => ({
  getSearchPerformanceReport: vi.fn(),
  getSearchPerformanceTable: vi.fn(),
}));
vi.mock("@/client/features/gsc/SearchConsoleConnectionCard", () => ({
  SearchConsoleConnectionCard: () => null,
}));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: ReactNode }) =>
    createElement("a", null, children),
}));

describe("dashboard latest observations", () => {
  it.each(["2026-09-12", "2026-09-14"])(
    "withholds growth for incomplete periods even when the last returned date is %s",
    (lastAvailableDate) => {
      const client = new QueryClient({
        defaultOptions: { queries: { staleTime: Infinity, retry: false } },
      });
      const dates = { startDate: "2026-09-08", endDate: "2026-09-14" };
      client.setQueryData(["dashboardGscReport", "project-a", dates], {
        connected: true,
        range: {
          ...dates,
          prevStartDate: "2026-09-01",
          prevEndDate: "2026-09-07",
        },
        totals: { clicks: 10, impressions: 100, ctr: 0.1, position: 3 },
        prevTotals: { clicks: 5, impressions: 50, ctr: 0.1, position: 3 },
        trend: [],
        countries: [],
        freshness: {
          dataState: "final",
          lastAvailableDate,
          comparisonAvailable: false,
        },
      });
      const html = renderToStaticMarkup(
        createElement(
          QueryClientProvider,
          { client },
          createElement(GscCard, {
            projectId: "project-a",
            connected: true,
            dates,
            dataState: "final",
          }),
        ),
      );
      expect(html).not.toContain("100%");
      expect(html).toContain(
        "Growth comparisons require daily observations for both complete periods.",
      );
      client.clear();
    },
  );
  it("separates final cache and discloses the latest returned day without partial-period deltas", () => {
    const client = new QueryClient({
      defaultOptions: { queries: { staleTime: Infinity, retry: false } },
    });
    const dates = { startDate: "2026-09-08", endDate: "2026-09-14" };
    const report = {
      connected: true,
      range: {
        ...dates,
        prevStartDate: "2026-09-01",
        prevEndDate: "2026-09-07",
      },
      totals: { clicks: 10, impressions: 100, ctr: 0.1, position: 3 },
      prevTotals: { clicks: 5, impressions: 50, ctr: 0.1, position: 3 },
      trend: [],
      countries: [],
      freshness: { dataState: "all", lastAvailableDate: "2026-09-13" },
    };
    client.setQueryData(["dashboardGscReport", "project-a", dates], report);
    const render = () =>
      renderToStaticMarkup(
        createElement(
          QueryClientProvider,
          { client },
          createElement(GscCard, {
            projectId: "project-a",
            connected: true,
            dates,
            dataState: "all",
          }),
        ),
      );
    expect(render()).toContain("aria-busy");
    client.setQueryData(
      ["dashboardGscReport", "project-a", dates, "all"],
      report,
    );
    const html = render();
    expect(html).toContain("Last date returned by Google: 2026-09-13");
    expect(html).toContain("may include incomplete data");
    expect(html).not.toContain("finalized data only");
    expect(html).not.toContain("100%");
    client.clear();
  });
});
