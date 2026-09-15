import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { SkillsCatalog, filterGrowthSkills } from "./SkillsCatalog";
it("filters by purpose and category together", () => {
  expect(filterGrowthSkills("citations", "GEO").map((s) => s.name)).toEqual([
    "ai-seo",
  ]);
  expect(filterGrowthSkills("citations", "SEO")).toEqual([]);
});
it("shows source and dated popularity without claiming installs or results", () => {
  const html = renderToStaticMarkup(createElement(SkillsCatalog));
  for (const text of [
    "50,259",
    "2026-09-15",
    "coreyhaines31/marketingskills",
    "not live",
    "not installed in this web server",
    "Impact: not measured",
    "site-growth-ops",
    "Search skills",
    "Skill category",
  ])
    expect(html).toContain(text);
});
