import { useState } from "react";
import { z } from "zod";
import {
  dashboardDates,
  validReportDates,
  reportDateError,
  type ReportDates,
} from "@/types/schemas/reportDates";

export type TrafficChannel = "all" | "gsc" | "ga4";
export function DashboardFilters({
  dates,
  onDates,
  channel,
  onChannel,
  preset,
  onPreset,
  dataState = "all",
  onDataState,
}: {
  dates: ReportDates;
  onDates: (dates: ReportDates) => void;
  channel: TrafficChannel;
  onChannel: (channel: TrafficChannel) => void;
  preset?: 7 | 28 | 90 | null;
  onPreset?: (preset: 7 | 28 | 90 | null) => void;
  dataState?: "all" | "final";
  onDataState?: (state: "all" | "final") => void;
}) {
  const [custom, setCustom] = useState(false);
  const [draft, setDraft] = useState(dates);
  const [error, setError] = useState("");
  const latest = dashboardDates(7).endDate;
  // Keep the preceding comparison within GSC retention as well.
  const earliest = new Date(Date.parse(latest) - 365 * 86400000)
    .toISOString()
    .slice(0, 10);
  function apply(next: ReportDates) {
    onDates(next);
    setDraft(next);
    setError("");
  }
  return (
    <section
      aria-label="Traffic filters"
      className="rounded-box border border-base-300 bg-base-100 p-4 space-y-3"
    >
      <div className="flex flex-wrap items-center gap-2">
        {([7, 28, 90] as const).map((days) => {
          const range = dashboardDates(days);
          const selected =
            !custom &&
            preset !== null &&
            dates.startDate === range.startDate &&
            dates.endDate === range.endDate;
          return (
            <button
              key={days}
              aria-pressed={selected}
              className={`btn btn-sm ${selected ? "btn-primary" : "btn-ghost"}`}
              onClick={() => {
                setCustom(false);
                onPreset?.(days);
                apply(range);
              }}
            >
              Last {days} days
            </button>
          );
        })}
        <button
          className={`btn btn-sm ${custom ? "btn-primary" : "btn-ghost"}`}
          aria-expanded={custom}
          onClick={() => {
            setCustom(!custom);
            setDraft(dates);
            setError("");
          }}
        >
          Custom
        </button>
        <label className="flex items-center gap-2 text-sm sm:ml-auto">
          Traffic channel
          <select
            aria-label="Traffic channel"
            className="select select-sm w-auto"
            value={channel}
            onChange={(event) =>
              onChannel(z.enum(["all", "gsc", "ga4"]).parse(event.target.value))
            }
          >
            <option value="all">Google + GA4</option>
            <option value="gsc">Google Search</option>
            <option value="ga4">GA4 organic</option>
          </select>
        </label>
        <button
          className="btn btn-sm btn-ghost"
          onClick={() => {
            setCustom(false);
            onPreset?.(28);
            onDataState?.("all");
            onChannel("all");
            apply(dashboardDates(28));
          }}
        >
          Reset
        </button>
      </div>
      {custom && (
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            const next = {
              startDate: form.get("startDate"),
              endDate: form.get("endDate"),
            };
            if (
              typeof next.startDate !== "string" ||
              typeof next.endDate !== "string" ||
              !z.iso.date().safeParse(next.startDate).success ||
              !z.iso.date().safeParse(next.endDate).success ||
              !validReportDates({
                startDate: next.startDate,
                endDate: next.endDate,
              })
            ) {
              setError(reportDateError);
              return;
            }
            if (next.endDate > latest || next.startDate < earliest) {
              setError(`Choose dates between ${earliest} and ${latest}.`);
              return;
            }
            onPreset?.(null);
            apply({ startDate: next.startDate, endDate: next.endDate });
          }}
        >
          <label className="text-xs">
            From
            <input
              aria-label="From date"
              name="startDate"
              required
              type="date"
              min={earliest}
              max={latest}
              value={draft.startDate}
              className="input input-sm block w-40 mt-1"
              onInput={(e) =>
                setDraft({ ...draft, startDate: e.currentTarget.value })
              }
            />
          </label>
          <label className="text-xs">
            To
            <input
              aria-label="To date"
              name="endDate"
              required
              type="date"
              min={earliest}
              max={latest}
              value={draft.endDate}
              className="input input-sm block w-40 mt-1"
              onInput={(e) =>
                setDraft({ ...draft, endDate: e.currentTarget.value })
              }
            />
          </label>
          <button type="submit" className="btn btn-sm btn-primary">
            Apply dates
          </button>
          <span className="text-xs text-base-content/60">Up to 90 days</span>
        </form>
      )}
      {error && (
        <p role="alert" className="text-sm text-error">
          {error}
        </p>
      )}
      <label className="flex flex-wrap items-center gap-2 text-sm">
        Google data freshness
        <select
          aria-label="Google data freshness"
          className="select select-sm w-auto"
          value={dataState}
          onChange={(event) =>
            onDataState?.(z.enum(["all", "final"]).parse(event.target.value))
          }
        >
          <option value="all">Latest available (may be incomplete)</option>
          <option value="final">Final data only</option>
        </select>
      </label>
      <p className="text-xs text-base-content/60">
        Requested period: {dates.startDate} – {dates.endDate}. Presets advance
        with the PT calendar on refresh; applied custom dates stay fixed. Google
        may not have observations for every requested day. GA4 uses its property
        timezone.
      </p>
    </section>
  );
}
