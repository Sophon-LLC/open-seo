# Sophon backend handoff — 2026-09-15

## Repository and preservation checklist

- [x] Repository is `Sophon-LLC/open-seo`; work continues in an isolated Codex
      worktree on `codex/sophon-backend-handoff-20260915`.
- [x] The source worktree remains on `codex/data-visibility-20260914` at
      `c351d100020b569e0d67e65d342e9551febade4d`. Its 30 modified and 35 untracked
      backend files were copied through an explicit path allow-list. SHA-256 hashes
      were captured before copying and the original files were checked again.
- [x] Remote `main` is `0d1b187ac8f45a13691368af7a552da4dff92b22` (PR #1).
      Its tree is identical to the source HEAD: the ten earlier commits were
      squash-merged. The new branch starts from this main commit.
- [x] No environment files, credentials, databases or dependency directories
      were copied. Dependencies were installed independently from the frozen lockfile
      using the local offline package store, with lifecycle scripts disabled.
- [x] Cue Desktop, website content, download links and publishing were not edited.
- [x] Review control-plane files were not changed. The organization-enforced
      Greptile baseline has not been verified.

## Runtime and deployment states

| State                                    | Verified result                                                                                                           |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Earlier committed work                   | Source HEAD is pushed; equivalent tree merged in PR #1                                                                    |
| Recovered local work                     | Charts, filters, freshness, availability guards, evidence imports and skills catalog were uncommitted in the source       |
| Running local container                  | `cue-growth-openseo-open-seo-1`, healthy, loopback port 3014                                                              |
| Running image                            | `sophon/open-seo:fresh-dates-20260915`, image ID `71a10fcf21a3d6b0af2a6b6264b16ebf51301206779fa4b968f509a45a2f2b7c`       |
| Rollback image                           | `sophon/open-seo:updates-skills-20260915`, confirmed present                                                              |
| Durable data                             | Existing `cue-growth-openseo_open-seo-data` volume mounted at `/app/.wrangler`                                            |
| Remaining temporary-directory dependency | Compose files, runtime configuration and read-only `readiness.mjs` bind mount still depend on the website pilot directory |
| New review changes                       | Complete-period comparison fix and static-check cleanup are in this branch; they are not in the running image             |
| Public deployment                        | No deployment performed or newly verified by this handoff                                                                 |

Do not move either pilot directory or recreate the running container until its
Compose project name, volume mapping, configuration paths, Google grants and
readiness bind mount are accounted for. Directory migration is not part of this
handoff. Keep the existing data volume when rolling back an application image.
The channel-evidence migration is additive; do not drop the table to roll back UI.

## Reviewed changes

1. **Historical evidence storage:** normalized, project-scoped rows with source,
   observation time, source-update time, reporting period, status and nullable
   counts. SQLite and Postgres migrations accompany the service/repository and
   authenticated MCP import/read surfaces. Importing evidence does not contact
   providers, submit URLs or run schedules.
2. **Feature availability:** omit unconfigured research/chat navigation and prevent
   unavailable deep-link page components from mounting. Keep settings, AI/MCP,
   independent GSC reports and saved data available. This UI boundary does not
   replace server authorization or authorize provider spending.
3. **Reporting UI:** shared date/channel filters, daily trends with gaps, bounded
   search details, latest/final cache separation, visible-page refresh and the
   reference skills catalog. Catalog presence is not execution or impact evidence.
4. **Additional review fix:** a final GSC row on the requested last day is
   insufficient for a growth comparison. Both current and reference periods now
   require an observation for every requested date. Missing interior or reference
   dates suppress comparisons. Latest mode continues to suppress them. This is
   a conservative comparison gate, not proof of exhaustive property coverage.

Static-check cleanup uses existing Remeda sorting, validates form/select values,
and moves the Google card into its own component. No new dependency was added.

## Validation

- Recovered source before further edits: 22 test files / 136 tests and TypeScript
  passed independently of earlier session claims.
- Reviewed implementation: 23 focused test files / 141 tests passed, including
  daily-window advancement, unknown versus zero, cache/project isolation,
  paid-query exclusion, import persistence and missing-period comparison cases.
- Red/green service regressions exercised missing current/reference dates and
  final/latest modes; rendered-card regressions enforce the comparison disclosure.
- Full repository test suite: 173 files / 1,408 tests passed. TypeScript passed.
- Full `pnpm run ci:check` passed: formatting, Knip, application and badseo
  TypeScript, type-aware Oxlint, and plugin-skill sync with no generated drift.
- Local client, SSR and audit-worker Vite builds passed. Existing large-chunk
  warnings remain. SSR chart tests have no viewport and emit dimension warnings.
- Live Edge verification checked the **existing running image**, not the newer
  review fix: latest returned September 14, final returned September 12, and GA4
  still displayed no rows as unknown. These are dated observations, not fixed
  provider freshness guarantees. The temporary verification tab was closed.
- SQLite migration/persistence was exercised against an in-memory database.
  Postgres migration execution and a fresh Docker rollout were not performed.

## Next priority: unattended first-party reporting

Status: **not implemented or enabled**. Closing the dashboard stops its refresh.
Source inspection found the existing `scheduled` handler runs audit reconciliation
and rank checks, plus separate hosted maintenance. Rank checks may incur provider
charges. Neither that handler nor the local Vite-preview container provides a
GSC/GA4 ingestion worker; invoking it as a generic report-refresh endpoint would
have the wrong scope.

Implement the following as the next independently reviewable backend change:

- [ ] Use existing GSC/GA4 authorization and services through an explicitly
      first-party-only sync entry point. Keep paid research, publishing, URL
      submission and AI generation outside that path.
- [ ] Persist per-project/provider jobs and normalized daily observations in
      both SQL dialects. Store provider/property, metric and unit, timezone,
      dimensions, requested/returned dates, latest/final mode, coverage, fetched time,
      last successful run, safe error category and retry/lease state explicitly.
- [ ] Give each run a bounded work budget, concurrency lease and retry/backoff.
      Re-fetch a rolling correction window for revisable Google data; never treat a
      previous cursor as proof that all earlier dates are final.
- [ ] Wire an independent local scheduler and production trigger only after
      testing worker execution without a page, restart recovery, concurrent ticks,
      grant failure, throttling and retention of the last successful snapshot.
- [ ] Have dashboard queries read persisted snapshots and show actual source
      dates, completeness and last-success/error state separately from page refresh.
- [ ] Aggregate only matching metric definitions, units, dates, timezone,
      dimensions and freshness semantics. GSC clicks and GA4 sessions are not a shared
      count; historical Bing totals cannot be spliced into daily Google trends.
- [ ] Keep Bing, IndexNow, translations and task receipts labeled as imported
      evidence until their real upstream integrations are verified. An IndexNow
      submission does not establish indexing.
- [ ] Link skills to verified runs and outcome measurements before claiming
      efficacy. Purchase attribution and the Cue/Tinyclaw AI interface remain
      unverified. DataForSEO budget is unconfirmed; no new paid calls are authorized.
