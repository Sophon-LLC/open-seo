import type { QueryClient } from "@tanstack/react-query";

// Explicit allow-list: never refresh paid research, audits, mutations or exports.
const reportKeys = new Set([
  "dashboardGscReport",
  "dashboardGa4Report",
  "dashboardSearchDetails",
  "channelReports",
]);
export function canAutoRefresh(visibility: string, online: boolean) {
  return visibility === "visible" && online;
}
export function refreshVisibleReports(client: QueryClient, projectId: string) {
  return client.refetchQueries(
    {
      type: "active",
      predicate: (q) =>
        q.queryKey[1] === projectId && reportKeys.has(String(q.queryKey[0])),
    },
    { throwOnError: true, cancelRefetch: false },
  );
}
