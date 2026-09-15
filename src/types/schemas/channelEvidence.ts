import { z } from "zod";
import { channelReportSchema, type ChannelReport } from "./channelReports";

export function indexNowEvidence(
  input: unknown,
  source: string,
  domain: string,
  observedAt: string,
): ChannelReport[] {
  const receipt = z
    .object({
      host: z.string(),
      checkedAt: z.iso.datetime(),
      status: z.string(),
      httpStatus: z.number().nullable(),
      urlList: z.array(z.url()),
      singleUrlProbe: z
        .object({ url: z.url(), httpStatus: z.number() })
        .optional(),
    })
    .parse(input);
  if (
    receipt.host !== domain ||
    receipt.urlList.some((url) => new URL(url).hostname !== domain)
  )
    throw new Error("Receipt site mismatch");
  if (receipt.status === "submitted" && receipt.httpStatus !== 200)
    throw new Error("Inconsistent IndexNow receipt");
  const rows = [
    channelReportSchema.parse({
      channel: "indexnow",
      itemKey: source,
      label: "URLs in recorded batch",
      status: receipt.status,
      count: receipt.urlList.length,
      source,
      observedAt,
      sourceUpdatedAt: receipt.checkedAt,
      scope:
        "Receipt only; batches may overlap. Not a unique indexed URL total.",
    }),
  ];
  if (receipt.singleUrlProbe) {
    if (new URL(receipt.singleUrlProbe.url).hostname !== domain)
      throw new Error("Probe site mismatch");
    rows.push(
      channelReportSchema.parse({
        ...rows[0],
        itemKey: source + ":probe",
        label: "Single-URL probe",
        count: 1,
        status:
          receipt.singleUrlProbe.httpStatus === 200 ? "submitted" : "rejected",
      }),
    );
  }
  return rows;
}

export function translationEvidence(
  input: unknown,
  source: string,
  observedAt: string,
): ChannelReport[] {
  const receipt = z
    .object({
      completedAt: z.iso.datetime(),
      cells: z.array(
        z.object({ locale: z.string().regex(/^[a-z-]+$/), status: z.string() }),
      ),
    })
    .parse(input);
  const groups = new Map<
    string,
    { locale: string; status: string; count: number }
  >();
  for (const cell of receipt.cells) {
    const status =
      cell.status === "model-pass"
        ? "model-pass"
        : cell.status === "failed"
          ? "failed"
          : "unknown";
    const key = cell.locale + ":" + status;
    const group = groups.get(key) ?? { locale: cell.locale, status, count: 0 };
    group.count++;
    groups.set(key, group);
  }
  return [...groups.values()].map((group) =>
    channelReportSchema.parse({
      channel: "translation",
      itemKey: source + ":" + group.locale + ":" + group.status,
      label: group.locale + " translation review cells",
      status: group.status,
      count: group.status === "unknown" ? null : group.count,
      source,
      observedAt,
      sourceUpdatedAt: receipt.completedAt,
      scope:
        "Historical model-review receipt; current source/translation freshness not revalidated.",
    }),
  );
}

// Read only these four scalar lines from the existing automation TOML. Never
// import its prompt, account identifiers or filesystem context into a report.
export function scheduleEvidence(
  toml: string,
  source: string,
  observedAt: string,
): ChannelReport[] {
  const field = (name: string) => {
    const match = toml.match(
      new RegExp("^" + name + ' = ("(?:[^"\\\\]|\\\\.)*")$', "m"),
    );
    return match ? z.string().parse(JSON.parse(match[1])) : undefined;
  };
  const id = field("id");
  const name = field("name");
  const status = field("status");
  if (!id || !name || !["ACTIVE", "PAUSED"].includes(status ?? ""))
    throw new Error("Unrecognized automation configuration");
  const updated = toml.match(/^updated_at = (\d+)$/m);
  return [
    channelReportSchema.parse({
      channel: "schedule",
      itemKey: id,
      label: name,
      status: "unknown",
      configuration: status === "ACTIVE" ? "active" : "paused",
      source,
      observedAt,
      sourceUpdatedAt: updated
        ? new Date(Number(updated[1])).toISOString()
        : null,
      scope:
        "Configuration snapshot only. Last run/result not available from this source.",
    }),
  ];
}
