import { expect, it } from "vitest";
import {
  dashboardDates,
  advanceDashboardDates,
  validReportDates,
} from "./reportDates";
it("uses exactly 7/28/90 inclusive PT calendar days, including a month boundary", () => {
  for (const days of [7, 28, 90] as const) {
    const range = dashboardDates(days, new Date("2026-09-14T01:00:00Z"));
    expect(range.endDate).toBe("2026-09-13");
    expect(
      (Date.parse(range.endDate) - Date.parse(range.startDate)) / 86400000 + 1,
    ).toBe(days);
    expect(validReportDates(range)).toBe(true);
  }
});
it("rolls presets across PT midnight but keeps explicit custom dates unchanged", () => {
  const previous = dashboardDates(7, new Date("2026-09-15T06:59:00Z"));
  const now = new Date("2026-09-15T07:01:00Z");
  expect(advanceDashboardDates(previous, 7, now)).toEqual({
    startDate: "2026-09-09",
    endDate: "2026-09-15",
  });
  expect(advanceDashboardDates(previous, null, now)).toBe(previous);
  expect(
    advanceDashboardDates(previous, 7, new Date("2026-09-15T06:59:30Z")),
  ).toBe(previous);
});
