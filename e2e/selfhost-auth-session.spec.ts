import { expect, test } from "@playwright/test";

// The shared Playwright server runs in local_noauth mode. Exercise the real
// root/auth layouts and Better Auth client, without a mocked session endpoint.
test("self-hosted layouts do not request the hosted session endpoint", async ({
  page,
}) => {
  const sessionRequests: string[] = [];
  page.on("request", (request) => {
    if (new URL(request.url()).pathname === "/api/auth/get-session") {
      sessionRequests.push(request.url());
    }
  });

  await page.goto("/sign-in");
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Continue with Google" }),
  ).toBeDisabled();
  await page.waitForLoadState("networkidle");

  expect(sessionRequests).toEqual([]);
});
