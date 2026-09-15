import { readFileSync, statSync } from "node:fs";
import { basename } from "node:path";
import { parseArgs } from "node:util";
import { z } from "zod";
import {
  channelReportSchema,
  type ChannelReport,
} from "../src/types/schemas/channelReports";
import {
  indexNowEvidence,
  scheduleEvidence,
  translationEvidence,
} from "../src/types/schemas/channelEvidence";

// Explicit inputs only: no directory scanning, provider calls, URL submissions,
// model generation or scheduling. --apply writes evidence to loopback OpenSEO.
const { values } = parseArgs({
  options: {
    project: { type: "string" },
    domain: { type: "string" },
    endpoint: { type: "string", default: "http://127.0.0.1:3014/mcp" },
    indexnow: { type: "string", multiple: true },
    translation: { type: "string", multiple: true },
    automation: { type: "string", multiple: true },
    bing: { type: "string", multiple: true },
    apply: { type: "boolean", default: false },
  },
});
const projectId = z.uuid().parse(values.project);
const domain = z
  .string()
  .regex(/^[a-z0-9.-]+$/)
  .parse(values.domain);
const endpoint = new URL(values.endpoint!);
if (
  endpoint.protocol !== "http:" ||
  endpoint.hostname !== "127.0.0.1" ||
  endpoint.pathname !== "/mcp" ||
  endpoint.username ||
  endpoint.password ||
  endpoint.search ||
  endpoint.hash
)
  throw new Error("Only loopback MCP is allowed");
const now = new Date().toISOString();
const reports: ChannelReport[] = [];
for (const kind of ["indexnow", "translation", "automation", "bing"] as const)
  for (const path of values[kind] ?? []) {
    if (statSync(path).size > 2_000_000)
      throw new Error("Evidence file too large");
    const text = readFileSync(path, "utf8");
    const source = basename(path);
    if (kind === "automation")
      reports.push(...scheduleEvidence(text, source, now));
    else if (kind === "indexnow")
      reports.push(...indexNowEvidence(JSON.parse(text), source, domain, now));
    else if (kind === "translation")
      reports.push(...translationEvidence(JSON.parse(text), source, now));
    else {
      const input = z
        .object({
          domain: z.literal(domain),
          reports: z.array(channelReportSchema),
        })
        .parse(JSON.parse(text));
      if (input.reports.some((row) => row.channel !== "bing"))
        throw new Error("Bing evidence only");
      reports.push(...input.reports);
    }
  }
if (reports.length === 0 || reports.length > 100)
  throw new Error("Provide 1–100 evidence rows");
if (!values.apply)
  console.log(
    JSON.stringify({ mode: "dry-run", projectId, domain, reports }, null, 2),
  );
else {
  const response = await fetch(endpoint, {
    method: "POST",
    redirect: "error",
    signal: AbortSignal.timeout(30000),
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: {
        name: "import_channel_reports",
        arguments: { projectId, domain, reports },
      },
    }),
  });
  const result = z
    .object({
      result: z.object({
        isError: z.boolean().optional(),
        structuredContent: z.object({ reports: z.array(channelReportSchema) }),
      }),
    })
    .safeParse(await response.json());
  if (!response.ok || !result.success || result.data.result.isError)
    throw new Error("Evidence import failed; no provider requests were made");
  console.log(
    JSON.stringify({
      imported: true,
      storedRows: result.data.result.structuredContent.reports.length,
      providerRequests: 0,
    }),
  );
}
