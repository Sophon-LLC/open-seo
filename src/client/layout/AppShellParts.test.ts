import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type * as ReactRouter from "@tanstack/react-router";
import { describe, expect, it, vi } from "vitest";
import { SeoApiStatusBanners } from "./AppShellParts";

vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof ReactRouter>()),
  Link: ({ children, to }: { children: ReactNode; to: string }) =>
    createElement("a", { href: to }, children),
}));
vi.mock("@/serverFunctions/organization", () => ({
  getOrganizationContext: vi.fn(),
  switchOrganization: vi.fn(),
}));
vi.mock("@/serverFunctions/projects", () => ({ getProjects: vi.fn() }));
vi.mock("@/serverFunctions/sam", () => ({
  listSamSessions: vi.fn(),
  archiveSamSession: vi.fn(),
  createSamSession: vi.fn(),
}));

describe("DataForSEO setup notice", () => {
  it("does not invent missing setup while loading or when no warning is needed", () => {
    const html = renderToStaticMarkup(
      createElement(SeoApiStatusBanners, {
        shouldShowSeoApiWarning: false,
        seoApiKeyStatusError: false,
      }),
    );
    expect(html).toBe("");
  });

  it("keeps a configuration-check failure unknown, not a missing key or Google outage", () => {
    const html = renderToStaticMarkup(
      createElement(SeoApiStatusBanners, {
        shouldShowSeoApiWarning: false,
        seoApiKeyStatusError: true,
      }),
    );
    expect(html).toContain("We could not verify your DataForSEO setup");
    expect(html).toContain("configuration status is unknown");
    expect(html).toContain("GSC and GA4 use separate Google authorization");
    expect(html).not.toContain("need an API key");
    expect(html).not.toContain("If features are not working");
    expect(html).not.toContain('role="dialog"');
  });

  it("limits missing setup to provider-backed features without blocking Google reports", () => {
    const html = renderToStaticMarkup(
      createElement(SeoApiStatusBanners, {
        shouldShowSeoApiWarning: true,
        seoApiKeyStatusError: false,
      }),
    );
    expect(html).toContain(
      "DataForSEO-backed keyword, SERP and backlink features",
    );
    expect(html).toContain("GSC and GA4 work independently");
    expect(html).toContain("Provider requests may incur charges");
    expect(html).toContain('href="/help/dataforseo-api-key"');
    expect(html).not.toContain("to use OpenSEO");
    expect(html).not.toContain('role="dialog"');
  });
});
