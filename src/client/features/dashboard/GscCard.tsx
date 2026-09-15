import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { ReportDates } from "@/types/schemas/reportDates";
import { SearchDetails } from "./SearchDetails";
import { DailyTrend } from "./DailyTrend";
import { SearchConsoleConnectionCard } from "@/client/features/gsc/SearchConsoleConnectionCard";
import {
  formatCount,
  formatCtr,
  formatPosition,
} from "@/client/features/search-performance/SearchPerformanceColumns";
import { getSearchPerformanceReport } from "@/serverFunctions/searchPerformance";
import { CardShell, moreDetailsClass, PercentDelta, Stat } from "./cardParts";

export function GscCard({
  projectId,
  connected,
  dates,
  dataState = "final",
}: {
  projectId: string;
  connected: boolean;
  dates?: ReportDates;
  dataState?: "all" | "final";
}) {
  const [metric, setMetric] = useState<
    "clicks" | "impressions" | "ctr" | "position"
  >("clicks");
  const reportQuery = useQuery({
    queryKey: [
      ...(dates
        ? ["dashboardGscReport", projectId, dates]
        : ["dashboardGscReport", projectId]),
      ...(dataState === "all" ? ["all"] : []),
    ],
    queryFn: () =>
      getSearchPerformanceReport({
        data: { projectId, dateRange: "last_28_days", ...dates, dataState },
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
  const canCompare =
    dataState === "final" &&
    report?.connected &&
    report.freshness?.comparisonAvailable;

  return (
    <CardShell
      title="Search performance"
      stamp={
        report?.connected
          ? `Google Search Console · ${report.range.startDate} to ${report.range.endDate}`
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
          <div
            className="mb-4 space-y-1 text-sm text-base-content/70"
            aria-label="Google data availability"
          >
            <p>
              {dataState === "all"
                ? "Latest available — may include incomplete data. Partial-period growth comparisons are hidden."
                : "Final data only — recent days may not be available yet."}
            </p>
            <p>
              Last date returned by Google:{" "}
              {report.freshness?.lastAvailableDate ??
                "No daily observations returned"}
            </p>
            {dataState === "final" && !canCompare && (
              <p>
                Growth comparisons require daily observations for both complete
                periods.
              </p>
            )}
          </div>
          {report.totals.impressions === 0 ? (
            <p className="mb-3 text-sm text-base-content/60">
              No impressions were returned for this{" "}
              {dataState === "final" ? "finalized-data" : "requested"} window.
              CTR and average position are undefined.
            </p>
          ) : null}
          <div
            className="grid grid-cols-2 gap-3 lg:grid-cols-4"
            aria-label="Choose trend metric"
          >
            <button
              className={`rounded-box p-3 text-left ${metric === "clicks" ? "ring-2 ring-primary bg-primary/5" : "hover:bg-base-200"}`}
              aria-pressed={metric === "clicks"}
              onClick={() => setMetric("clicks")}
            >
              <Stat
                label="Clicks"
                value={formatCount(report.totals.clicks)}
                sub={
                  canCompare && (
                    <PercentDelta
                      current={report.totals.clicks}
                      previous={report.prevTotals.clicks}
                    />
                  )
                }
              />
            </button>
            <button
              className={`rounded-box p-3 text-left ${metric === "impressions" ? "ring-2 ring-primary bg-primary/5" : "hover:bg-base-200"}`}
              aria-pressed={metric === "impressions"}
              onClick={() => setMetric("impressions")}
            >
              <Stat
                label="Impressions"
                value={formatCount(report.totals.impressions)}
                sub={
                  canCompare && (
                    <PercentDelta
                      current={report.totals.impressions}
                      previous={report.prevTotals.impressions}
                    />
                  )
                }
              />
            </button>
            <button
              className={`rounded-box p-3 text-left ${metric === "ctr" ? "ring-2 ring-primary bg-primary/5" : "hover:bg-base-200"}`}
              aria-pressed={metric === "ctr"}
              onClick={() => setMetric("ctr")}
            >
              <Stat label="CTR" value={formatCtr(report.totals.ctr)} />
            </button>
            <button
              className={`rounded-box p-3 text-left ${metric === "position" ? "ring-2 ring-primary bg-primary/5" : "hover:bg-base-200"}`}
              aria-pressed={metric === "position"}
              onClick={() => setMetric("position")}
            >
              <Stat
                label="Avg position"
                value={formatPosition(report.totals.position)}
              />
            </button>
          </div>
          <div className="mt-6">
            <DailyTrend
              label={
                {
                  clicks: "Clicks",
                  impressions: "Impressions",
                  ctr: "CTR",
                  position: "Average position (lower is better)",
                }[metric]
              }
              percent={metric === "ctr"}
              rows={(report.trend ?? []).map((day) => ({
                date: day.date,
                value: day[metric],
              }))}
            />
          </div>
          <details className="my-3 text-xs text-base-content/60">
            <summary className="cursor-pointer py-2">
              Source & comparison
            </summary>
            PT (America/Los_Angeles) · Web search ·{" "}
            {dataState === "final"
              ? "finalized data only"
              : "latest available; may be revised"}{" "}
            · reference period {report.range.prevStartDate} to{" "}
            {report.range.prevEndDate}. Missing daily observations are gaps, not
            zero traffic. CTR is clicks / impressions; position is
            impression-weighted.
          </details>
          <SearchDetails
            key={`${report.range.startDate}:${report.range.endDate}:${dataState}`}
            dataState={dataState}
            projectId={projectId}
            dates={report.range}
            countries={report.countries}
          />
        </>
      ) : null}
    </CardShell>
  );
}
