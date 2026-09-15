import { QueryClient, QueryObserver } from "@tanstack/react-query";
import { expect, it, vi } from "vitest";
import { refreshVisibleReports, canAutoRefresh } from "./dashboardRefresh";

it("refreshes only active, enabled, read-only reports for the selected project", async () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const cases = [
    ["dashboardGscReport", "a", true],
    ["dashboardGa4Report", "a", true],
    ["channelReports", "a", true],
    ["dashboardSearchDetails", "a", true],
    ["dashboardGscReport", "b", true],
    ["dashboardOverview", "a", true],
    ["dashboardGa4Report", "a", false],
  ] as const;
  const calls = cases.map(() => vi.fn(async () => ({ ok: true })));
  const observers = cases.map(
    ([key, project, enabled], i) =>
      new QueryObserver(client, {
        queryKey: [key, project, i],
        queryFn: calls[i],
        enabled,
      }),
  );
  const unsub = observers.map((o) => o.subscribe(() => {}));
  await Promise.all(observers.slice(0, 6).map((o) => o.refetch()));
  calls.forEach((c) => c.mockClear());
  const inactive = vi.fn(async () => 1);
  await client.fetchQuery({
    queryKey: ["dashboardGscReport", "a", "old-dates"],
    queryFn: inactive,
  });
  inactive.mockClear();
  await refreshVisibleReports(client, "a");
  calls.forEach((c, i) => expect(c).toHaveBeenCalledTimes(i < 4 ? 1 : 0));
  expect(inactive).not.toHaveBeenCalled();
  unsub.forEach((f) => f());
  client.clear();
});

it("does not turn a failed refresh into success or erase last good data", async () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const key = ["dashboardGscReport", "a"];
  client.setQueryData(key, { clicks: 12 });
  const observer = new QueryObserver(client, {
    queryKey: key,
    staleTime: Infinity,
    queryFn: async () => {
      throw new Error("offline");
    },
  });
  const unsubscribe = observer.subscribe(() => {});
  await expect(refreshVisibleReports(client, "a")).rejects.toThrow("offline");
  expect(client.getQueryData(key)).toEqual({ clicks: 12 });
  unsubscribe();
  client.clear();
});

it("pauses automatic refresh offline and when hidden", () => {
  expect(canAutoRefresh("visible", true)).toBe(true);
  expect(canAutoRefresh("hidden", true)).toBe(false);
  expect(canAutoRefresh("visible", false)).toBe(false);
});
