import { z } from "zod";
import { ChannelReportRepository } from "../repositories/ChannelReportRepository";
import { channelReportSchema } from "@/types/schemas/channelReports";

export const channelReportBatchSchema = z
  .object({
    domain: z
      .string()
      .trim()
      .toLowerCase()
      .regex(/^[a-z0-9.-]+$/),
    reports: z.array(channelReportSchema).min(1).max(100),
  })
  .strict();

async function record(
  projectId: string,
  domain: string | null,
  input: unknown,
) {
  const batch = channelReportBatchSchema.parse(input);
  if (!domain || domain.toLowerCase() !== batch.domain)
    throw new Error("Report domain does not match this project");
  if (
    batch.reports.some(
      (row) => Date.parse(row.observedAt) > Date.now() + 60_000,
    )
  )
    throw new Error("Observation is in the future");
  // Validate the complete batch before writing. Upserts are idempotent, so a
  // storage failure can be retried without submitting URLs or running jobs.
  for (const report of batch.reports)
    await ChannelReportRepository.upsert(projectId, report);
  return { reports: await ChannelReportRepository.list(projectId) };
}
export const ChannelReportService = {
  record,
  list: ChannelReportRepository.list,
};
