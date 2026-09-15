import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { readFileSync } from "node:fs";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import { beforeEach, expect, it, vi } from "vitest";
import { ChannelReportService } from "./ChannelReportService";

const state = vi.hoisted(() => ({ database: null as DatabaseSync | null }));
vi.mock("cloudflare:workers", () => ({ env: {} }));
vi.mock("@/db", () => ({
  db: drizzle(async (query, params, method) => {
    if (!state.database) throw new Error("No database");
    const statement = state.database.prepare(query);
    const values = params.map((v: unknown): SQLInputValue => {
      if (
        v === null ||
        typeof v === "string" ||
        typeof v === "number" ||
        typeof v === "bigint"
      )
        return v;
      throw new Error("Unexpected parameter");
    });
    if (method === "run") {
      statement.run(...values);
      return { rows: [] };
    }
    return { rows: statement.all(...values).map(Object.values) };
  }),
}));
beforeEach(() => {
  state.database?.close();
  state.database = new DatabaseSync(":memory:");
  state.database.exec(
    "PRAGMA foreign_keys=ON; CREATE TABLE projects (id text PRIMARY KEY); INSERT INTO projects VALUES ('a'), ('b');",
  );
  state.database.exec(readFileSync("drizzle/0047_channel_reports.sql", "utf8"));
});
const report = {
  channel: "indexnow",
  itemKey: "batch-1",
  label: "9 URLs",
  status: "submitted",
  count: 9,
  source: "receipt.json",
  observedAt: "2026-09-13T14:00:00.000Z",
  sourceUpdatedAt: "2026-09-13T13:00:00.000Z",
};
it("persists source evidence, isolates projects and does not replace newer observations", async () => {
  await ChannelReportService.record("a", "heycue.io", {
    domain: "heycue.io",
    reports: [report],
  });
  expect((await ChannelReportService.list("a"))[0]).toMatchObject({
    status: "submitted",
    count: 9,
    sourceUpdatedAt: report.sourceUpdatedAt,
  });
  expect(await ChannelReportService.list("b")).toEqual([]);
  await ChannelReportService.record("a", "heycue.io", {
    domain: "heycue.io",
    reports: [
      {
        ...report,
        status: "rejected",
        observedAt: "2026-09-12T14:00:00.000Z",
        sourceUpdatedAt: "2026-09-12T13:00:00.000Z",
      },
    ],
  });
  expect((await ChannelReportService.list("a"))[0]?.status).toBe("submitted");
  await expect(
    ChannelReportService.record("a", "heycue.io", {
      domain: "elsewhere.test",
      reports: [report],
    }),
  ).rejects.toThrow();
});
