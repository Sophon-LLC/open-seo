import { z } from "zod";

export const channels = [
  "bing",
  "indexnow",
  "translation",
  "schedule",
] as const;
const statuses = {
  bing: ["observed", "unknown", "failed"],
  indexnow: [
    "pending",
    "submitted",
    "pending-key-validation",
    "preflight-failed",
    "rejected",
    "submission-unknown",
    "unknown",
  ],
  translation: ["model-pass", "failed", "unknown"],
  schedule: ["success", "failed", "unknown"],
} as const;
// Fixed precision keeps SQL text ordering consistent and MCP JSON Schema serializable.
const timestamp = z.iso.datetime().regex(/\.\d{3}Z$/);

// One source-stamped measurement/receipt per row, not a claim about deployment,
// indexing, or revenue. Null is intentionally different from a measured zero.
export const channelReportSchema = z
  .object({
    channel: z.enum(channels),
    itemKey: z
      .string()
      .regex(/^[a-zA-Z0-9._:-]+$/)
      .max(160),
    label: z.string().trim().min(1).max(160),
    status: z.string().max(40),
    count: z
      .number()
      .int()
      .nonnegative()
      .max(2147483647)
      .nullable()
      .default(null),
    source: z.string().trim().min(1).max(400),
    observedAt: timestamp,
    sourceUpdatedAt: timestamp.nullable().default(null),
    periodStart: z.iso.date().nullable().default(null),
    periodEnd: z.iso.date().nullable().default(null),
    scope: z.string().max(160).nullable().default(null),
    configuration: z.enum(["active", "paused"]).nullable().default(null),
  })
  .strict()
  .superRefine((row, ctx) => {
    if (!(statuses[row.channel] as readonly string[]).includes(row.status)) {
      ctx.addIssue({
        code: "custom",
        path: ["status"],
        message: "Invalid status for channel",
      });
    }
    if (
      (row.status === "unknown" && row.count !== null) ||
      (row.channel !== "schedule" && row.configuration !== null)
    ) {
      ctx.addIssue({
        code: "custom",
        message:
          "Unknown data cannot be counted; configuration applies only to schedules",
      });
    }
    if (
      (row.periodStart === null) !== (row.periodEnd === null) ||
      (row.periodStart && row.periodEnd && row.periodStart > row.periodEnd)
    ) {
      ctx.addIssue({
        code: "custom",
        message: "A complete, ordered reporting period is required",
      });
    }
    if (row.sourceUpdatedAt && row.sourceUpdatedAt > row.observedAt) {
      ctx.addIssue({
        code: "custom",
        message: "Source cannot be newer than observation",
      });
    }
  });
export type ChannelReport = z.infer<typeof channelReportSchema>;

export function describeChannelStatus(
  row: Pick<ChannelReport, "channel" | "status">,
): string {
  if (row.channel === "indexnow" && row.status === "submitted")
    return "Submitted — indexing not verified";
  if (row.channel === "translation" && row.status === "model-pass")
    return "Model review passed — editorial and publication not verified";
  if (row.channel === "schedule" && row.status === "unknown")
    return "Run status unknown";
  const labels: Record<string, string> = {
    unknown: "Unknown — no verified result",
    observed: "Historical observation",
    pending: "Pending submission",
    "pending-key-validation": "Submitted — key validation pending",
    "preflight-failed": "Preflight failed — not submitted",
    rejected: "Submission rejected",
    "submission-unknown": "Submission outcome unknown — do not blindly retry",
    failed: "Failed",
    success: "Run succeeded",
  };
  return labels[row.status] ?? "Unknown";
}
