# Dashboard data freshness repair — 2026-09-15

## Root cause

Dashboard presets subtracted three days from the Pacific calendar date and all
Search Performance requests forced `dataState: final`. The mounted dashboard
retained the original date window when its refresh timer ran. A successful
refresh therefore did not mean the requested date range advanced.

## Repair

- Dashboard presets request through today's PT date; Google determines which
  requested days have observations. Existing non-dashboard callers retain the
  final-data default.
- Dashboard defaults to `all` (latest available) with an explicit final-only
  selector. Daily totals, country rows, paginated details and export accept the
  same validated data state. Cache keys distinguish freshness modes.
- Show the last daily date actually returned by Google separately from requested
  dates. Do not fabricate missing days or declare all returned days final.
- Suppress partial-period growth deltas in latest mode and when final data has
  not reached the requested end date.
- Refresh advances 7/28/90-day presets across PT midnight, while applied custom
  dates remain fixed. Automatic refresh pauses while hidden/offline and checks
  again when visible/online. It is not a server-side unattended sync.

## Validation and rollout

- Red/green regressions: PT cutoff, rolling vs custom dates, actual RPC to Google
  boundary with all/final modes, cache separation and partial-data UI labels.
- 67 related tests and `tsc --noEmit` passed. SSR chart size warnings are caused
  by the test renderer having no viewport; real-browser layout requires checking.
- Local image: `sophon/open-seo:fresh-dates-20260915`.
- Rollback image: `sophon/open-seo:updates-skills-20260915`; retain data volume and
  Google grants. No Cue Desktop edits, paid provider requests or publishing.
- Local rollout only; these changes have not been committed or pushed.

## Live Edge verification

- Latest mode actually returned Google daily observations through 2026-09-14;
  final-only mode returned through 2026-09-12. These are PT source dates, not
  claims that Google has finalized September 14.
- Requested 28-day range 2026-08-18–2026-09-14: 67 clicks, 4,399 impressions
  at verification. Latest observations may subsequently be revised.
- Applied custom 2026-09-05–2026-09-11, manually refreshed successfully; dates
  stayed fixed. Reset returned to latest mode and the 28-day preset.
- 390-pixel viewport: document width 390, no horizontal page overflow; date and
  freshness controls readable. Viewport override reset after verification.
- GA4 still returns no rows and is labeled unknown, not zero traffic.
