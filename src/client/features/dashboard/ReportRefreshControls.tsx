import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { canAutoRefresh, refreshVisibleReports } from "./dashboardRefresh";

export function ReportRefreshControls({
  projectId,
  onBeforeRefresh,
}: {
  projectId: string;
  onBeforeRefresh?: () => boolean;
}) {
  const client = useQueryClient();
  const [automatic, setAutomatic] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("Reports load when opened.");
  const inFlight = useRef(false);
  const refresh = useCallback(async () => {
    if (inFlight.current) return;
    if (!navigator.onLine) {
      setMessage(
        "Offline — refresh paused. Previously loaded data may be stale.",
      );
      return;
    }
    inFlight.current = true;
    setBusy(true);
    try {
      if (onBeforeRefresh?.()) {
        setMessage("Date window advanced. Loading reports for the new dates…");
        return;
      }
      await refreshVisibleReports(client, projectId);
      setMessage(
        `Visible reports checked at ${new Date().toLocaleTimeString()}. Source dates below remain authoritative.`,
      );
    } catch {
      setMessage(
        "Some reports could not refresh. Last successful values may be stale; check the source cards.",
      );
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }, [client, projectId, onBeforeRefresh]);
  useEffect(() => {
    if (!automatic) return;
    const timer = window.setInterval(
      () => {
        if (canAutoRefresh(document.visibilityState, navigator.onLine))
          void refresh();
      },
      5 * 60 * 1000,
    );
    const resume = () => {
      if (canAutoRefresh(document.visibilityState, navigator.onLine))
        void refresh();
    };
    document.addEventListener("visibilitychange", resume);
    window.addEventListener("online", resume);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", resume);
      window.removeEventListener("online", resume);
    };
  }, [automatic, refresh]);
  return (
    <section
      aria-label="Report updates"
      className="rounded-xl border border-base-300 p-4 space-y-2"
    >
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="toggle toggle-sm"
            checked={automatic}
            onChange={(e) => setAutomatic(e.target.checked)}
          />
          Auto-refresh every 5 minutes
        </label>
        <button
          className="btn btn-sm sm:ml-auto"
          disabled={busy}
          onClick={() => void refresh()}
        >
          {busy ? "Refreshing…" : "Refresh visible reports"}
        </button>
      </div>
      <p role="status" className="text-xs text-base-content/70">
        {message}
      </p>
      <details className="text-xs text-base-content/60">
        <summary className="cursor-pointer">
          What updates automatically?
        </summary>
        <p className="mt-2">
          While this dashboard is visible and online, connected GSC and GA4
          reports are re-fetched for your selected dates. Bing, IndexNow,
          translation and scheduled-task cards re-read imported evidence only;
          their upstream workflows are unchanged. Closing the page stops
          refresh. Server-side scheduled sync is not yet enabled. No paid
          research, publishing or software upgrades are triggered.
        </p>
      </details>
    </section>
  );
}
