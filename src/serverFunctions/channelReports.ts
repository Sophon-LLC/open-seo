import { createServerFn } from "@tanstack/react-start";
import { requireProjectContext } from "@/serverFunctions/middleware";
import { dashboardProjectInputSchema } from "@/types/schemas/dashboard";
import { ChannelReportService } from "@/server/features/dashboard/services/ChannelReportService";

export const getChannelReports = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(dashboardProjectInputSchema)
  .handler(({ context }) => ChannelReportService.list(context.projectId));
