import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Copy, Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import {
  AppDataTable,
  useAppTable,
  useSelectionAnchor,
} from "@/client/components/table/AppDataTable";
import {
  TableBulkActionBar,
  TableBulkActionButton,
} from "@/client/components/table/TableBulkActionBar";
import { TablePagination } from "@/client/components/table/TablePagination";
import {
  buildDimensionColumns,
  buildStrikingColumns,
  formatCount,
  formatCtr,
  formatPosition,
  type Report,
  type SearchPerformanceTableRow,
} from "@/client/features/search-performance/SearchPerformanceColumns";
import {
  buildCsv,
  downloadCsv,
  normalizeExportValue,
  type CsvValue,
} from "@/client/lib/csv";
import { getStandardErrorMessage } from "@/client/lib/error-messages";
import { exportTableToSheets } from "@/client/lib/exportToSheets";
import { captureClientEvent } from "@/client/lib/posthog";
import {
  SEARCH_PERFORMANCE_PAGE_SIZES,
  type SearchPerformanceTableDimension,
} from "@/types/schemas/search-performance";
import { saveKeywords } from "@/serverFunctions/keywords";
import type { exportSearchPerformanceTable } from "@/serverFunctions/searchPerformance";

export type Tab = "striking" | "queries" | "pages";
export type ExportTarget = "csv" | "sheets";

type ExportTable = { filename: string; headers: string[]; rows: CsvValue[][] };
type ExportCoverage = Awaited<
  ReturnType<typeof exportSearchPerformanceTable>
>["coverage"];

const STRIKING_COVERAGE_NOTE =
  "Based on up to 1,000 top query-page rows returned by Google, not a complete inventory. Uses the best-ranking returned page per query, then filters positions 5 to 20 and retains up to 100 candidates sorted by impressions. Metrics belong to the selected query-page row. Google may omit queries or pages, including a better-ranking page.";

function strikingExportTable(report: Report): ExportTable {
  const stamp = `${report.range.startDate}-to-${report.range.endDate}`;
  const window = `${report.range.startDate} to ${report.range.endDate} · PT (America/Los_Angeles) · finalized data only`;
  return {
    filename: `search-performance-striking-distance-${stamp}.csv`,
    headers: [
      "Query",
      "Page",
      "Impressions",
      "Clicks",
      "Position",
      "Reporting window",
      "Export coverage",
    ],
    rows: report.strikingDistance.map((row) => [
      row.query,
      row.page,
      row.impressions,
      row.clicks,
      row.position,
      window,
      STRIKING_COVERAGE_NOTE,
    ]),
  };
}

function dimensionExportTable(
  dimension: SearchPerformanceTableDimension,
  rows: SearchPerformanceTableRow[],
  stamp: string,
  window: string,
  coverageNote: string,
): ExportTable {
  const isPage = dimension === "page";
  return {
    filename: `search-performance-${isPage ? "pages" : "queries"}-${stamp}.csv`,
    headers: [
      isPage ? "Page" : "Query",
      "Clicks",
      "Impressions",
      "CTR",
      "Position",
      "Reporting window",
      "Export coverage",
    ],
    rows: rows.map((row) => [
      row.key,
      row.clicks,
      row.impressions,
      row.ctr,
      row.position,
      window,
      coverageNote,
    ]),
  };
}

function runExport(table: ExportTable, target: ExportTarget): void {
  if (target === "csv") {
    downloadCsv(table.filename, buildCsv(table.headers, table.rows));
    captureClientEvent("data:export", {
      source_feature: "search_performance",
      result_count: table.rows.length,
    });
    return;
  }
  void exportTableToSheets({
    headers: table.headers,
    rows: table.rows,
    feature: "search_performance",
  });
}

export function exportStriking(report: Report, target: ExportTarget): void {
  runExport(strikingExportTable(report), target);
}

/** Keep the bounded query's actual dates and coverage with the exported rows,
 *  including when they leave the application via CSV or Sheets. */
export function exportDimensionRows(
  dimension: SearchPerformanceTableDimension,
  rows: SearchPerformanceTableRow[],
  range: Pick<Report["range"], "startDate" | "endDate">,
  target: ExportTarget,
  coverage: ExportCoverage,
): void {
  const stamp = `${range.startDate}-to-${range.endDate}`;
  const window = `${range.startDate} to ${range.endDate} · PT (America/Los_Angeles) · finalized data only`;
  const coverageNote = coverage.mayBeTruncated
    ? `Limited to first ${coverage.rowLimit.toLocaleString("en-US")} API rows; more rows may exist. Google may omit anonymized queries and other rows.`
    : `${coverage.returnedRows.toLocaleString("en-US")} rows returned; application limit not reached. Google may omit anonymized queries and other rows.`;
  if (coverage.mayBeTruncated) toast.warning(coverageNote);
  runExport(
    dimensionExportTable(dimension, rows, stamp, window, coverageNote),
    target,
  );
}

export function TabButton({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      className={`tab ${active ? "tab-active" : ""}`}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

type Delta = { text: string; improved: boolean } | null;

function percentDelta(current: number | null, previous: number | null): Delta {
  if (current === null || previous === null || previous <= 0) return null;
  const change = (current - previous) / previous;
  const pct = (change * 100).toFixed(1);
  return { text: `${change >= 0 ? "+" : ""}${pct}%`, improved: change >= 0 };
}

/** Position falls as rankings improve, so the delta is inverted. */
function positionDelta(current: number | null, previous: number | null): Delta {
  if (current === null || previous === null || previous <= 0 || current <= 0)
    return null;
  const change = previous - current;
  return {
    text: `${change >= 0 ? "+" : ""}${change.toFixed(1)}`,
    improved: change >= 0,
  };
}

export function TotalsCards({ report }: { report: Report }) {
  const { totals, prevTotals, range } = report;
  const deltaTitle = `vs ${range.prevStartDate} to ${range.prevEndDate}`;
  return (
    <section className="space-y-3" aria-label="Search performance totals">
      <p className="text-sm text-base-content/60">
        {range.startDate} to {range.endDate} · PT (America/Los_Angeles) ·
        finalized data only. Compared with {range.prevStartDate} to{" "}
        {range.prevEndDate}.
      </p>
      {totals.impressions === 0 ? (
        <p className="text-sm text-base-content/60">
          No impressions were returned for this finalized-data window. CTR and
          average position are undefined.
        </p>
      ) : null}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <TotalCard
          label="Clicks"
          value={formatCount(totals.clicks)}
          delta={percentDelta(totals.clicks, prevTotals.clicks)}
          deltaTitle={deltaTitle}
        />
        <TotalCard
          label="Impressions"
          value={formatCount(totals.impressions)}
          delta={percentDelta(totals.impressions, prevTotals.impressions)}
          deltaTitle={deltaTitle}
        />
        <TotalCard
          label="CTR"
          value={formatCtr(totals.ctr)}
          delta={percentDelta(totals.ctr, prevTotals.ctr)}
          deltaTitle={deltaTitle}
        />
        <TotalCard
          label="Avg position"
          value={formatPosition(totals.position)}
          delta={positionDelta(totals.position, prevTotals.position)}
          deltaTitle={deltaTitle}
        />
      </div>
    </section>
  );
}

function TotalCard({
  label,
  value,
  delta,
  deltaTitle,
}: {
  label: string;
  value: string;
  delta: Delta;
  deltaTitle: string;
}) {
  return (
    <div className="rounded-lg border border-base-300 bg-base-100 p-4">
      <div className="text-xs uppercase tracking-wide text-base-content/60">
        {label}
      </div>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="text-2xl font-semibold">{value}</span>
        {delta ? (
          <span
            className={`text-xs ${delta.improved ? "text-success" : "text-error"}`}
            title={deltaTitle}
          >
            {delta.text}
          </span>
        ) : null}
      </div>
    </div>
  );
}

export function DimensionTable({
  rows,
  keyLabel,
}: {
  rows: SearchPerformanceTableRow[];
  keyLabel: string;
}) {
  const columns = useMemo(() => buildDimensionColumns(keyLabel), [keyLabel]);
  const table = useAppTable({
    data: rows,
    columns,
    withSorting: true,
    initialState: { sorting: [{ id: "clicks", desc: true }] },
  });
  return (
    <AppDataTable
      table={table}
      className="table table-zebra table-sm"
      wrapperClassName="overflow-x-auto"
      empty={
        <p className="p-6 text-sm text-base-content/60">
          No data for this period yet. Search Console data trails by a few days.
        </p>
      }
    />
  );
}

export function StrikingDistanceTable({
  projectId,
  rows,
}: {
  projectId: string;
  rows: Report["strikingDistance"];
}) {
  const queryClient = useQueryClient();
  const anchorRef = useSelectionAnchor();
  const [rowSelection, setRowSelection] = useState({});
  const columns = useMemo(() => buildStrikingColumns(anchorRef), [anchorRef]);
  const table = useAppTable({
    data: rows,
    columns,
    withSorting: true,
    withPagination: true,
    enableRowSelection: true,
    state: { rowSelection },
    onRowSelectionChange: setRowSelection,
    getRowId: (row) => `${row.query}::${row.page}`,
    initialState: {
      sorting: [{ id: "impressions", desc: true }],
      // All rows are already loaded; paginate client-side to keep the table
      // short. 50/page by default.
      pagination: { pageIndex: 0, pageSize: 50 },
    },
  });
  const pagination = table.getState().pagination;

  // Rows are query x page; saving/copying dedupes to the query strings.
  const selectedQueries = Array.from(
    new Set(table.getSelectedRowModel().rows.map((row) => row.original.query)),
  );

  const copyKeywords = async () => {
    try {
      // Sanitize against spreadsheet formula injection: GSC query strings are
      // untrusted and may begin with =, +, -, @, etc. See @/client/lib/csv.
      const text = selectedQueries
        .map((query) => normalizeExportValue(query))
        .join("\n");
      await navigator.clipboard.writeText(text);
      toast.success(
        `Copied ${selectedQueries.length} ${selectedQueries.length === 1 ? "keyword" : "keywords"}`,
      );
    } catch {
      toast.error("Couldn't copy to clipboard");
    }
  };

  const save = useMutation({
    mutationFn: (keywords: string[]) =>
      saveKeywords({ data: { projectId, keywords } }),
    onSuccess: (_result, keywords) => {
      captureClientEvent("keyword:save", {
        source_feature: "search_performance",
        keyword_count: keywords.length,
      });
      void queryClient.invalidateQueries({
        queryKey: ["savedKeywords", projectId],
      });
      toast.success(
        `Saved ${keywords.length} ${keywords.length === 1 ? "keyword" : "keywords"}`,
      );
      setRowSelection({});
    },
    onError: (error) => {
      toast.error(getStandardErrorMessage(error, "Could not save keywords"));
    },
  });

  if (rows.length === 0) {
    return (
      <div className="space-y-3 p-6 text-sm text-base-content/60">
        <p>No candidates found in these returned rows.</p>
        <p>{STRIKING_COVERAGE_NOTE}</p>
      </div>
    );
  }

  return (
    <>
      <div className="p-4">
        <p className="mb-3 text-sm text-base-content/60">
          {STRIKING_COVERAGE_NOTE}
        </p>
        <AppDataTable
          table={table}
          className="table table-zebra table-sm"
          wrapperClassName="overflow-x-auto"
        />
      </div>
      <TablePagination
        page={pagination.pageIndex + 1}
        pageSize={pagination.pageSize}
        pageSizes={SEARCH_PERFORMANCE_PAGE_SIZES}
        totalCount={rows.length}
        hasNextPage={table.getCanNextPage()}
        isLoading={false}
        onPageChange={(nextPage) => table.setPageIndex(nextPage - 1)}
        onPageSizeChange={(nextSize) => table.setPageSize(nextSize)}
      />
      <TableBulkActionBar
        selectedCount={selectedQueries.length}
        selectedLabel={selectedQueries.length === 1 ? "query" : "queries"}
        onClear={() => setRowSelection({})}
        actions={
          <div className="flex items-center gap-1 px-1.5">
            <TableBulkActionButton
              icon={<Copy className="size-3.5" />}
              onClick={() => void copyKeywords()}
            >
              Copy keywords
            </TableBulkActionButton>
            <TableBulkActionButton
              icon={
                save.isPending ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Save className="size-3.5" />
                )
              }
              onClick={() => save.mutate(selectedQueries)}
              disabled={save.isPending}
            >
              Save as keywords
            </TableBulkActionButton>
          </div>
        }
      />
    </>
  );
}
