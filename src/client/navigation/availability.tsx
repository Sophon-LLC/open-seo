import { createContext, useContext, type ReactNode } from "react";
import { researchPaths } from "./items";

// A missing, pending or failed setup check must never mount provider pages.
// This is a UI availability boundary, not a replacement for server authorization.
export const FeatureAvailabilityContext = createContext({
  research: false,
  chat: false,
});
export const useFeatureAvailability = () =>
  useContext(FeatureAvailabilityContext);

export function AvailableRoute({
  pathname,
  projectId,
  children,
}: {
  pathname: string;
  projectId?: string;
  children?: ReactNode;
}) {
  const availability = useFeatureAvailability();
  const path = pathname
    .toLowerCase()
    .replace(/\/+$/, "")
    .replace(/^\/p\/[^/]+/, "/p/$projectId");
  const research = researchPaths.some(
    (base) => path === base || path.startsWith(`${base}/`),
  );
  const chat = path === "/p/$projectId/sam";
  if ((research && !availability.research) || (chat && !availability.chat)) {
    const base = projectId ? `/p/${encodeURIComponent(projectId)}` : "";
    return (
      <section className="mx-auto max-w-3xl space-y-4 p-6">
        <h1 className="text-2xl font-semibold">Not available in 1.0</h1>
        <p>
          This provider feature is hidden because its setup is missing or could
          not be verified. No provider request has been started. Existing data
          and configuration are preserved.
        </p>
        <p className="flex gap-4">
          <a className="link" href={base || "/"}>
            Dashboard
          </a>
          <a className="link" href={`${base}/settings`}>
            Settings
          </a>
        </p>
      </section>
    );
  }
  return children;
}
