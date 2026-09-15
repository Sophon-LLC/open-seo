import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { DashboardFilters } from "./DashboardFilters";
it("renders accessible date, channel and reset controls with the actual active period", () => {
  const html = renderToStaticMarkup(
    createElement(DashboardFilters, {
      dates: { startDate: "2026-09-02", endDate: "2026-09-08" },
      onDates: () => {},
      channel: "all",
      onChannel: () => {},
    }),
  );
  for (const text of [
    "Last 7 days",
    "Last 28 days",
    "Last 90 days",
    "Custom",
    "Traffic channel",
    "Reset",
    "2026-09-02",
    "2026-09-08",
  ])
    expect(html).toContain(text);
});
