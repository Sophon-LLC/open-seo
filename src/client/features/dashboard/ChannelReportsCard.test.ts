import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { ChannelReportsView, filterChannelReports } from "./ChannelReportsCard";
import { channelReportSchema } from "@/types/schemas/channelReports";
vi.mock("@/serverFunctions/channelReports", () => ({
  getChannelReports: vi.fn(),
}));
it("filters historical evidence by its reporting period, not the later import date", () => {
  const row = channelReportSchema.parse({
    channel: "bing",
    itemKey: "clicks",
    label: "Clicks",
    status: "observed",
    count: 12,
    source: "ledger.md",
    observedAt: "2026-09-14T00:00:00.000Z",
    periodStart: "2026-09-02",
    periodEnd: "2026-09-08",
  });
  expect(
    filterChannelReports([row], {
      channel: "all",
      status: "all",
      startDate: "2026-09-09",
      endDate: "2026-09-14",
    }),
  ).toEqual([]);
  expect(
    filterChannelReports([row], {
      channel: "all",
      status: "all",
      startDate: "2026-09-08",
      endDate: "2026-09-08",
    }),
  ).toEqual([row]);
  expect(
    filterChannelReports([row], { channel: "indexnow", status: "all" }),
  ).toEqual([]);
  expect(
    filterChannelReports([row], { channel: "all", status: "failed" }),
  ).toEqual([]);
});

it("shows compact observations and a receipt timeline without inventing daily Bing history or summing batches", () => {
  const make = (
    channel: string,
    itemKey: string,
    label: string,
    status: string,
    count: number,
  ) =>
    channelReportSchema.parse({
      channel,
      itemKey,
      label,
      status,
      count,
      source: `${itemKey}.json`,
      observedAt: "2026-09-14T00:00:00.000Z",
      sourceUpdatedAt:
        itemKey === "earlier"
          ? "2026-09-12T00:00:00.000Z"
          : "2026-09-13T00:00:00.000Z",
    });
  const html = renderToStaticMarkup(
    createElement(ChannelReportsView, {
      reports: [
        make("bing", "clicks", "Clicks", "observed", 12),
        make("indexnow", "later", "URLs in recorded batch", "submitted", 8),
        make("indexnow", "earlier", "URLs in recorded batch", "rejected", 9),
      ],
    }),
  );
  expect(html).toContain("Daily Bing history is not available");
  expect(html).toContain('aria-label="IndexNow receipt timeline"');
  expect(html.indexOf("earlier.json")).toBeLessThan(html.indexOf("later.json"));
  expect(html).toContain("View source details");
  expect(html).not.toContain(">17<");
  expect(html).not.toContain("<details open");
});

it("renders all four channels with sources, unknowns, stale evidence and no submission control", () => {
  const reports = [
    channelReportSchema.parse({
      channel: "indexnow",
      itemKey: "batch",
      label: "Changed URLs",
      status: "submitted",
      count: 9,
      source: "receipt.json",
      observedAt: "2026-09-14T00:00:00.000Z",
      sourceUpdatedAt: "2026-09-01T00:00:00.000Z",
    }),
  ];
  const html = renderToStaticMarkup(
    createElement(ChannelReportsView, {
      reports,
      now: new Date("2026-09-14T01:00:00.000Z"),
    }),
  );
  for (const text of [
    "Bing",
    "IndexNow",
    "Translations",
    "Scheduled tasks",
    "indexing not verified",
    "receipt.json",
    "Older than 7 days",
    "No verified report",
    "2026-09-01",
  ])
    expect(html).toContain(text);
  expect(html).not.toContain("Submit URLs");
});

it("compares translation review counts without treating review as publication", () => {
  const row = channelReportSchema.parse({
    channel: "translation",
    itemKey: "de-pass",
    label: "de translation review cells",
    status: "model-pass",
    count: 14,
    source: "translation.json",
    observedAt: "2026-09-14T00:00:00.000Z",
  });
  const html = renderToStaticMarkup(
    createElement(ChannelReportsView, { reports: [row] }),
  );
  expect(html).toContain('aria-label="Translation review counts"');
  expect(html).toContain("editorial and publication not verified");
  expect(html).toContain("14");
});
