import { z } from "zod";

export type ReportDates = { startDate: string; endDate: string };
export function advanceDashboardDates(
  dates: ReportDates,
  preset: 7 | 28 | 90 | null,
  now = new Date(),
): ReportDates {
  if (preset === null) return dates;
  const next = dashboardDates(preset, now);
  return dates.startDate === next.startDate && dates.endDate === next.endDate
    ? dates
    : next;
}
export const reportDateFields = {
  startDate: z.iso.date().optional(),
  endDate: z.iso.date().optional(),
};
export function validReportDates(value: {
  startDate?: string;
  endDate?: string;
}) {
  if (!value.startDate && !value.endDate) return true;
  if (!value.startDate || !value.endDate) return false;
  const days =
    (Date.parse(value.endDate) - Date.parse(value.startDate)) / 86400000;
  return Number.isFinite(days) && days >= 0 && days < 90;
}
export const reportDateError =
  "Choose an ordered date range of 1–90 days, with both dates.";

/** Requested PT calendar window. The provider determines available data dates. */
export function dashboardDates(
  days: 7 | 28 | 90,
  now = new Date(),
): ReportDates {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const part = (type: string) => parts.find((p) => p.type === type)!.value;
  const end = Date.parse(
    `${part("year")}-${part("month")}-${part("day")}T00:00:00Z`,
  );
  return {
    startDate: new Date(end - (days - 1) * 86400000).toISOString().slice(0, 10),
    endDate: new Date(end).toISOString().slice(0, 10),
  };
}
