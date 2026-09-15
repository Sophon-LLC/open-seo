import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { expect, it, vi } from "vitest";
import { LaunchFormCard } from "./LaunchFormCard";
import { useLaunchController } from "./useLaunchController";

vi.mock("@/serverFunctions/audit", () => ({
  startAudit: vi.fn(),
  getAuditHistory: vi.fn(),
  deleteAudit: vi.fn(),
}));

it("offers a basic crawl without unavailable paid Lighthouse", () => {
  function Launch() {
    const controller = useLaunchController({
      projectId: "project-a",
      isFreePlan: false,
      onAuditStarted() {},
    });
    return createElement(LaunchFormCard, controller);
  }
  const client = new QueryClient();
  const html = renderToStaticMarkup(
    createElement(QueryClientProvider, { client }, createElement(Launch)),
  );
  client.clear();
  expect(html).toContain("Start Audit");
  expect(html).not.toContain("Include Lighthouse");
});
