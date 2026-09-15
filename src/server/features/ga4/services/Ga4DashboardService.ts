import { shiftGa4Date } from "./Ga4Dates";
import { Ga4OrganicOverviewService } from "./Ga4OrganicOverviewService";

function overviewMetric(
  row: Record<string, string | number | null> | null,
  name: string,
): number | null {
  const value = row?.[name];
  return typeof value === "number" ? value : null;
}

/** Preserve the calendar without claiming that an unreported day is zero. */
function fillDailySessions(
  rows: Array<Record<string, string | number | null>>,
  range: { startDate: string; endDate: string },
): Array<{ date: string; sessions: number | null }> {
  const sessionsByDate = new Map<string, number | null>();
  for (const row of rows) {
    if (typeof row.date !== "string") {
      continue;
    }
    const iso = `${row.date.slice(0, 4)}-${row.date.slice(4, 6)}-${row.date.slice(6, 8)}`;
    sessionsByDate.set(iso, overviewMetric(row, "sessions"));
  }
  const days: Array<{ date: string; sessions: number | null }> = [];
  for (
    let date = range.startDate;
    date <= range.endDate;
    date = shiftGa4Date(date, 1)
  ) {
    days.push({ date, sessions: sessionsByDate.get(date) ?? null });
  }
  return days;
}

async function getReport(input: {
  projectId: string;
  startDate?: string;
  endDate?: string;
}) {
  const overview = await Ga4OrganicOverviewService.getOrganicOverview(input);
  const totals = (row: Record<string, string | number | null> | null) => ({
    sessions: overviewMetric(row, "sessions"),
    activeUsers: overviewMetric(row, "activeUsers"),
    engagementRate: overviewMetric(row, "engagementRate"),
    keyEvents: overviewMetric(row, "keyEvents"),
  });
  return {
    connected: true as const,
    source: overview.source,
    request: overview.request,
    reportMetadata: overview.reportMetadata,
    warnings: overview.warnings,
    currentRowReturned: overview.current !== null,
    totals: totals(overview.current),
    prevTotals: totals(overview.previous),
    trend: fillDailySessions(
      overview.trend,
      overview.request.resolvedDateRange,
    ),
  };
}

export const Ga4DashboardService = { getReport };
export type Ga4DashboardReport = Awaited<ReturnType<typeof getReport>>;
