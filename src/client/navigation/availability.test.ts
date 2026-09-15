import { describe, expect, it } from "vitest";
import { getProjectNavGroups } from "./items";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { FeatureAvailabilityContext, AvailableRoute } from "./availability";
import { SavedKeywordsHeader } from "@/client/features/saved-keywords/SavedKeywordsHeader";
import { AvailableTools } from "@/client/features/ai-mcp/AvailableTools";

describe("1.0 navigation availability", () => {
  it("preserves configured research and independent routes", () => {
    expect(
      getProjectNavGroups("project-a", true).flatMap((group) =>
        group.items.map((item) => item.label),
      ),
    ).toContain("Keyword Research");
    for (const pathname of [
      "/p/project-a/search-performance",
      "/p/project-a/settings",
      "/ai",
      "/p/project-a/saved",
    ]) {
      expect(
        renderToStaticMarkup(
          createElement(AvailableRoute, { pathname }, "independent"),
        ),
      ).toBe("independent");
    }
    expect(
      renderToStaticMarkup(
        createElement(
          FeatureAvailabilityContext.Provider,
          { value: { research: true, chat: true } },
          createElement(
            AvailableRoute,
            { pathname: "/p/project-a/sam" },
            "configured chat",
          ),
        ),
      ),
    ).toBe("configured chat");
  });
  it("keeps independent reports and saved data but omits unconfigured research", () => {
    const labels = getProjectNavGroups("project-a", false).flatMap((group) =>
      group.items.map((item) => item.label),
    );
    expect(labels).toEqual([
      "Dashboard",
      "GSC Insights",
      "Saved Keywords",
      "Site Audit",
    ]);
  });
  it("never mounts a paid deep link or chat while availability is unknown", () => {
    let mounted = 0;
    function PaidPage() {
      mounted++;
      return createElement("p", null, "paid page");
    }
    for (const pathname of [
      "/p/project-a/domain",
      "/p/project-a/rank-tracking/old",
      "/p/project-a/sam",
      "/p/project-a/sam/",
      "/p/project-a/DOMAIN",
    ]) {
      const html = renderToStaticMarkup(
        createElement(
          FeatureAvailabilityContext.Provider,
          { value: { research: false, chat: false } },
          createElement(
            AvailableRoute,
            { pathname, projectId: "project-a" },
            createElement(PaidPage),
          ),
        ),
      );
      expect(html).toContain("Not available in 1.0");
      expect(html).toContain("/p/project-a/settings");
    }
    expect(mounted).toBe(0);
  });
  it("keeps saved keyword exports without offering unavailable metric updates", () => {
    const html = renderToStaticMarkup(
      createElement(SavedKeywordsHeader, {
        totalCount: 2,
        exporting: null,
        metricsRefreshing: false,
        onExportCsv() {},
        onExportSheets() {},
        onRefreshMetrics() {},
      }),
    );
    expect(html).toContain("Export CSV");
    expect(html).not.toContain("Update keyword stats");
  });
  it("keeps independent MCP tools without advertising unavailable provider research", () => {
    const html = renderToStaticMarkup(createElement(AvailableTools));
    expect(html).toContain("Get project context");
    expect(html).toContain("Get Search Console performance");
    expect(html).toContain("Get saved keywords");
    expect(html).not.toContain("Research keywords");
    expect(html).not.toContain("Get backlinks overview");
  });
});
