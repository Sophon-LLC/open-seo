import { afterEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  exportDimensionRows,
  exportStriking,
  StrikingDistanceTable,
  TotalsCards,
} from "./SearchPerformanceParts";
import type { Report } from "./SearchPerformanceColumns";
import { sumSearchTotals } from "@/server/features/gsc/searchPerformanceReport";

vi.mock("@/serverFunctions/keywords", () => ({ saveKeywords: vi.fn() }));
vi.mock("@/client/lib/posthog", () => ({ captureClientEvent: vi.fn() }));

afterEach(() => vi.unstubAllGlobals());

const strikingReport: Report = {
  connected: true,
  range: {
    startDate: "2026-08-15",
    endDate: "2026-09-11",
    prevStartDate: "2026-07-18",
    prevEndDate: "2026-08-14",
  },
  totals: sumSearchTotals([]),
  prevTotals: sumSearchTotals([]),
  countries: [],
  strikingDistance: [
    {
      query: "=1+1",
      page: "+unsafe",
      impressions: 100,
      clicks: 0,
      position: 7,
    },
  ],
};

describe("Striking-distance export coverage", () => {
  it("keeps the actual report period, limited candidate rules and safe values in CSV", async () => {
    let content: Blob | null = null;
    const anchor = { href: "", download: "", click: vi.fn() };
    vi.stubGlobal("document", { createElement: () => anchor });
    vi.spyOn(URL, "createObjectURL").mockImplementation((blob) => {
      if (blob instanceof Blob) content = blob;
      return "blob:test";
    });
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    exportStriking(strikingReport, "csv");
    const csv = await new Response(content).text();
    expect(anchor.click).toHaveBeenCalledTimes(1);
    expect(csv).toContain("Reporting window");
    expect(csv).toContain("2026-08-15 to 2026-09-11");
    expect(csv).toContain("PT (America/Los_Angeles)");
    expect(csv).toContain("finalized data only");
    expect(csv).toContain("Export coverage");
    expect(csv).toContain("up to 1,000 top query-page rows");
    expect(csv).toContain("best-ranking returned page per query");
    expect(csv).toContain("positions 5 to 20");
    expect(csv).toContain("up to 100 candidates");
    expect(csv).toContain("not a complete inventory");
    expect(csv).toContain("'=1+1");
    expect(csv).toContain("'+unsafe");
  });

  it("retains coverage and date context with sanitized cells in Sheets", async () => {
    class BrowserClipboardItem {
      constructor(readonly items: Record<string, Promise<Blob>>) {}
    }
    let text = "";
    const write = vi.fn(async (items: BrowserClipboardItem[]) => {
      text = await (await items[0].items["text/plain"]).text();
    });
    vi.stubGlobal("ClipboardItem", BrowserClipboardItem);
    vi.stubGlobal("navigator", { clipboard: { write } });
    exportStriking(strikingReport, "sheets");
    await vi.waitFor(() => expect(text).toContain("'=1+1"));
    expect(write).toHaveBeenCalledTimes(1);
    expect(text).toContain("Reporting window");
    expect(text).toContain("2026-08-15 to 2026-09-11");
    expect(text).toContain("PT (America/Los_Angeles)");
    expect(text).toContain("finalized data only");
    expect(text).toContain("Export coverage");
    expect(text).toContain("up to 1,000 top query-page rows");
    expect(text).toContain("best-ranking returned page per query");
    expect(text).toContain("positions 5 to 20");
    expect(text).toContain("up to 100 candidates");
    expect(text).toContain("not a complete inventory");
    expect(text).toContain("'=1+1");
    expect(text).toContain("'+unsafe");
  });

  it.each([true, false])(
    "qualifies candidates and an empty result in the UI (empty=%s)",
    (empty) => {
      const client = new QueryClient();
      const html = renderToStaticMarkup(
        createElement(
          QueryClientProvider,
          { client },
          createElement(StrikingDistanceTable, {
            projectId: "project-a",
            rows: empty ? [] : strikingReport.strikingDistance,
          }),
        ),
      );
      client.clear();
      expect(html).toContain("up to 1,000 top query-page rows");
      expect(html).toContain("not a complete inventory");
      expect(html).not.toContain("No striking-distance queries in this period");
      if (empty)
        expect(html).toContain("No candidates found in these returned rows");
    },
  );
});

describe("Search Performance exports", () => {
  it("persists bounded coverage and the actual PT window in a CSV", async () => {
    let content: Blob | null = null;
    const anchor = { href: "", download: "", click: vi.fn() };
    vi.stubGlobal("document", { createElement: () => anchor });
    vi.spyOn(URL, "createObjectURL").mockImplementation((blob) => {
      if (blob instanceof Blob) content = blob;
      return "blob:test";
    });
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    exportDimensionRows(
      "query",
      Array.from({ length: 1000 }, () => ({
        key: "=1+1",
        clicks: 0,
        impressions: 10,
        ctr: 0,
        position: 7,
      })),
      { startDate: "2026-08-15", endDate: "2026-09-11" },
      "csv",
      { rowLimit: 1000, returnedRows: 1000, mayBeTruncated: true },
    );
    expect(anchor.click).toHaveBeenCalledTimes(1);
    const csv = await new Response(content).text();
    expect(csv).toContain("Export coverage");
    expect(csv).toContain("more rows may exist");
    expect(csv).toContain("2026-08-15 to 2026-09-11");
    expect(csv).toContain("America/Los_Angeles");
    expect(csv).toContain("'=1+1");
  });

  it.each([true, false])(
    "keeps coverage and sanitized data when copying to Sheets (limit reached: %s)",
    async (mayBeTruncated) => {
      class BrowserClipboardItem {
        constructor(readonly items: Record<string, Promise<Blob>>) {}
      }
      let text = "";
      const write = vi.fn(async (items: BrowserClipboardItem[]) => {
        text = await (await items[0].items["text/plain"]).text();
      });
      vi.stubGlobal("ClipboardItem", BrowserClipboardItem);
      vi.stubGlobal("navigator", { clipboard: { write } });
      exportDimensionRows(
        "page",
        Array.from({ length: mayBeTruncated ? 1000 : 1 }, () => ({
          key: "+unsafe",
          clicks: 0,
          impressions: 10,
          ctr: 0,
          position: 7,
        })),
        { startDate: "2026-08-15", endDate: "2026-09-11" },
        "sheets",
        {
          rowLimit: 1000,
          returnedRows: mayBeTruncated ? 1000 : 1,
          mayBeTruncated,
        },
      );
      await vi.waitFor(() => expect(text).toContain("Export coverage"));
      expect(text).toContain("2026-08-15 to 2026-09-11");
      expect(text).toContain("America/Los_Angeles");
      expect(text).toContain("'+unsafe");
      expect(text).toContain(
        mayBeTruncated
          ? "more rows may exist"
          : "application limit not reached",
      );
      expect(text).not.toContain("full dataset");
    },
  );
});

describe("Search Performance totals", () => {
  it("shows dates and does not compute CTR/position deltas from undefined metrics", () => {
    const html = renderToStaticMarkup(
      createElement(TotalsCards, {
        report: {
          connected: true,
          range: {
            startDate: "2026-08-15",
            endDate: "2026-09-11",
            prevStartDate: "2026-07-18",
            prevEndDate: "2026-08-14",
          },
          totals: sumSearchTotals([]),
          prevTotals: sumSearchTotals([
            { clicks: 0, impressions: 10, ctr: 0, position: 5 },
          ]),
          strikingDistance: [],
          countries: [],
        },
      }),
    );
    expect(html).toContain("2026-08-15 to 2026-09-11");
    expect(html).toContain("PT (America/Los_Angeles)");
    expect(html).toContain("No impressions were returned");
    expect(html).toContain("—");
    expect(html).not.toContain(">0.0%<");
    expect(html).not.toContain("NaN");
  });
});
