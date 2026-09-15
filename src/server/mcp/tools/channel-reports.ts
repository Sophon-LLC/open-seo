import { z } from "zod";
import {
  ChannelReportService,
  channelReportBatchSchema,
} from "@/server/features/dashboard/services/ChannelReportService";
import { withMcpProjectAuth } from "@/server/mcp/project-auth";
import { projectIdSchema } from "@/server/mcp/schemas";
import { mcpResponse } from "@/server/mcp/formatters";
import { channelReportSchema } from "@/types/schemas/channelReports";

const inputSchema = {
  projectId: projectIdSchema,
  ...channelReportBatchSchema.shape,
};
export const importChannelReportsTool = {
  name: "import_channel_reports",
  config: {
    title: "Import channel evidence",
    description:
      "Store source-stamped Bing observations, IndexNow receipts, translation reviews or schedule results in this project's read-only dashboard. Uses no credits and does not contact providers, submit URLs, run jobs or publish. Import only verified evidence for this domain; omit secrets and raw error bodies. Missing values remain unknown. Does not establish a live API connection.",
    inputSchema,
    outputSchema: { reports: z.array(channelReportSchema) },
    annotations: {
      readOnlyHint: false,
      openWorldHint: false,
      destructiveHint: false,
      idempotentHint: true,
    },
  },
  handler: withMcpProjectAuth(
    async (args: z.infer<z.ZodObject<typeof inputSchema>>, context) => {
      const result = await ChannelReportService.record(
        args.projectId,
        context.project.domain,
        { domain: args.domain, reports: args.reports },
      );
      return mcpResponse({
        text: "Channel evidence imported. No provider requests or publishing performed.",
        structuredContent: result,
      });
    },
  ),
};

export const getChannelReportsTool = {
  name: "get_channel_reports",
  config: {
    title: "Read channel evidence",
    description:
      "Read this project's imported operational evidence. Historical snapshots, not live provider metrics. Uses no credits.",
    inputSchema: { projectId: projectIdSchema },
    outputSchema: { reports: z.array(channelReportSchema) },
    annotations: {
      readOnlyHint: true,
      openWorldHint: false,
      destructiveHint: false,
    },
  },
  handler: withMcpProjectAuth(async (args: { projectId: string }) =>
    mcpResponse({
      text: "Source-stamped channel evidence; unknown is not zero.",
      structuredContent: {
        reports: await ChannelReportService.list(args.projectId),
      },
    }),
  ),
};
