import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { DailyTrend } from "./DailyTrend";

it("provides accessible daily observations, distinguishes zero from gaps, and never invents an empty plot", () => {
  const render = (rows: { date: string; value: number | null }[]) =>
    renderToStaticMarkup(createElement(DailyTrend, { rows, label: "Clicks" }));
  const html = render([
    { date: "2026-09-01", value: 2 },
    { date: "2026-09-02", value: null },
    { date: "2026-09-03", value: 0 },
  ]);
  expect(html).toContain("View daily values");
  expect(html).toContain("Not reported");
  expect(html).toContain(">0<");
  expect(html).toContain("2026-09-02");
  expect(html).toContain("gaps, not zero");
  expect(render([])).toContain("No daily observations available");
  expect(render([{ date: "2026-09-01", value: null }])).toContain(
    "No daily observations available",
  );
});
