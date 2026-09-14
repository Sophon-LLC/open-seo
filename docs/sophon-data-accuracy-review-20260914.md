# OpenSEO first-party data accuracy review — 2026-09-14

## Scope and evidence boundary

- Reviewed source: OpenSEO `v0.1.8`, Git SHA `7b9ee0e4fa800e5bae9ca76f49cb273a9c677204`.
- Purpose: determine whether the current GSC/GA4 pipeline supports trustworthy decisions about search impressions, clicks/CTR, organic users, and purchase outcomes.
- Reviewed the actual client → server function → service → Google adapter path, existing tests, and three isolated reproductions. No real property reports, account data, credentials, browser sessions, or paid provider calls were used.
- The initial audit was read-only. Subsequent authorized fixes for all three findings were integrated locally; the initial counterexamples below describe the upstream baseline, not the patched runtime. Concurrent auth-client changes were independently reviewed.
- The findings are source/runtime defects, **not claims that current Cue analytics have been affected**. Live validation remains necessary after OAuth/property binding.

## Result

Three actionable defects were reproduced against the baseline and corrected locally with regression tests. Existing baseline tests passed, but did not cover these counterexamples. Do not treat the dashboard as a verified purchase/conversion dashboard merely because Google authorization succeeds.

## Integrated fix verification

- GSC fixed-day ranges contain exactly 7/28 dates. The final integrated revision anchors relative ranges to the provider's Pacific calendar, requests finalized data only, and preserves the three-day lag. Actual dates and provider timezones must be used when comparing GSC with GA4.
- GA4 dashboard source, date ranges, property timezone/currency, quality metadata and warnings are preserved. Missing/restricted totals and trend dates remain `null`; measured zero remains zero. Incomplete/limited comparisons are suppressed.
- Landing-page normalization collisions retain their original GA4 rows, expose ambiguous joins and withhold authoritative scores. The implementation does not sum distinct users or rates without a valid aggregation contract.
- The local self-hosted client no longer subscribes to a deliberately absent Better Auth session endpoint. Server authorization and hosted-mode authentication are unchanged.
- Integrator verification: 109 tests in 15 files passed, TypeScript passed, type-aware lint reported zero warnings/errors, and `git diff --check` passed. Independent review of the dashboard projection/UI found no blocking issue (22 focused tests; overlapping, not additional to the integrated total).
- UI, live property reconciliation and local container readiness are separate deployment checks. Account analytics and credentials are not part of this public source report.

### Final dashboard and export follow-up

- GSC rate and position are unavailable when there are no impressions; measured zero clicks with impressions remains a real zero CTR. Calendar tests cover UTC/Pacific midnight and DST boundaries; explicit user dates are preserved.
- Failed, running, never-run and zero-page site audits do not display a healthy verdict. Missing, failed and stale dashboard/backlink sources are visibly qualified instead of being converted into empty or current healthy results. No paid provider was configured or called.
- Query/page exports retain the actual reporting period, PT/finalized-data context, the 1,000-row cap and potential truncation. Striking-distance UI and exports disclose the bounded top query-page input, best returned page per query, positions 5–20 and maximum 100 candidates. Empty candidates are not described as no site-wide opportunities. CSV/Sheets sanitization is preserved.
- Integration verification: 151 tests in 19 files passed, full TypeScript passed, touched-file type-aware lint/format checks and diff checks passed. The final export patch also passed an independent 8-test run. These are overlapping checks, not additive totals.
- Core fixes are recorded in fork PR #1; container installation and live-data acceptance are recorded separately. The historical audit sections below retain the state and evidence at the time each baseline finding was investigated.

### Provider setup UX follow-up

- [Website integration issue #147](https://github.com/Sophon-LLC/heycue-site/issues/147) records a live-browser reproduction: the missing-DataForSEO modal returned after every route change and described the paid provider as a prerequisite for the whole application, despite an independently working Google report.
- Removed the global modal and its route-triggered state/effects. The non-blocking notice limits the missing setup to provider-backed keyword, SERP and backlink features, explains separate Google authorization, and discloses potential provider charges. A failed configuration check remains unknown rather than falsely reporting a missing key.
- Existing server-side provider gates, Google permissions, hosted authentication, database schema and paid-provider configuration are unchanged.
- Final integration suite: 154 tests across 20 relevant files passed, plus full TypeScript, touched-file type-aware lint, formatting and diff checks. The three rendered-component tests passed independently. These component tests do not by themselves establish browser navigation behavior; that is a separate local deployment acceptance check.
- Local acceptance completed on the source overlay from commit `9027c0e`, image `sophon/open-seo:data-accuracy-20260914-final` (image config SHA-256 `09cedb890d1471806a5923458f77fc5994871e14eb2d0765155a0d26f343d35e`). The container is healthy and published only on `127.0.0.1:3014`; the data volume and existing grants were retained with a private offline backup.
- Real Edge verification: dashboard reload, GSC navigation and return navigation rendered without the removed setup modal. GSC totals and the exact reporting period remained visible. The connected GA4 report returned no rows and remained explicitly unknown rather than zero. Neither connection state nor this UI test proves purchase attribution, complete Google/Bing indexing or measured SEO/GEO uplift.

### 1. P1 — GSC “Last 7/28 days” requests 8/29 inclusive days

**Evidence:** `src/server/features/gsc/searchAnalytics.ts:88–96` subtracts 7 or 28 from the inclusive end date. Google's Search Analytics API includes both boundaries and interprets dates in Pacific Time. See the [official request contract](https://developers.google.com/webmaster-tools/v1/searchanalytics/query).

Before the fix, direct execution of the real `resolveDateRange` export with `2026-09-14T02:00:00Z` produced:

| Label        | Actual start | Actual end | Inclusive days |
| ------------ | ------------ | ---------- | -------------: |
| Last 7 days  | 2026-09-04   | 2026-09-11 |              8 |
| Last 28 days | 2026-08-14   | 2026-09-11 |             29 |

Baseline reproduction (no API/network access; the fixed revision now reports 7/28 days):

```sh
node --experimental-strip-types --input-type=module -e '
import { resolveDateRange } from "./src/server/features/gsc/searchAnalytics.ts";
for (const dateRange of ["last_7_days", "last_28_days"]) {
  const r = resolveDateRange({dateRange}, new Date("2026-09-14T02:00:00Z"));
  console.log({dateRange, ...r,
    inclusiveDays:(Date.parse(r.endDate)-Date.parse(r.startDate))/86400000+1});
}'
```

**Impact:** totals and CTR represent the wrong requested window. Previous-period totals are equal-length but also use the unintended length. Comparisons against the Google UI or GA4's 28-day window are misleading. The baseline GSC test named “computes a 28-day window” explicitly expected a 29-day inclusive interval, so its pass was not a correctness guarantee.

**Smallest correction:** subtract 6/27 for fixed-day ranges; add assertions on inclusive-day count rather than only hard-coded endpoints. Define a consistent Pacific-Time anchor and test UTC/Pacific midnight boundaries: the current helper anchors to UTC while the provider defines PT dates. Retain and show the actual resolved dates; do not silently assert that GSC and GA4 windows/timezones match.

**Acceptance:** 7/28 requested days produce exactly 7/28 dates, previous windows have the same length without overlap, and boundary/DST cases preserve provider-calendar semantics.

**Authorized follow-up — fixed locally:** `searchAnalytics.ts` now subtracts 6/27 for the two fixed-day ranges. The only application/test files changed are `src/server/features/gsc/searchAnalytics.ts` and `searchAnalytics.test.ts`. No month-range semantics, UTC anchor, lag policy, GA4 implementation, schema, permissions, or paid service was changed. Provider-calendar timezone alignment therefore remains a separate decision, not a claim of this fix.

TDD evidence:

1. New 7-day regression failed first: actual start `2026-05-18`, expected `2026-05-19`; changing the subtraction to 6 made it pass.
2. Corrected 28-day regression failed first: actual start `2026-04-27`, expected `2026-04-28`; changing the subtraction to 27 made it pass.
3. Request-boundary regressions cover both windows across a normal February, leap-day February, and year rollover; an explicit single-day range remains unchanged. Existing month, filters, date-floor, and previous-period tests still pass.
4. **66 tests in 6 files passed** after the fix: the complete GSC test folder, Google client seam, MCP Search Console tools, and GA4 search-opportunity service tests. Prettier checks on both owned source/test files and `git diff --check` pass.

Verification command:

```sh
pnpm exec vitest run src/server/features/gsc \
  src/server/lib/gscClient.test.ts \
  src/server/mcp/tools/search-console-tools.test.ts \
  src/server/features/ga4/services/SearchOpportunityService.test.ts
```

Status: modified and tested locally; **not committed, pushed, deployed, or verified against a live Google property by this audit agent**.

### 2. P1 — GA4 quality limitations are discarded; unknown trend values become zero

**Evidence:**

- `Ga4ReportNormalization.ts` retains restricted metrics as `null`, plus sampling, thresholding, empty reasons, and `hasLimitedData`.
- `Ga4OrganicOverviewService.ts:115–149` retains those limitations, actual dates, property identity/timezone/currency, and truncation warnings.
- `src/serverFunctions/ga4.ts:103–117` discards that context and returns only four totals, previous totals, and a trend.
- `src/serverFunctions/ga4.ts:69–89` skips null session values and then fills every unrepresented day with `0`, even when the source is incomplete or restricted.
- `src/client/features/dashboard/Ga4Card.tsx:118–124` uses `!report.totals.sessions`, so both `null` and measured `0` render “No organic search traffic recorded …”.

**Executed counterexample:** an in-memory harness transpiled and executed the actual `getGa4DashboardReport` handler, stubbing only its service/framework dependencies. The explicitly synthetic overview had `sessions: null`, `activeUsers: 7`, a restricted session trend value, `hasLimitedData: true`, and `trend_truncated`. Actual output:

```json
{
  "connected": true,
  "totals": {
    "sessions": null,
    "activeUsers": 7,
    "engagementRate": null,
    "keyEvents": null
  },
  "trend": [
    { "date": "2026-09-10", "sessions": 0 },
    { "date": "2026-09-11", "sessions": 0 }
  ],
  "qualityMetadataPreserved": false,
  "warningsPreserved": false,
  "propertyPreserved": false,
  "uiEmptyPredicate": true
}
```

The last four fields are harness checks, not application API fields. No browser rendering or live Google response was claimed.

**Impact:** missing/limited data can look like zero traffic and a complete flatline, with no visible warning. Positive but sampled/thresholded totals can also look fully authoritative. Users cannot validate which property and exact calendar range generated a card.

**Smallest correction:** preserve the report's source, resolved/previous dates, timezone, currency, metadata and warnings in the dashboard response. Distinguish connected-but-unknown, complete-empty, measured-zero, and complete-with-data. Do not zero-fill restricted/incomplete trends; expose gaps and limitations. Suppress authoritative comparison claims when the comparison is limited.

**Acceptance:** a restricted or missing session total renders an unavailable/limited state, not “no traffic”; limited trend dates remain unknown; measured zero remains zero; real complete missing-day semantics may be zero-filled only with an explicit completeness guarantee. Add a server-function seam regression and a component state test.

### 3. P1 — Normalized landing-page collisions silently overwrite traffic/revenue

**Evidence:** `SearchOpportunityService.ts:71–73` removes trailing slashes and ignores query strings. `SearchOpportunityService.ts:149–159` subsequently stores GA4 rows in a one-row-per-normalized-key `Map`, unconditionally overwriting an earlier row. There is no collision disclosure; scoring and coverage still appear complete.

**Executed counterexample:** an in-memory harness ran the actual `SearchOpportunityService.getOpportunities` with synthetic service responses:

| Input GA4 path | Sessions | Transactions | Purchase revenue |
| -------------- | -------: | -----------: | ---------------: |
| `/pricing`     |      100 |            2 |              500 |
| `/pricing/`    |       20 |            1 |               90 |

Both join to `example.com/pricing`. Original input order returned only **20 sessions / 1 transaction / 90 revenue**. Reversing the same two input rows returned only **100 / 2 / 500**. Both claimed `unmatchedGa4Rows: 0` and `scoreDataLimited: false`.

**Impact:** canonical/legacy URL variants can make a page's business-value score and revenue depend on source row order, causing prioritization to ignore actual purchases. This is conditional on a normalization collision; it is not proof such a collision currently exists in Cue data.

**Smallest correction:** preserve exact join grain or explicitly detect collisions and mark the candidate ambiguous/unscored. If verified canonical variants are aggregated, design metric-specific aggregation: simple addition is not valid for distinct active users or rates. Rates require valid denominators and active users may require a provider-side requery. Expose collision coverage instead of claiming all rows matched cleanly.

**Acceptance:** reversing input row order cannot change an attributed result. A collision either produces a verified, correctly aggregated report or a visible ambiguous state with no authoritative score. Add a service seam test using the two paths above.

## Checks that passed / useful existing foundations

- **54 tests in 9 files passed** on this revision: GSC request shaping, totals and previous periods; GA4 reporting/comparison, overview, report enhancements, connection binding, measurement-health and search opportunities.
- GSC total CTR is calculated from summed clicks divided by summed impressions; position is impression-weighted (`searchPerformanceReport.ts`). It is not an unweighted average of row CTR values.
- GA4's lower-level date resolver uses the bound property's timezone, excludes the current property-calendar day, defaults to 28 inclusive dates, and guards invalid or incomplete date pairs. Calendar-day completeness does not itself prove that upstream processing has finalized all data.
- Binding checks ensure the selected GA4 grant belongs to the user and the property is visible to that grant; metadata is fetched from the provider, including timezone and currency (`Ga4Service.ts:86–131`). These tests are not proof the user-selected live property has been connected.
- Lower-level GA4 normalization and comparison retain nulls and suppress percentage changes without a valid prior denominator. Ecommerce activity has detected/none/unknown states when reports are incomplete or limited.
- GSC/GA4 reconnect/property failures are separate from rate limit and upstream errors in services. The GA4 card currently collapses error details to a generic retry message; API-disabled faults therefore require checking the retained server error rather than expecting a useful UI remediation.

Executed test command:

```sh
pnpm exec vitest run \
  src/server/features/gsc/searchAnalytics.test.ts \
  src/server/features/gsc/searchPerformanceReport.test.ts \
  src/server/features/ga4/services/Ga4ReportingService.test.ts \
  src/server/features/ga4/services/Ga4ReportingService.comparison.test.ts \
  src/server/features/ga4/services/Ga4OrganicOverviewService.test.ts \
  src/server/features/ga4/services/Ga4ReportEnhancements.test.ts \
  src/server/features/ga4/services/SearchOpportunityService.test.ts \
  src/server/features/ga4/services/Ga4Service.test.ts \
  src/server/features/ga4/services/Ga4MeasurementHealthService.test.ts
```

## Required boundary for the first live-data dashboard

This is a product acceptance boundary, not a fourth reproduced bug:

- GSC clicks, GA4 sessions/users, key events, completed downloads, and verified purchases are distinct measures. Do not relabel generic key events as purchases or download-link clicks as completed downloads.
- The overview service already requests `transactions` and `purchaseRevenue`, but the current dashboard response/card does not display them. A purchase panel must retain property currency and link to a documented purchase definition. GA4-reported transactions are not automatically reconciled paid orders or revenue net of refunds.
- Before showing a conversion funnel, validate measurement health, explicit event names, deduplication, landing-path attribution, consent/filter limitations, and source-period alignment. Keep unavailable stages visible as unavailable; do not create zeroes.
- Use actual landing paths for attribution until the website's known `page_variant=home` classification issue is independently resolved; that website issue is outside this review's source scope.
- OAuth, API enablement, property binding, and a successful live read must each be verified separately. This review performs none of them.
