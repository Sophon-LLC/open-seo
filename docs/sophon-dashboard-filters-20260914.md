# Dashboard filters — local acceptance, 2026-09-14

## Scope and status

Implemented the approved traffic/indexing/content layout in Sophon-LLC/open-seo,
branch `codex/data-visibility-20260914`. Changes are modified locally, not committed
or pushed. Local Docker deployment uses `sophon/open-seo:filters-20260914`, exposed
only at 127.0.0.1:3014. No Cue Desktop code changes or new paid provider calls.
Existing unrelated worktree changes were preserved.

## Behavior

- Traffic filters: 7/28/90 days, explicit custom interval, channel and reset.
- Four metric buttons control one daily search trend; queries/pages/countries
  provide bounded details. Text search and sorting explicitly apply to loaded rows.
- GSC and GA4 receive the same explicit dates, retaining their source timezones.
- Historical evidence has independent channel/status/date filters. Period overlap
  retains a whole reported total; undated sources are excluded from dated filters.
- IndexNow receipts are not presented as indexing confirmations. Bing lacks daily
  history and therefore remains aggregate evidence rather than an invented chart.
- Setup and source explanations are collapsed. Mobile filters wrap and KPI cards
  form two columns; the document does not overflow horizontally at 390px.

## Verification

TDD covered date validation, request propagation, previous periods, stale-data
isolation, history filtering and availability guards. Final targeted suite:
76 tests across 16 files passed. TypeScript noEmit and git diff --check passed.
Docker client, SSR and audit-worker builds passed.

Edge checks against the local deployed app:

| Interval         | Clicks | Impressions |  CTR | Position |
| ---------------- | -----: | ----------: | ---: | -------: |
| Aug 15–Sep 11    |     73 |       4,316 | 1.7% |     16.8 |
| Sep 5–11         |     17 |       1,334 | 1.3% |      8.7 |
| Sep 2–8 (custom) |     18 |       1,109 | 1.6% |      9.4 |
| Jun 14–Sep 11    |    138 |       7,701 | 1.8% |     15.4 |

Verified metric switching, page/country detail changes, loaded-row search, channel
selection, reset and custom-date errors. Final image also verified the native
date input fix: historical Sep 9–14 shows three matching IndexNow records, not
the six unfiltered records; Sep 15–14 shows a range error. Valid custom Sep 2–8
updates both traffic sources. Browser console errors: none observed.

## Remaining data limits

GA4 returned no rows in these tested intervals; traffic is unknown, not zero.
Purchase attribution is unavailable. Bing is historical evidence, not a live
connection. Google page-indexing status is not connected in this dashboard.
These limitations are shown in the UI and were not relabeled as completed work.

The prior `charts-20260914` image remains available for local rollback. No public
deployment was performed. Edge is left on the default 28-day dashboard with the
temporary mobile viewport override removed.
