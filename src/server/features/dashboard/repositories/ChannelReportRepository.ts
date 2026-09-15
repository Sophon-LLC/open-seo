import { and, eq, gt, sql } from "drizzle-orm";
import { db } from "@/db";
import { channelReports } from "@/db/schema";
import {
  channelReportSchema,
  type ChannelReport,
} from "@/types/schemas/channelReports";

async function list(projectId: string): Promise<ChannelReport[]> {
  const rows = await db
    .select()
    .from(channelReports)
    .where(eq(channelReports.projectId, projectId))
    .orderBy(channelReports.channel, channelReports.itemKey);
  return rows.map(({ projectId: _project, importedAt: _imported, ...row }) =>
    channelReportSchema.parse(row),
  );
}

async function upsert(projectId: string, row: ChannelReport) {
  const values = { ...row, projectId, importedAt: new Date().toISOString() };
  await db
    .insert(channelReports)
    .values(values)
    .onConflictDoUpdate({
      target: [
        channelReports.projectId,
        channelReports.channel,
        channelReports.itemKey,
      ],
      set: values,
      setWhere: and(
        gt(sql`excluded.observed_at`, channelReports.observedAt),
        sql`COALESCE(excluded.source_updated_at, '') >= COALESCE(${channelReports.sourceUpdatedAt}, '')`,
      ),
    });
}
export const ChannelReportRepository = { list, upsert };
