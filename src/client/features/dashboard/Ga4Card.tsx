import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { DailyTrend } from "./DailyTrend";
import type { ReportDates } from "@/types/schemas/reportDates";
import {
  CardShell,
  moreDetailsClass,
  PercentDelta,
  Stat,
} from "@/client/features/dashboard/cardParts";
import { Ga4ConnectCard } from "@/client/features/dashboard/Ga4ConnectCard";
import {
  formatCount,
  formatCtr,
} from "@/client/features/search-performance/SearchPerformanceColumns";
import { getGa4DashboardReport } from "@/serverFunctions/ga4";
import type { Ga4DashboardReport } from "@/server/features/ga4/services/Ga4DashboardService";

function qualityNotices(report: Ga4DashboardReport): string[] {
  const notices = report.reportMetadata.reports.flatMap((metadata, index) => {
    const period = ["Current period", "Previous period", "Daily trend"][index];
    const details: string[] = [];
    for (const sample of metadata.sampling) {
      details.push(
        `sampled data (samples read: ${sample.samplesReadCount}; sampling space: ${sample.samplingSpaceSize})`,
      );
    }
    if (metadata.subjectToThresholding) {
      details.push("thresholding may withhold data");
    }
    if (metadata.restrictedMetrics.length) {
      details.push(
        `restricted metrics: ${metadata.restrictedMetrics.map((metric) => metric.metricName).join(", ")}`,
      );
    }
    if (metadata.dataLossFromOtherRow) {
      details.push("data loss from the (other) row");
    }
    if (metadata.emptyReason) {
      details.push(`GA4 empty reason: ${metadata.emptyReason}`);
    }
    if (metadata.hasLimitedData && !details.length) {
      details.push("GA4 reports limited data");
    }
    return details.map((detail) => `${period}: ${detail}.`);
  });
  for (const warning of report.warnings) {
    notices.push(
      warning === "trend_truncated"
        ? "Daily trend is truncated; not all rows were returned."
        : warning === "end_date_clamped"
          ? "The requested end date was limited to the last complete property day."
          : `GA4 warning: ${warning}.`,
    );
  }
  return notices;
}

function statValue(
  value: number | null,
  format: (value: number) => string,
): string {
  return value === null ? "—" : format(value);
}

function statDelta(
  current: number | null,
  previous: number | null,
  comparisonAvailable: boolean,
) {
  return comparisonAvailable && current !== null && previous !== null ? (
    <PercentDelta current={current} previous={previous} />
  ) : undefined;
}

export function Ga4Card({
  projectId,
  connected,
  dates,
}: {
  projectId: string;
  connected: boolean;
  dates?: ReportDates;
}) {
  const reportQuery = useQuery({
    queryKey: dates
      ? ["dashboardGa4Report", projectId, dates]
      : ["dashboardGa4Report", projectId],
    queryFn: () => getGa4DashboardReport({ data: { projectId, ...dates } }),
    enabled: connected,
  });

  // Not connected (or a dead grant discovered by the report call): the
  // connection card sells and runs the whole flow itself.
  if (!connected || (reportQuery.data && !reportQuery.data.connected)) {
    return <Ga4ConnectCard projectId={projectId} connected={connected} />;
  }

  const report = reportQuery.data;
  const notices = report?.connected ? qualityNotices(report) : [];
  const comparisonAvailable = Boolean(
    report?.connected &&
    report.currentRowReturned &&
    !report.reportMetadata.hasLimitedData &&
    !notices.length,
  );

  return (
    <CardShell
      title="Organic traffic"
      stamp={
        report?.connected
          ? `Google Analytics · ${report.request.resolvedDateRange.startDate} – ${report.request.resolvedDateRange.endDate}`
          : "Google Analytics"
      }
      action={
        <Link
          to="/p/$projectId/settings"
          params={{ projectId }}
          hash="google-analytics"
          className={moreDetailsClass}
        >
          Manage
        </Link>
      }
    >
      {reportQuery.isPending ? (
        <div className="space-y-3" aria-busy>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="skeleton h-16" />
            ))}
          </div>
          <div className="skeleton h-24" />
        </div>
      ) : reportQuery.isError ? (
        <p className="text-sm text-base-content/60">
          Couldn&rsquo;t load Google Analytics data. Try again shortly.
        </p>
      ) : report?.connected ? (
        <div className="space-y-4">
          <details className="space-y-1 text-xs text-base-content/60 break-words">
            <summary className="cursor-pointer py-1">
              Property & source details
            </summary>
            <p className="font-medium text-base-content">
              {report.source.propertyDisplayName || "Google Analytics property"}
              {" · "}
              {report.source.propertyId}
            </p>
            <p>
              Previous period: {report.request.previousDateRange.startDate}
              {" – "}
              {report.request.previousDateRange.endDate}
            </p>
            <p>
              {report.request.propertyTimeZone
                ? `Timezone: ${report.request.propertyTimeZone}`
                : "Property timezone not reported"}
              {" · "}
              {report.request.currencyCode
                ? `Currency: ${report.request.currencyCode}`
                : "Currency not reported"}
            </p>
          </details>
          {!report.currentRowReturned ? (
            <p className="text-sm text-base-content/60">
              GA4 returned no rows for this period. Traffic totals are unknown,
              not zero.
            </p>
          ) : report.totals.sessions === null ? (
            <p className="text-sm text-base-content/60">
              Organic session count unavailable. Missing values are shown as —,
              not zero.
            </p>
          ) : report.totals.sessions === 0 ? (
            <p className="text-sm text-base-content/60">
              GA4 reports 0 organic sessions for this period.
            </p>
          ) : null}
          {notices.length || report.reportMetadata.hasLimitedData ? (
            <div
              className="space-y-1 rounded-md border border-warning/30 bg-warning/10 p-3 text-xs break-words"
              role="status"
            >
              <p className="font-medium">Data quality limitations</p>
              <p>
                Period comparisons unavailable because GA4 reports incomplete or
                restricted data.
              </p>
              {notices.length ? (
                <ul className="list-disc space-y-1 pl-4">
                  {notices.map((notice) => (
                    <li key={notice}>{notice}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat
              label="Sessions"
              value={statValue(report.totals.sessions, formatCount)}
              sub={statDelta(
                report.totals.sessions,
                report.prevTotals.sessions,
                comparisonAvailable,
              )}
            />
            <Stat
              label="Active users"
              value={statValue(report.totals.activeUsers, formatCount)}
              sub={statDelta(
                report.totals.activeUsers,
                report.prevTotals.activeUsers,
                comparisonAvailable,
              )}
            />
            <Stat
              label="Engagement rate"
              value={statValue(report.totals.engagementRate, formatCtr)}
            />
            <Stat
              label="Key events"
              value={statValue(report.totals.keyEvents, formatCount)}
              sub={statDelta(
                report.totals.keyEvents,
                report.prevTotals.keyEvents,
                comparisonAvailable,
              )}
            />
          </div>
          <p className="text-xs text-base-content/60">
            Purchase attribution is not available in this view. Key events are
            not necessarily purchases.
          </p>
          {report.trend.some((day) => day.sessions !== null) ? (
            <DailyTrend
              label="Organic sessions"
              rows={report.trend.map((day) => ({
                date: day.date,
                value: day.sessions,
              }))}
            />
          ) : (
            <p className="text-xs text-base-content/60">
              No daily session values were returned.
            </p>
          )}
          {report.trend.some((day) => day.sessions === null) ? (
            <p className="text-xs text-base-content/60">
              Unreported daily values remain gaps, not zero.
            </p>
          ) : null}
        </div>
      ) : null}
    </CardShell>
  );
}
