import { describe, expect, it } from "vitest";
import { channelReportSchema, describeChannelStatus } from "./channelReports";

describe("read-only channel evidence", () => {
  it("requires fixed timestamp precision and rejects counts outside database capacity", () => {
    const input = {
      channel: "bing",
      itemKey: "clicks",
      label: "Clicks",
      status: "observed",
      source: "report.json",
      count: 1,
      observedAt: "2026-09-14T01:00:00Z",
      sourceUpdatedAt: "2026-09-14T01:00:00.001Z",
    };
    expect(channelReportSchema.safeParse(input).success).toBe(false);
    const valid = {
      ...input,
      observedAt: "2026-09-14T01:00:00.000Z",
      sourceUpdatedAt: null,
    };
    expect(channelReportSchema.parse(valid).observedAt).toBe(
      "2026-09-14T01:00:00.000Z",
    );
    expect(
      channelReportSchema.safeParse({ ...valid, count: 2147483648 }).success,
    ).toBe(false);
  });
  it("keeps an accepted IndexNow receipt separate from indexing", () => {
    const report = channelReportSchema.parse({
      channel: "indexnow",
      itemKey: "receipt-1",
      label: "URL submission",
      status: "submitted",
      count: 3,
      source: "indexnow-receipt.json",
      observedAt: "2026-09-14T01:00:00.000Z",
      sourceUpdatedAt: "2026-09-13T01:00:00.000Z",
    });
    expect(describeChannelStatus(report)).toBe(
      "Submitted — indexing not verified",
    );
    expect(
      channelReportSchema.safeParse({ ...report, status: "indexed" }).success,
    ).toBe(false);
  });
  it("does not turn missing measurements or configured jobs into success", () => {
    const input = {
      channel: "schedule",
      itemKey: "daily",
      label: "Daily SEO",
      status: "unknown",
      configuration: "active",
      source: "automation.toml",
      observedAt: "2026-09-14T01:00:00.000Z",
    };
    const row = channelReportSchema.parse(input);
    expect(row.count).toBeNull();
    expect(describeChannelStatus(row)).toBe("Run status unknown");
    expect(
      describeChannelStatus({ channel: "translation", status: "model-pass" }),
    ).toBe("Model review passed — editorial and publication not verified");
    expect(
      channelReportSchema.safeParse({ ...input, channel: "bing", count: 0 })
        .success,
    ).toBe(false);
    expect(
      channelReportSchema.safeParse({
        ...input,
        periodStart: "2026-09-15",
        periodEnd: "2026-09-14",
      }).success,
    ).toBe(false);
  });
});
