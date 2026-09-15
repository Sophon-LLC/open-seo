import { useState } from "react";

const upstream = "https://github.com/coreyhaines31/marketingskills";
const growthSkills = [
  {
    name: "seo-audit",
    category: "SEO",
    purpose:
      "Find crawl, indexing and on-page issues; prioritize fixes with evidence.",
    version: "2.0.1",
  },
  {
    name: "ai-seo",
    category: "GEO",
    purpose:
      "Improve answer-ready content, citations and visibility in AI search.",
    version: "2.5.0",
  },
  {
    name: "content-strategy",
    category: "Content",
    purpose:
      "Map audience problems and search intent into a useful content plan.",
    version: null,
  },
  {
    name: "site-architecture",
    category: "SEO",
    purpose: "Design topic hubs, navigation and useful internal links.",
    version: null,
  },
  {
    name: "programmatic-seo",
    category: "SEO",
    purpose: "Design scalable pages with unique value and quality gates.",
    version: null,
  },
  {
    name: "schema",
    category: "SEO",
    purpose: "Align structured data with visible, verified page content.",
    version: null,
  },
  {
    name: "analytics",
    category: "Measurement",
    purpose: "Validate event tracking and conversion measurement.",
    version: null,
  },
  {
    name: "attribution",
    category: "Measurement",
    purpose: "Assess qualified traffic, conversions and revenue contribution.",
    version: null,
  },
] as const;

export function filterGrowthSkills(search: string, category: string) {
  return growthSkills.filter(
    (s) =>
      (category === "All" || s.category === category) &&
      `${s.name} ${s.purpose}`
        .toLowerCase()
        .includes(search.trim().toLowerCase()),
  );
}

export function SkillsCatalog() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const rows = filterGrowthSkills(search, category);
  return (
    <section
      id="growth-skills"
      aria-label="SEO and GEO skills library"
      className="space-y-4"
    >
      <div>
        <h2 className="text-xl font-semibold">SEO & GEO Skills</h2>
        <p className="mt-2 text-sm text-base-content/70">
          One reference library for research, content, technical quality and
          measurement. A listing is not an execution or a verified business
          result.
        </p>
      </div>
      <div className="rounded-xl border border-base-300 p-4 text-sm space-y-2">
        <a
          className="link font-semibold"
          href={upstream}
          target="_blank"
          rel="noreferrer"
        >
          coreyhaines31/marketingskills
        </a>
        <p>
          50,259 GitHub stars · MIT · snapshot checked 2026-09-15 · repository
          last pushed 2026-09-05
        </p>
        <p className="text-base-content/60">
          Stars belong to the entire repository, not each skill. They are not a
          quality score or a ranking of every SEO tool. Metadata is a dated
          snapshot, not live.
        </p>
        <a
          className="link"
          href={`${upstream}#readme`}
          target="_blank"
          rel="noreferrer"
        >
          Official setup and compatibility instructions
        </a>
      </div>
      <div className="flex flex-wrap gap-3">
        <input
          className="input input-sm w-full sm:flex-1"
          aria-label="Search skills"
          placeholder="Search by skill or purpose…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="select select-sm w-full sm:w-48"
          aria-label="Skill category"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          {["All", "SEO", "GEO", "Content", "Measurement"].map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </div>
      <p className="text-xs text-base-content/60">
        {rows.length} skills · Local agent files were observed on the operator
        workstation, not installed in this web server. Exact upstream revision
        and performance impact are not verified. No automatic execution or
        installation.
      </p>
      <div className="grid gap-3 md:grid-cols-2">
        {rows.map((s) => (
          <article
            key={s.name}
            className="rounded-xl border border-base-300 p-4 space-y-2"
          >
            <div className="flex flex-wrap justify-between gap-2">
              <a
                className="link font-semibold"
                target="_blank"
                rel="noreferrer"
                href={`${upstream}/tree/main/skills/${s.name}`}
              >
                {s.name}
              </a>
              <span className="badge badge-outline">{s.category}</span>
            </div>
            <p className="text-sm">{s.purpose}</p>
            <p className="text-xs text-base-content/60">
              Local declared version: {s.version ?? "not verified"} · Execution
              history: not connected · Impact: not measured
            </p>
          </article>
        ))}
      </div>
      {!rows.length && (
        <p role="status">No matching skills. Try another category or search.</p>
      )}
      <details className="rounded-xl border border-base-300 p-4 text-sm">
        <summary className="cursor-pointer font-semibold">
          Internal workflow: site-growth-ops
        </summary>
        <p className="mt-2">
          Local operational skill for evidence, approvals and reporting across
          sites. Not a high-star upstream library. It complements research
          skills; it does not replace them. Retention should depend on fewer
          errors and measurable useful outcomes, not installation alone.
        </p>
        <p className="mt-2 text-base-content/60">
          No public star count · Local file observed 2026-09-15 · No verified
          attribution to purchases.
        </p>
      </details>
    </section>
  );
}
