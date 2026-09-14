import { GscService } from "@/server/features/gsc/services/GscService";
import { GscNotConnectedError } from "@/server/lib/gscErrors";
import {
  Ga4ReportingService,
  resolveGa4DateRange,
} from "@/server/features/ga4/services/Ga4ReportingService";
import { Ga4ReportError } from "@/server/lib/ga4Errors";
import { Ga4ConnectionRepository } from "@/server/features/ga4/repositories/Ga4ConnectionRepository";
import { ga4DateInTimeZone, shiftGa4Date } from "./Ga4Dates";

type SearchOpportunityInput = {
  projectId: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
};

type AnalyticsRow = Record<string, string | number | null>;

type Candidate = {
  page: string;
  normalizedPage: string | null;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  joinStatus: "joined" | "gsc_only" | "ambiguous";
  ga4Rows: AnalyticsRow[];
  ga4: {
    sessions: number | null;
    activeUsers: number | null;
    engagedSessions: number | null;
    engagementRate: number | null;
    keyEvents: number | null;
    sessionKeyEventRate: number | null;
    transactions: number | null;
    purchaseRevenue: number | null;
  } | null;
  score: number | null;
  scoreComponents: {
    demand: number;
    businessValue: number;
    reachability: number;
  } | null;
};

function resolveCombinedDates(
  input: Pick<SearchOpportunityInput, "startDate" | "endDate">,
  propertyTimeZone: string,
  now: Date,
) {
  if (!input.startDate && !input.endDate) {
    const endDate = shiftGa4Date(ga4DateInTimeZone(now, propertyTimeZone), -3);
    return {
      startDate: shiftGa4Date(endDate, -27),
      endDate,
    };
  }
  return resolveGa4DateRange(input, propertyTimeZone, now).resolvedDateRange;
}

function normalizePageKey(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed || trimmed === "(not set)") return null;
  try {
    const url = new URL(
      trimmed.includes("://") ? trimmed : `https://${trimmed}`,
    );
    let host = url.hostname.toLowerCase();
    const defaultPort =
      (url.protocol === "http:" && url.port === "80") ||
      (url.protocol === "https:" && url.port === "443");
    if (url.port && !defaultPort) host += `:${url.port}`;
    let path = url.pathname || "/";
    if (path.length > 1) path = path.replace(/\/+$/, "");
    return `${host}${path}`;
  } catch {
    return null;
  }
}

function numberField(
  row: Record<string, string | number | null>,
  name: string,
): number | null {
  const value = row[name];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function percentileRanks(values: number[]): number[] {
  if (values.length === 0) return [];
  if (values.length === 1) return [1];
  return values.map((value) => {
    const lower = values.filter((candidate) => candidate < value).length;
    return lower / (values.length - 1);
  });
}

function roundComponent(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}

async function getOpportunities(
  input: SearchOpportunityInput,
  opts: { now?: Date } = {},
) {
  const limit = input.limit ?? 50;
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new Ga4ReportError(
      "validation_error",
      "limit must be an integer from 1 to 100.",
    );
  }
  const [ga4Connection, gscConnection] = await Promise.all([
    Ga4ConnectionRepository.getByProjectId(input.projectId),
    GscService.getConnection(input.projectId),
  ]);
  if (!ga4Connection) {
    throw new Ga4ReportError(
      "ga4_not_connected",
      "Google Analytics is not connected for this project.",
    );
  }
  if (!gscConnection) throw new GscNotConnectedError(input.projectId);

  const now = opts.now ?? new Date();
  const dates = resolveCombinedDates(
    input,
    ga4Connection.propertyTimeZone,
    now,
  );
  const gsc = await GscService.getPerformance({
    projectId: input.projectId,
    dimensions: ["page"],
    startDate: dates.startDate,
    endDate: dates.endDate,
    rowLimit: 1_000,
    startRow: 0,
    type: "web",
    dataState: "final",
  });
  const ga4 = await Ga4ReportingService.runReport({
    projectId: input.projectId,
    kind: "landing_pages",
    startDate: dates.startDate,
    endDate: dates.endDate,
    limit: 1_000,
    offset: 0,
    channel: "organic_search",
  });

  const ga4ByPage = new Map<string, AnalyticsRow[]>();
  let invalidGa4Rows = 0;
  for (const row of ga4.rows) {
    const host = typeof row.hostName === "string" ? row.hostName : "";
    const landing = typeof row.landingPage === "string" ? row.landingPage : "";
    const key = normalizePageKey(`${host}${landing}`);
    if (!key) {
      invalidGa4Rows += 1;
      continue;
    }
    const rows = ga4ByPage.get(key) ?? [];
    rows.push(row);
    ga4ByPage.set(key, rows);
  }
  for (const rows of ga4ByPage.values()) {
    rows.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  }
  const gscPageCounts = new Map<string, number>();
  for (const row of gsc.rows) {
    const key = normalizePageKey(row.keys?.[0] ?? "");
    if (key) gscPageCounts.set(key, (gscPageCounts.get(key) ?? 0) + 1);
  }
  const ambiguousGa4Rows = [...ga4ByPage].reduce(
    (count, [key, rows]) =>
      count +
      (rows.length > 1 || (gscPageCounts.get(key) ?? 0) > 1 ? rows.length : 0),
    0,
  );

  const candidates: Candidate[] = gsc.rows
    .filter((row) => row.position >= 4 && row.position <= 20)
    .map((row) => {
      const page = row.keys?.[0] ?? "";
      const normalizedPage = normalizePageKey(page);
      const analyticsRows =
        (normalizedPage ? ga4ByPage.get(normalizedPage) : undefined) ?? [];
      // URL normalization alone does not prove canonical equivalence. Keep
      // source rows rather than summing distinct users/rates or choosing one.
      const ambiguous =
        analyticsRows.length > 0 &&
        normalizedPage !== null &&
        (analyticsRows.length > 1 ||
          (gscPageCounts.get(normalizedPage) ?? 0) > 1);
      const analytics = ambiguous ? undefined : analyticsRows[0];
      return {
        page,
        normalizedPage,
        clicks: row.clicks,
        impressions: row.impressions,
        ctr: row.ctr,
        position: row.position,
        joinStatus: ambiguous ? "ambiguous" : analytics ? "joined" : "gsc_only",
        ga4Rows: analyticsRows,
        ga4: analytics
          ? {
              sessions: numberField(analytics, "sessions"),
              activeUsers: numberField(analytics, "activeUsers"),
              engagedSessions: numberField(analytics, "engagedSessions"),
              engagementRate: numberField(analytics, "engagementRate"),
              keyEvents: numberField(analytics, "keyEvents"),
              sessionKeyEventRate: numberField(
                analytics,
                "sessionKeyEventRate",
              ),
              transactions: numberField(analytics, "transactions"),
              purchaseRevenue: numberField(analytics, "purchaseRevenue"),
            }
          : null,
        score: null,
        scoreComponents: null,
      } satisfies Candidate;
    });

  const joined = candidates.filter(
    (
      candidate,
    ): candidate is Candidate & { ga4: NonNullable<Candidate["ga4"]> } =>
      candidate.ga4 !== null,
  );
  const engagementFallback =
    joined.length > 0 &&
    joined.every((candidate) => candidate.ga4.keyEvents === 0);
  const incompleteMetrics = joined.some((candidate) =>
    Object.values(candidate.ga4).some((value) => value === null),
  );
  const scoreable = joined.flatMap((candidate) => {
    const value = engagementFallback
      ? candidate.ga4.engagementRate
      : candidate.ga4.sessionKeyEventRate;
    if (
      value === null ||
      Object.values(candidate.ga4).some((metric) => metric === null)
    ) {
      return [];
    }
    return [{ candidate, businessValue: value }];
  });
  const demand = percentileRanks(
    scoreable.map(({ candidate }) => Math.log1p(candidate.impressions)),
  );
  const businessValue = percentileRanks(
    scoreable.map((row) => row.businessValue),
  );
  const reachability = percentileRanks(
    scoreable.map(({ candidate }) => 20 - candidate.position),
  );
  scoreable.forEach(({ candidate }, index) => {
    const components = {
      demand: roundComponent(demand[index] ?? 0),
      businessValue: roundComponent(businessValue[index] ?? 0),
      reachability: roundComponent(reachability[index] ?? 0),
    };
    candidate.scoreComponents = components;
    candidate.score = Math.round(
      100 *
        (0.5 * components.demand +
          0.3 * components.businessValue +
          0.2 * components.reachability),
    );
  });
  candidates.sort((a, b) => {
    if (a.score == null && b.score != null) return 1;
    if (a.score != null && b.score == null) return -1;
    return (
      (b.score ?? 0) - (a.score ?? 0) ||
      b.impressions - a.impressions ||
      a.page.localeCompare(b.page)
    );
  });

  const matchedRows = joined.length;
  const matchedGa4Keys = new Set(
    joined.map((candidate) => candidate.normalizedPage),
  );
  const unmatchedGa4Rows = [...ga4ByPage].reduce(
    (count, [key, rows]) => count + (matchedGa4Keys.has(key) ? 0 : rows.length),
    invalidGa4Rows,
  );
  const unmatchedGscRows = candidates.length - matchedRows;
  const returned = candidates.slice(0, limit);
  return {
    status: "ok" as const,
    source: {
      searchConsoleSiteUrl: gsc.siteUrl,
      googleAnalyticsPropertyId: ga4.source.propertyId,
      googleAnalyticsPropertyDisplayName: ga4.source.propertyDisplayName,
    },
    request: {
      dateRange: dates,
      limit,
      searchConsoleTimeZone: "America/Los_Angeles",
      googleAnalyticsTimeZone: ga4.request.propertyTimeZone,
    },
    rowCount: returned.length,
    totalCandidateRows: candidates.length,
    rows: returned,
    scoring: {
      formula:
        "round(100 * (0.5 * demand + 0.3 * businessValue + 0.2 * reachability))",
      businessValueMetric: engagementFallback
        ? "engagementRate"
        : "sessionKeyEventRate",
      engagementFallback,
      scoreDataLimited:
        ga4.reportMetadata.hasLimitedData ||
        ambiguousGa4Rows > 0 ||
        incompleteMetrics,
    },
    coverage: {
      gscRowsConsidered: gsc.rows.length,
      ga4RowsConsidered: ga4.rows.length,
      matchedRows,
      unmatchedGscRows,
      unmatchedGa4Rows,
      ambiguousGscRows: candidates.filter(
        (row) => row.joinStatus === "ambiguous",
      ).length,
      ambiguousGa4Rows,
    },
    truncated: {
      gsc: gsc.rows.length >= 1_000,
      ga4: ga4.totalRowCount > ga4.rows.length,
      candidates: returned.length < candidates.length,
    },
    warnings: [
      ...ga4.warnings,
      ...(ga4.request.propertyTimeZone === "America/Los_Angeles"
        ? []
        : ["source_time_zones_differ"]),
      ...(ambiguousGa4Rows > 0 ? ["ambiguous_normalized_landing_pages"] : []),
      ...(incompleteMetrics ? ["incomplete_landing_page_metrics"] : []),
    ],
    reportMetadata: ga4.reportMetadata,
    quota: ga4.quota,
  };
}

export const SearchOpportunityService = { getOpportunities };
