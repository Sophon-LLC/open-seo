# Dashboard charts — local acceptance, 2026-09-14

## Scope and release boundary

Repository: Sophon-LLC/open-seo, branch codex/data-visibility-20260914.
Reuses upstream Recharts. No Cue Desktop files changed. Website/public deployment,
paid provider calls, URL submissions, permissions and scheduled execution unchanged.
Code is locally modified; not committed or pushed by this change.

Local image: sophon/open-seo:charts-20260914. Container verified healthy and bound
only to 127.0.0.1:3014. Previous image sophon/open-seo:v1-scope-20260914 retained.

## Implemented

- GSC daily clicks, impressions, CTR and position, from the existing report call.
  Missing dates remain null/gaps; observed zero stays zero. No extra provider calls.
- GA4 organic session trend reuses the same chart and daily-value table.
- Native expandable daily-value tables, source details and responsive layout.
- Bing historical totals remain totals, explicitly without daily history.
- IndexNow receipts are chronological, not cumulative unique/indexed URL counts.
- Translation review counts are grouped by receipt, not presented as publication.
- Scheduled configuration is distinct from actual execution status.
- Data and charts appear before setup prompts.

## Verification

- 12 Vitest files / 72 tests passed after final layout change.
- TypeScript: pnpm exec tsc --noEmit passed.
- Local Docker client, SSR and worker builds completed; health check passed.
- Edge: four real GSC charts visibly rendered, with dates and axes.
- Expanded 28 daily clicks and impression values: sums 73 and 4,316, matching
  summary metrics for 2026-08-15 through 2026-09-11. CTR 1.7%, position 16.8.
- Edge 390x844 viewport: document and content width both 390; daily values and
  translation source disclosures operated. Viewport restored afterwards.
- Translation chart visibly rendered four review counts of 10 each.
- Browser error log query returned no captured errors during acceptance.
- SSR-only Recharts tests emit layout-size warnings because there is no browser
  layout; real Edge rendering was independently checked. Build retains existing
  large-bundle warning; this is not a claim of completed performance optimization.

## Data limitations / not completed by these charts

- GA4 returned no rows for its requested period; sessions and key events remain
  unknown, not zero. Purchase attribution is not established.
- Bing uses imported historical observations, not a live API connection; latest
  indexing issue status is unknown.
- IndexNow submitted receipts do not establish indexing success.
- Translation receipt is dated 2026-09-08; current source freshness, editorial
  approval and publication have not been revalidated.
- Scheduled-task execution result is unknown even when configuration is active.
- Cue/Tinyclaw AI backend integration and paid research are separate work.
