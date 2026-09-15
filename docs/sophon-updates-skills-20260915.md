# Dashboard refresh and growth skills library — 2026-09-15

## Shipped scope (local pilot)

- Dashboard visible-page polling every five minutes, with pause and manual refresh.
- Explicit allow-list: active project GSC, GA4, search breakdown and imported channel reports. Inactive dates, other projects, disabled connections, paid research and mutations are excluded.
- Hidden/offline pages do not poll. Failure leaves Query cache data intact and reports an error; source dates remain authoritative.
- Closing the page stops refresh. This is **not** an unattended server sync worker. Upstream Bing/IndexNow/translation/task workflows remain unchanged; imported evidence does not become live data by re-reading it.
- SEO/GEO catalog is shared by the dashboard and AI/MCP page, with purpose/category filtering, source links, known local declared versions and explicit unverified execution/impact states.
- MarketingSkills repository metadata was read from the public GitHub API on 2026-09-15: 50,259 stars, MIT, last pushed 2026-09-05. It is a snapshot, not live metadata or proof of effectiveness. Local files were observed on the operator workstation, not installed in the web server. Exact upstream revision is not verified.

## Verification

- Real TanStack QueryClient/QueryObserver regression tests cover project isolation, disabled/inactive queries, paid-query exclusion and failure preserving data.
- Catalog filtering and rendered provenance/status tests.
- 47 tests across 10 dashboard/navigation/catalog suites passed; TypeScript check passed. Existing Recharts SSR tests emit dimension warnings because they do not have a browser layout.
- Local image: `sophon/open-seo:updates-skills-20260915`; database volume and runtime credentials unchanged; bound to loopback only.
- Container health passed. Edge browser confirmed the refresh request completed with a checked-at timestamp, GEO + citation search returned only `ai-seo`, a non-matching search showed the empty state, and clearing restored eight entries. At 390px viewport the document scroll width was 390px. No frontend error logs were observed. Viewport override was reset.

## Remaining scope

- Durable server-side ingestion with per-provider cursors, freshness/coverage, retries, locking and last-success status must be implemented in the reporting middle layer before claiming unattended synchronization.
- Skills execution evidence, impact attribution, and upstream revision/update review are not connected. No autonomous installation or upgrades.
- No Cue Desktop code changes, public deployment or paid research requests were introduced by this change.
