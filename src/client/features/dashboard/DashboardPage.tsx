import { GscCard } from "./GscCard";
import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { sort } from "remeda";
import { ReportRefreshControls } from "./ReportRefreshControls";
import { SkillsCatalog } from "../ai-mcp/SkillsCatalog";
import { DashboardOnboarding } from "./DashboardOnboarding";
import { DashboardFilters, type TrafficChannel } from "./DashboardFilters";
import {
  dashboardDates,
  advanceDashboardDates,
} from "@/types/schemas/reportDates";
import { useFeatureAvailability } from "@/client/navigation/availability";
import {
  AuditHealthCard,
  BacklinkPulseCard,
} from "@/client/features/dashboard/DashboardCards";
import { Ga4Card } from "@/client/features/dashboard/Ga4Card";
import { ChannelReportsCard } from "./ChannelReportsCard";
import { WorkspaceMergeBanner } from "@/client/features/dashboard/WorkspaceMergeBanner";
import { getStandardErrorMessage } from "@/client/lib/error-messages";
import {
  getDashboardActivation,
  getDashboardOverview,
  refreshDashboardBacklinkSnapshot,
} from "@/serverFunctions/dashboard";

export function DashboardPage({ projectId }: { projectId: string }) {
  const availability = useFeatureAvailability();
  const queryClient = useQueryClient();
  const [section, setSection] = useState<
    "traffic" | "indexing" | "content" | "skills"
  >("traffic");
  const [dates, setDates] = useState(() => dashboardDates(28));
  const [preset, setPreset] = useState<7 | 28 | 90 | null>(28);
  const [dataState, setDataState] = useState<"all" | "final">("all");
  const advanceDates = useCallback(() => {
    const next = advanceDashboardDates(dates, preset);
    if (next === dates) return false;
    setDates(next);
    return true;
  }, [dates, preset]);
  const [channel, setChannel] = useState<TrafficChannel>("all");

  const activationQuery = useQuery({
    queryKey: ["dashboardActivation", projectId],
    queryFn: () => getDashboardActivation({ data: { projectId } }),
  });
  const overviewQuery = useQuery({
    queryKey: ["dashboardOverview", projectId],
    queryFn: () => getDashboardOverview({ data: { projectId } }),
  });

  const activation = activationQuery.data;
  const overview = overviewQuery.data;

  // Visit-triggered backlink snapshot: fire once per page view when the
  // overview reports a missing or stale snapshot for a project with a domain.
  // The server re-checks freshness, so a stray double-fire costs nothing.
  const refreshMutation = useMutation({
    mutationFn: () => refreshDashboardBacklinkSnapshot({ data: { projectId } }),
    onSuccess: () =>
      void queryClient.invalidateQueries({
        queryKey: ["dashboardOverview", projectId],
      }),
  });
  const refreshFiredRef = useRef(false);
  const needsSnapshot =
    availability.research &&
    activation?.domain != null &&
    !overviewQuery.isError &&
    overview !== undefined &&
    (overview.backlinks === null || overview.backlinks.stale);
  useEffect(() => {
    if (!needsSnapshot || refreshFiredRef.current) return;
    refreshFiredRef.current = true;
    refreshMutation.mutate();
  }, [needsSnapshot, refreshMutation]);

  if (activationQuery.isError) {
    return (
      <div className="px-4 py-4 md:px-6 md:py-6">
        <div className="alert alert-error">
          {getStandardErrorMessage(activationQuery.error)}
        </div>
      </div>
    );
  }

  // Wait for the overview too: rendering cards from `overview === undefined`
  // flashes their empty states (and reshuffles the data-first sort) once the
  // real data lands. An overview error falls through so the page still loads.
  if (!activation || overviewQuery.isPending) {
    return (
      <div
        className="mx-auto flex max-w-5xl flex-col gap-5 px-4 py-4 md:px-6 md:py-6"
        aria-busy
      >
        <div className="skeleton h-8 w-52" />
        <div className="skeleton h-36" />
        <div className="grid gap-5 lg:grid-cols-2">
          <div className="skeleton h-44" />
          <div className="skeleton h-44" />
        </div>
      </div>
    );
  }

  const showBacklinks = availability.research && activation.domain !== null;
  const gscConnected = activation.gsc.connected;
  const ga4Connected = activation.ga4.connected;

  const cards = [
    ...(channel !== "ga4"
      ? [
          {
            key: "gsc",
            hasData: true,
            node: (
              <GscCard
                dataState={dataState}
                projectId={projectId}
                connected={gscConnected}
                dates={dates}
              />
            ),
          },
        ]
      : []),
    ...(channel !== "gsc" && (ga4Connected || !activation.ga4.cardDismissedAt)
      ? [
          {
            key: "ga4",
            hasData: ga4Connected,
            node: (
              <Ga4Card
                projectId={projectId}
                connected={ga4Connected}
                dates={dates}
              />
            ),
          },
        ]
      : []),
    ...(overview
      ? [
          {
            key: "audit",
            hasData: overview?.audit != null,
            node: (
              <AuditHealthCard
                projectId={projectId}
                audit={overview?.audit ?? null}
              />
            ),
          },
        ]
      : []),
    ...(showBacklinks && overview
      ? [
          {
            key: "backlinks",
            hasData: overview?.backlinks != null || refreshMutation.isPending,
            node: (
              <BacklinkPulseCard
                projectId={projectId}
                backlinks={overview?.backlinks ?? null}
                refreshing={refreshMutation.isPending}
                failed={refreshMutation.isError}
              />
            ),
          },
        ]
      : []),
  ];

  return (
    <div className="px-4 py-4 pb-24 md:px-6 md:py-6 md:pb-8">
      <div className="mx-auto flex max-w-5xl flex-col gap-5">
        <div>
          <h1 className="text-2xl font-semibold">Growth overview</h1>
          <p className="mt-1 text-sm text-base-content/60">
            Search visibility, qualified traffic and operational evidence
          </p>
        </div>
        {section !== "skills" && (
          <ReportRefreshControls
            key={projectId}
            projectId={projectId}
            onBeforeRefresh={advanceDates}
          />
        )}
        <nav
          aria-label="Dashboard sections"
          className="flex flex-wrap gap-2 border-b border-base-300 pb-3"
        >
          {(
            [
              ["traffic", "Traffic & conversion"],
              ["indexing", "Indexing & submissions"],
              ["content", "Content & tasks"],
              ["skills", "SEO & GEO Skills"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              aria-pressed={section === key}
              className={`btn btn-sm ${section === key ? "btn-primary" : "btn-ghost"}`}
              onClick={() => setSection(key)}
            >
              {label}
            </button>
          ))}
        </nav>
        {section === "skills" && <SkillsCatalog />}
        {section === "traffic" && (
          <DashboardFilters
            dates={dates}
            preset={preset}
            onPreset={setPreset}
            dataState={dataState}
            onDataState={setDataState}
            onDates={setDates}
            channel={channel}
            onChannel={setChannel}
          />
        )}

        {overviewQuery.isError ? (
          <p className="alert alert-error" role="alert">
            Could not load the audit and backlink overview. These results are
            unavailable, not zero. Any previously loaded snapshots may be stale.
          </p>
        ) : null}

        <WorkspaceMergeBanner />

        {/* Search trends span both columns. Show evidence before setup prompts. */}
        <div className="grid items-start gap-5 lg:grid-cols-2">
          {sort(
            cards.filter((card) =>
              section === "traffic"
                ? card.key === "gsc" || card.key === "ga4"
                : section === "indexing"
                  ? card.key === "audit" || card.key === "backlinks"
                  : false,
            ),
            (a, b) => Number(b.hasData) - Number(a.hasData),
          ).map((card) => (
            <div
              key={card.key}
              className={
                card.key === "gsc" || card.key === "ga4"
                  ? "min-w-0 lg:col-span-2"
                  : "min-w-0"
              }
            >
              {card.node}
            </div>
          ))}
        </div>
        {section === "indexing" && (
          <>
            <p className="text-sm text-base-content/60">
              Google page indexing status is not connected here. Site audit
              findings are not Google's indexing report.
            </p>
            <ChannelReportsCard
              key="indexing"
              projectId={projectId}
              onlyChannels={["bing", "indexnow"]}
            />
          </>
        )}
        {section === "content" && (
          <ChannelReportsCard
            key="content"
            projectId={projectId}
            onlyChannels={["translation", "schedule"]}
          />
        )}
        <details className="border-t border-base-300 pt-3">
          <summary className="cursor-pointer text-sm text-base-content/60">
            Connections & setup
          </summary>
          <DashboardOnboarding
            key={projectId}
            projectId={projectId}
            activation={activation}
          />
        </details>
      </div>
    </div>
  );
}
