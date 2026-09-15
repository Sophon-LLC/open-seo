import { expect, it } from "vitest";
import {
  indexNowEvidence,
  translationEvidence,
  scheduleEvidence,
} from "./channelEvidence";
const now = "2026-09-14T00:00:00.000Z";
it("imports an existing receipt without retrying it or exposing its raw body", () => {
  const rows = indexNowEvidence(
    {
      host: "heycue.io",
      status: "submitted",
      httpStatus: 200,
      checkedAt: now,
      urlList: ["https://heycue.io/test"],
      diagnosis: "PRIVATE",
    },
    "receipt.json",
    "heycue.io",
    now,
  );
  expect(rows[0]).toMatchObject({ status: "submitted", count: 1 });
  expect(JSON.stringify(rows)).not.toContain("PRIVATE");
  expect(() =>
    indexNowEvidence({ host: "other.test" }, "receipt.json", "heycue.io", now),
  ).toThrow();
});
it("maps model review separately from publishing and config separately from runs", () => {
  expect(
    translationEvidence(
      { completedAt: now, cells: [{ locale: "ja", status: "model-pass" }] },
      "review.json",
      now,
    )[0],
  ).toMatchObject({ channel: "translation", status: "model-pass", count: 1 });
  expect(
    scheduleEvidence(
      'id = "daily"\nname = "SEO"\nstatus = "ACTIVE"\nupdated_at = 1789257600000\nprompt = "PRIVATE"',
      "automation.toml",
      now,
    )[0],
  ).toMatchObject({ status: "unknown", configuration: "active", count: null });
});
