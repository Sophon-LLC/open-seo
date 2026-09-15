import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { DimensionTable } from "@/client/features/search-performance/SearchPerformanceParts";
import type { SearchPerformanceTableRow } from "@/client/features/search-performance/SearchPerformanceColumns";
import { getSearchPerformanceTable } from "@/serverFunctions/searchPerformance";
import type { ReportDates } from "@/types/schemas/reportDates";

/** Reuse upstream sortable tables; pagination is Google's, text search is explicitly local. */
export function SearchDetails({
  projectId,
  dates,
  countries,
  dataState = "final",
}: {
  projectId: string;
  dates: ReportDates;
  countries: SearchPerformanceTableRow[];
  dataState?: "all" | "final";
}) {
  const [dimension, setDimension] = useState<"query" | "page" | "country">(
    "query",
  );
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const query = useQuery({
    queryKey: [
      "dashboardSearchDetails",
      projectId,
      dates,
      dimension,
      page,
      dataState,
    ],
    queryFn: () =>
      getSearchPerformanceTable({
        data: {
          projectId,
          ...dates,
          dataState,
          dateRange: "last_28_days",
          dimension: dimension === "page" ? "page" : "query",
          page,
          pageSize: 25,
        },
      }),
    enabled: dimension !== "country",
  });
  const result = query.data;
  const rows =
    dimension === "country" ? countries : result?.connected ? result.rows : [];
  return (
    <section
      aria-label="Search breakdown"
      className="min-w-0 space-y-3 border-t border-base-300 pt-4"
    >
      <div className="flex flex-wrap items-center gap-2">
        {(
          [
            ["query", "Queries"],
            ["page", "Pages"],
            ["country", "Countries"],
          ] as const
        ).map(([key, name]) => (
          <button
            key={key}
            aria-pressed={dimension === key}
            className={`btn btn-sm ${dimension === key ? "btn-primary" : "btn-ghost"}`}
            onClick={() => {
              setDimension(key);
              setPage(1);
              setSearch("");
            }}
          >
            {name}
          </button>
        ))}
        <input
          className="input input-sm w-full sm:ml-auto sm:w-60"
          aria-label="Search loaded rows"
          placeholder="Search loaded rows…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      <p className="text-xs text-base-content/60">
        {dimension === "country"
          ? "Top 25 countries"
          : `Page ${page} · up to 25 rows`}{" "}
        · sorting and text search apply to loaded rows only. Google may omit
        anonymized queries; detail totals can differ from the chart.
      </p>
      {dimension !== "country" && query.isPending ? (
        <p role="status" className="py-6">
          Loading breakdown…
        </p>
      ) : dimension !== "country" && query.isError ? (
        <p role="alert">
          Breakdown unavailable.{" "}
          <button className="btn btn-sm" onClick={() => void query.refetch()}>
            Retry
          </button>
        </p>
      ) : dimension !== "country" && result && !result.connected ? (
        <p>Search Console connection needs attention.</p>
      ) : (
        <div className="max-h-96 overflow-auto">
          <DimensionTable
            rows={rows.filter((row) =>
              row.key.toLowerCase().includes(search.toLowerCase()),
            )}
            keyLabel={
              dimension === "query"
                ? "Query"
                : dimension === "page"
                  ? "Page"
                  : "Country"
            }
          />
        </div>
      )}
      {dimension !== "country" && (
        <div className="flex items-center justify-end gap-2">
          <button
            className="btn btn-sm btn-ghost"
            disabled={page === 1 || query.isPending}
            onClick={() => {
              setPage(page - 1);
              setSearch("");
            }}
          >
            Previous
          </button>
          <span className="text-xs">Page {page}</span>
          <button
            className="btn btn-sm btn-ghost"
            disabled={
              query.isPending || !result?.connected || !result.hasNextPage
            }
            onClick={() => {
              setPage(page + 1);
              setSearch("");
            }}
          >
            Next
          </button>
        </div>
      )}
    </section>
  );
}
