import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Check } from "lucide-react";
import { SearchConsoleConnectionCard } from "@/client/features/gsc/SearchConsoleConnectionCard";
import { AUDIT_ISSUE_TYPES } from "@/shared/audit-issues";

import {
  formatCount,
  formatCtr,
  formatPosition,
} from "@/client/features/search-performance/SearchPerformanceColumns";
import { getSearchPerformanceReport } from "@/serverFunctions/searchPerformance";
import {
  CardShell,
  EmptyCardBody,
  formatDay,
  moreDetailsClass,
  newLost,
  PercentDelta,
  Stat,
} from "@/client/features/dashboard/cardParts";
import type {
  DashboardAuditSummary,
  DashboardBacklinkSummary,
} from "@/server/features/dashboard/services/DashboardService";

// Plain string-keyed view of the registry: issue types from the DB are not
// statically guaranteed to be registry keys.
const issueTitles: Record<string, string | undefined> = Object.fromEntries(
  Object.entries(AUDIT_ISSUE_TYPES).map(([key, value]) => [key, value.title]),
);

export function GscCard({
  projectId,
  connected,
}: {
  projectId: string;
  connected: boolean;
}) {
  const reportQuery = useQuery({
    queryKey: ["dashboardGscReport", projectId],
    queryFn: () =>
      getSearchPerformanceReport({
        data: { projectId, dateRange: "last_28_days" },
      }),
    enabled: connected,
  });

  // Not connected (or a dead grant discovered by the report call): the
  // connection card sells and runs the whole flow itself.
  if (!connected || (reportQuery.data && !reportQuery.data.connected)) {
    return (
      <div id="connect-gsc">
        <SearchConsoleConnectionCard projectId={projectId} />
      </div>
    );
  }

  const report = reportQuery.data;

  return (
    <CardShell
      title="Search performance"
      stamp={
        report?.connected
          ? `Google Search Console · ${report.range.startDate} to ${report.range.endDate} · PT (America/Los_Angeles) · finalized data only · compared with ${report.range.prevStartDate} to ${report.range.prevEndDate}`
          : "Google Search Console"
      }
      action={
        <Link
          to="/p/$projectId/search-performance"
          params={{ projectId }}
          className={moreDetailsClass}
        >
          More details
        </Link>
      }
    >
      {reportQuery.isPending ? (
        <div className="grid grid-cols-2 gap-3" aria-busy>
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="skeleton h-20" />
          ))}
        </div>
      ) : reportQuery.isError ? (
        <p className="text-sm text-base-content/60">
          Couldn&rsquo;t load Search Console data. Try again shortly.
        </p>
      ) : report?.connected ? (
        <>
          {report.totals.impressions === 0 ? (
            <p className="mb-3 text-sm text-base-content/60">
              No impressions were returned for this finalized-data window. CTR
              and average position are undefined.
            </p>
          ) : null}
          <div className="grid grid-cols-2 gap-3">
            <Stat
              label="Clicks"
              value={formatCount(report.totals.clicks)}
              sub={
                <PercentDelta
                  current={report.totals.clicks}
                  previous={report.prevTotals.clicks}
                />
              }
            />
            <Stat
              label="Impressions"
              value={formatCount(report.totals.impressions)}
              sub={
                <PercentDelta
                  current={report.totals.impressions}
                  previous={report.prevTotals.impressions}
                />
              }
            />
            <Stat label="CTR" value={formatCtr(report.totals.ctr)} />
            <Stat
              label="Avg position"
              value={formatPosition(report.totals.position)}
            />
          </div>
        </>
      ) : null}
    </CardShell>
  );
}

export function AuditHealthCard({
  projectId,
  audit,
}: {
  projectId: string;
  audit: DashboardAuditSummary | null;
}) {
  if (!audit) {
    return (
      <CardShell title="Site audit">
        <EmptyCardBody
          message="Crawl your site for broken links, missing tags and indexability problems."
          cta={
            <Link
              to="/p/$projectId/audit"
              params={{ projectId }}
              className="btn btn-primary btn-sm"
            >
              Run an audit
            </Link>
          }
        />
      </CardShell>
    );
  }

  return (
    <CardShell
      title="Site audit"
      stamp={`Site audit · ${
        audit.status === "completed"
          ? `crawled ${audit.pagesCrawled} pages · ${formatDay(audit.startedAt)}`
          : audit.status === "running"
            ? "crawl in progress"
            : "last crawl failed"
      }`}
      action={
        <Link
          to="/p/$projectId/audit"
          params={{ projectId }}
          className={moreDetailsClass}
        >
          More details
        </Link>
      }
    >
      {audit.status !== "completed" || audit.pagesCrawled === 0 ? (
        <p className="mb-3 text-sm text-base-content/70">
          {audit.status === "failed"
            ? "The last crawl failed. Results may be incomplete; rerun the audit before assessing site health."
            : audit.status === "running"
              ? "Crawl in progress. Results are incomplete until it finishes."
              : "No pages were crawled. Site health could not be assessed."}
        </p>
      ) : audit.topIssues.length === 0 ? (
        <div className="flex items-center gap-2 text-sm text-base-content/70">
          <Check className="size-4 text-success" />
          No issues found in the {audit.pagesCrawled} pages crawled.
        </div>
      ) : null}
      {audit.topIssues.length > 0 ? (
        <ul className="space-y-2">
          {audit.topIssues.map((issue) => (
            <li
              key={issue.issueType}
              className="flex items-center justify-between gap-2 text-sm"
            >
              <span className="flex min-w-0 items-center gap-2">
                <span
                  className={`size-2 shrink-0 rounded-full ${
                    issue.severity === "critical"
                      ? "bg-error"
                      : issue.severity === "warning"
                        ? "bg-warning"
                        : "bg-base-content/30"
                  }`}
                />
                <span className="truncate">
                  {issueTitles[issue.issueType] ?? issue.issueType}
                </span>
              </span>
              <span className="shrink-0 tabular-nums text-base-content/60">
                {issue.count} {issue.count === 1 ? "page" : "pages"}
              </span>
            </li>
          ))}
          {audit.totalIssueTypes > audit.topIssues.length ? (
            <li className="text-xs text-base-content/50">
              + {audit.totalIssueTypes - audit.topIssues.length} more issue
              {audit.totalIssueTypes - audit.topIssues.length === 1 ? "" : "s"}
            </li>
          ) : null}
        </ul>
      ) : null}
    </CardShell>
  );
}

export function BacklinkPulseCard({
  projectId,
  backlinks,
  refreshing,
  failed = false,
}: {
  projectId: string;
  backlinks: DashboardBacklinkSummary | null;
  refreshing: boolean;
  failed?: boolean;
}) {
  if (!backlinks && refreshing) {
    return (
      <CardShell title="Backlink pulse" stamp="Taking your first snapshot…">
        <div className="grid grid-cols-2 gap-3" aria-busy>
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="skeleton h-20" />
          ))}
        </div>
      </CardShell>
    );
  }

  if (!backlinks) {
    return (
      <CardShell title="Backlink pulse">
        <p
          className="text-sm text-base-content/60"
          role={failed ? "alert" : undefined}
        >
          {failed
            ? "Could not load a backlink snapshot. Check DataForSEO configuration, account balance and provider availability before retrying. No backlink totals are available."
            : "No backlink snapshot is available yet. Snapshots require a configured DataForSEO account and may incur provider charges."}
        </p>
      </CardShell>
    );
  }

  return (
    <CardShell
      title="Backlink pulse"
      stamp={`Backlinks · snapshot ${formatDay(backlinks.capturedAt)}${
        refreshing ? " · refreshing…" : ""
      }`}
      action={
        <Link
          to="/p/$projectId/backlinks"
          params={{ projectId }}
          search={{ target: backlinks.domain, scope: "domain" }}
          className={moreDetailsClass}
        >
          More details
        </Link>
      }
    >
      {failed || backlinks.stale ? (
        <p role="alert" className="mb-4 text-sm text-warning">
          {failed ? "Refresh failed." : "This snapshot is stale."} Showing
          previously captured data, not current totals.
        </p>
      ) : null}
      <div className="grid grid-cols-2 gap-3">
        <Stat
          label="Ref. domains"
          value={
            backlinks.referringDomains === null
              ? "—"
              : backlinks.referringDomains.toLocaleString()
          }
        />
        <Stat
          label="Backlinks"
          value={
            backlinks.backlinks === null
              ? "—"
              : backlinks.backlinks.toLocaleString()
          }
        />
        <Stat
          label="New links"
          value={`▲ ${newLost(backlinks.newBacklinks)}`}
          tone={
            backlinks.newBacklinks && backlinks.newBacklinks > 0
              ? "success"
              : undefined
          }
        />
        <Stat
          label="Lost links"
          value={`▼ ${newLost(backlinks.lostBacklinks)}`}
          tone={
            backlinks.lostBacklinks && backlinks.lostBacklinks > 0
              ? "error"
              : undefined
          }
        />
      </div>
    </CardShell>
  );
}
