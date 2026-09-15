import { sort } from "remeda";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  BarChart,
  Bar,
  Cell,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";
import { getChannelReports } from "@/serverFunctions/channelReports";
import {
  channels,
  describeChannelStatus,
  type ChannelReport,
} from "@/types/schemas/channelReports";

const names = {
  bing: "Bing",
  indexnow: "IndexNow",
  translation: "Translations",
  schedule: "Scheduled tasks",
};
type EvidenceFilter = {
  channel: string;
  status: string;
  startDate?: string;
  endDate?: string;
};
export function filterChannelReports(
  reports: ChannelReport[],
  filter: EvidenceFilter,
) {
  return reports.filter((row) => {
    if (filter.channel !== "all" && row.channel !== filter.channel)
      return false;
    if (filter.status !== "all" && row.status !== filter.status) return false;
    const start = row.periodStart ?? row.sourceUpdatedAt?.slice(0, 10);
    const end = row.periodEnd ?? start;
    // An import timestamp is NOT a reporting or execution date.
    if (filter.startDate && (!end || end < filter.startDate)) return false;
    if (filter.endDate && (!start || start > filter.endDate)) return false;
    return true;
  });
}

function TranslationCounts({ rows }: { rows: ChannelReport[] }) {
  // Never add different receipts together: they can describe the same articles.
  const sources = [...new Set(rows.map((row) => row.source))];
  return (
    <div aria-label="Translation review counts" className="mt-4 space-y-4">
      <p className="text-xs text-base-content/60">
        Review cells per receipt · editorial and publication not verified.
      </p>
      {sources.map((source) => {
        const data = rows.filter(
          (row) => row.source === source && row.count !== null,
        );
        if (!data.length) return null;
        return (
          <figure key={source}>
            <figcaption className="break-words text-xs text-base-content/60">
              {source}
            </figcaption>
            <div style={{ height: Math.max(140, data.length * 38) }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={data}
                  layout="vertical"
                  margin={{ top: 8, right: 24, bottom: 0, left: 0 }}
                  accessibilityLayer
                >
                  <XAxis
                    type="number"
                    domain={[0, "auto"]}
                    allowDecimals={false}
                    tick={{ fontSize: 11 }}
                  />
                  <YAxis
                    type="category"
                    dataKey="itemKey"
                    width={70}
                    tickFormatter={(key) => {
                      const row = data.find((entry) => entry.itemKey === key);
                      return (
                        row?.label.replace(" translation review cells", "") ??
                        String(key)
                      );
                    }}
                    tick={{ fontSize: 11 }}
                  />
                  <Tooltip
                    labelFormatter={(key) => {
                      const row = data.find((entry) => entry.itemKey === key);
                      return row
                        ? `${row.label} · ${describeChannelStatus(row)}`
                        : String(key);
                    }}
                    contentStyle={{
                      background: "var(--color-base-100)",
                      borderColor: "var(--color-base-300)",
                      borderRadius: 8,
                    }}
                  />
                  <Bar
                    dataKey="count"
                    name="Review cells"
                    isAnimationActive={false}
                  >
                    {data.map((row) => (
                      <Cell
                        key={row.itemKey}
                        fill={
                          row.status === "failed"
                            ? "var(--color-warning)"
                            : "var(--color-primary)"
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </figure>
        );
      })}
    </div>
  );
}
export function ChannelReportsView({
  reports,
  now = new Date(),
  onlyChannels = channels,
}: {
  reports: ChannelReport[];
  now?: Date;
  onlyChannels?: readonly ChannelReport["channel"][];
}) {
  const [filter, setFilter] = useState<EvidenceFilter>({
    channel: "all",
    status: "all",
  });
  const scoped = reports.filter((row) => onlyChannels.includes(row.channel));
  const invalidDates = !!(
    filter.startDate &&
    filter.endDate &&
    filter.startDate > filter.endDate
  );
  const filtered = invalidDates ? [] : filterChannelReports(scoped, filter);
  const options = [
    ...new Set(
      scoped
        .filter(
          (row) => filter.channel === "all" || row.channel === filter.channel,
        )
        .map((row) => row.status),
    ),
  ];
  const filteredActive =
    filter.channel !== "all" ||
    filter.status !== "all" ||
    filter.startDate ||
    filter.endDate;
  return (
    <section aria-label="Read-only channel reports" className="space-y-3">
      <h2 className="text-xl font-semibold">Channel evidence</h2>
      <p className="text-sm text-base-content/70">
        Historical snapshots · read-only, not live API connections.
      </p>
      <div className="flex flex-wrap items-end gap-3 rounded-box border border-base-300 p-3">
        <label className="text-xs">
          Evidence channel
          <select
            className="select select-sm block mt-1 w-40"
            value={filter.channel}
            onChange={(e) =>
              setFilter({ ...filter, channel: e.target.value, status: "all" })
            }
          >
            <option value="all">All in this section</option>
            {onlyChannels.map((channel) => (
              <option key={channel} value={channel}>
                {names[channel]}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs">
          Status
          <select
            className="select select-sm block mt-1 w-40"
            value={filter.status}
            onChange={(e) => setFilter({ ...filter, status: e.target.value })}
          >
            <option value="all">All statuses</option>
            {options.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs">
          Evidence from
          <input
            type="date"
            className="input input-sm block mt-1 w-40"
            value={filter.startDate ?? ""}
            onInput={(e) =>
              setFilter({ ...filter, startDate: e.currentTarget.value })
            }
          />
        </label>
        <label className="text-xs">
          Evidence to
          <input
            type="date"
            className="input input-sm block mt-1 w-40"
            value={filter.endDate ?? ""}
            onInput={(e) =>
              setFilter({ ...filter, endDate: e.currentTarget.value })
            }
          />
        </label>
        <button
          className="btn btn-sm btn-ghost"
          onClick={() => setFilter({ channel: "all", status: "all" })}
        >
          Reset evidence filters
        </button>
      </div>
      {invalidDates ? (
        <p role="alert" className="text-error text-sm">
          Evidence start must not be after end.
        </p>
      ) : (
        <p className="text-xs text-base-content/60">
          {filtered.length} matching records · Independent evidence dates, not
          the traffic window. Period overlap retains the whole reported total,
          not a partial-period estimate. Undated sources are excluded when dates
          are selected.
        </p>
      )}
      <div className="grid gap-5 lg:grid-cols-2">
        {onlyChannels
          .filter(
            (channel) => filter.channel === "all" || channel === filter.channel,
          )
          .map((channel) => {
            const rows = sort(
              filtered.filter((row) => row.channel === channel),
              (a, b) =>
                (a.sourceUpdatedAt ?? a.observedAt).localeCompare(
                  b.sourceUpdatedAt ?? b.observedAt,
                ),
            );
            return (
              <article
                key={channel}
                className="min-w-0 rounded-box border border-base-300 bg-base-100 p-4"
              >
                <h3 className="font-semibold">{names[channel]}</h3>
                {channel === "bing" && (
                  <p className="mt-2 text-xs text-base-content/60">
                    Daily Bing history is not available. Showing reported totals
                    only.
                  </p>
                )}
                {channel === "indexnow" && (
                  <p className="mt-2 text-xs text-base-content/60">
                    Receipt timeline · batches may overlap; counts are not
                    unique indexed URLs.
                  </p>
                )}
                {channel === "translation" && rows.length > 0 && (
                  <TranslationCounts rows={rows} />
                )}
                {!rows.length ? (
                  <p className="mt-2 text-sm">
                    {filteredActive
                      ? "No matching records for these filters."
                      : "No verified report — unknown, not zero."}
                  </p>
                ) : (
                  <ul
                    aria-label={
                      channel === "indexnow"
                        ? "IndexNow receipt timeline"
                        : `${names[channel]} observations`
                    }
                    className={
                      channel === "indexnow"
                        ? "mt-4 ml-2 space-y-4 border-l-2 border-base-300 pl-4"
                        : "mt-4 space-y-3"
                    }
                  >
                    {rows.map((row) => (
                      <li
                        key={row.itemKey}
                        className="min-w-0 break-words border-t border-base-200 pt-3 text-sm"
                      >
                        {channel === "indexnow" && (
                          <p className="mb-1 text-xs text-base-content/60">
                            Receipt time:{" "}
                            {row.sourceUpdatedAt
                              ? row.sourceUpdatedAt
                                  .replace("T", " ")
                                  .replace(".000Z", " UTC")
                              : "Unknown"}
                          </p>
                        )}
                        <p className="text-xs text-base-content/60">
                          {row.label}
                        </p>
                        <p className="text-lg font-semibold tabular-nums">
                          {row.count === null
                            ? "Unknown"
                            : row.count.toLocaleString("en-US")}
                        </p>
                        <p
                          className={
                            row.status === "failed" ||
                            row.status === "rejected" ||
                            row.status === "preflight-failed"
                              ? "text-warning"
                              : "text-base-content/70"
                          }
                        >
                          {describeChannelStatus(row)}
                        </p>
                        {row.configuration && (
                          <p>
                            Configuration: {row.configuration} (not a run
                            result)
                          </p>
                        )}
                        {row.periodStart && (
                          <p>
                            Report period: {row.periodStart} – {row.periodEnd}
                          </p>
                        )}
                        {row.sourceUpdatedAt &&
                          now.getTime() - Date.parse(row.sourceUpdatedAt) >
                            7 * 86400000 && (
                            <p className="text-xs text-warning">
                              Older than 7 days — refresh evidence before
                              acting.
                            </p>
                          )}
                        <details className="mt-2 text-xs text-base-content/70">
                          <summary className="cursor-pointer py-1">
                            View source details
                          </summary>
                          {row.scope && <p>Scope: {row.scope}</p>}
                          <p className="text-base-content/70">
                            Source: {row.source}
                          </p>
                          <p className="text-base-content/70">
                            Source updated: {row.sourceUpdatedAt ?? "Unknown"}
                          </p>
                          <p className="text-base-content/70">
                            Observed: {row.observedAt}
                          </p>
                        </details>
                      </li>
                    ))}
                  </ul>
                )}
              </article>
            );
          })}
      </div>
    </section>
  );
}

export function ChannelReportsCard({
  projectId,
  onlyChannels,
}: {
  projectId: string;
  onlyChannels?: readonly ChannelReport["channel"][];
}) {
  const query = useQuery({
    queryKey: ["channelReports", projectId],
    queryFn: () => getChannelReports({ data: { projectId } }),
  });
  if (query.isPending) return <p role="status">Loading channel evidence…</p>;
  if (query.isError)
    return (
      <div role="alert">
        Channel reports are unavailable, not zero.{" "}
        <button className="btn btn-sm" onClick={() => void query.refetch()}>
          Retry read
        </button>
      </div>
    );
  return (
    <ChannelReportsView reports={query.data} onlyChannels={onlyChannels} />
  );
}
