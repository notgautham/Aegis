"use client";

import Link from "next/link";
import { Layers3, Radar, ShieldCheck } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { AppHeader } from "@/components/app-header";
import { MissionLayout } from "@/components/mission-layout";
import { MetricCard } from "@/components/metric-card";
import { DegradedModePanel, EventFeedPanel, SummaryMetricGrid } from "@/components/scan-overview-panels";
import { EmptyRouteState, ErrorRouteState, LoadingRouteState } from "@/components/route-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  getActionPriorityLabel,
  getAssetLabel,
  getAssetLocation,
  getAssetTier,
  getRiskScore,
  getRiskTone,
  getTierVariant,
  getUrgencyLabel,
} from "@/lib/result-helpers";
import { buildScanHref } from "@/lib/scan-storage";
import { useBackendHealth } from "@/lib/use-backend-health";
import { useScanResults } from "@/lib/use-scan-results";

const chartColors = {
  danger: "#f87171",
  warning: "#fbbf24",
  success: "#34d399",
  primary: "#78a7ff",
} as const;

export function RiskHeatmapWorkspace({
  initialScanParam,
}: {
  initialScanParam?: string | null;
}) {
  const healthState = useBackendHealth();
  const { isHydrated, resolvedScanId, invalidQueryParam, isLoading, error, results, retry } =
    useScanResults({
      initialScanParam,
    });

  if (!isHydrated) {
    return (
      <MissionLayout
        activeSection="risk-heatmap"
        contextScanId={null}
        header={
          <AppHeader
            healthState={healthState}
            activeTarget={null}
            activeStatus={null}
            activeStage={null}
            elapsedSeconds={null}
            summary={null}
            degradedModeCount={0}
            eyebrow="Risk Surface"
            title="Risk heatmap workspace"
            description="A dedicated analytical surface for scan-wide prioritization and per-asset drill-in."
            telemetryNote="This route only activates when a valid scan context is resolved from navigation or remembered state."
          />
        }
      >
        <LoadingRouteState
          eyebrow="Risk surface"
          title="Resolving scan context"
          description="The workspace is waiting for a valid scan reference before it requests any backend data."
        />
      </MissionLayout>
    );
  }

  const header = (
    <AppHeader
      healthState={healthState}
      activeTarget={results?.target ?? null}
      activeStatus={results?.status ?? null}
      activeStage={results?.stage ?? null}
      elapsedSeconds={results?.elapsed_seconds ?? null}
      summary={results?.summary ?? null}
      degradedModeCount={results?.degraded_modes.length ?? 0}
      eyebrow="Risk Surface"
      title="Risk heatmap workspace"
      description="Scan-wide prioritization, compliance mix, and direct drill-in to the assets carrying the most quantum exposure."
      telemetryNote="This view uses the compiled scan results payload directly, so every metric and tier stays backend-sourced."
    />
  );

  if (invalidQueryParam) {
    return (
      <MissionLayout activeSection="risk-heatmap" header={header}>
        
        <EmptyRouteState
          eyebrow="Invalid scan reference"
          title="This route needs a valid scan ID"
          description="The provided scan query parameter is malformed. Start from Mission Control or reuse a valid completed scan."
        />
      </MissionLayout>
    );
  }

  if (!resolvedScanId) {
    return (
      <MissionLayout activeSection="risk-heatmap" contextScanId={resolvedScanId} header={header}>
        <EmptyRouteState
          eyebrow="No scan context"
          title="No scan is available for heatmap analysis"
          description="Resolve a scan by launching one from Mission Control or opening a completed scan link with a valid scan query parameter."
        />
      </MissionLayout>
    );
  }

  if (isLoading && !results) {
    return (
      <MissionLayout activeSection="risk-heatmap" contextScanId={resolvedScanId} header={header}>
        <LoadingRouteState
          eyebrow="Risk surface"
          title="Loading completed scan results"
          description="The workspace is fetching scan-wide results and suppressing stale data until the active scan is ready."
        />
      </MissionLayout>
    );
  }

  if (error) {
    return (
      <MissionLayout activeSection="risk-heatmap" contextScanId={resolvedScanId} header={header}>
        <ErrorRouteState
          eyebrow="Results unavailable"
          title="The risk workspace could not load this scan"
          description={error}
          actionHref="/"
          actionLabel="Return to scan control"
          onRetry={retry}
        />
      </MissionLayout>
    );
  }

  if (!results || results.status === "pending" || results.status === "running") {
    return (
      <MissionLayout activeSection="risk-heatmap" contextScanId={results?.scan_id ?? resolvedScanId} header={header}>
        <EmptyRouteState
          eyebrow="Scan still running"
          title="The risk workspace opens after scan results are compiled"
          description="This scan has not reached a terminal state yet. Mission Control remains the right place for live polling and stage telemetry."
          actionHref="/"
          actionLabel="Back to Mission Control"
        />
      </MissionLayout>
    );
  }

  if (!results.summary) {
    return (
      <MissionLayout activeSection="risk-heatmap" contextScanId={results.scan_id} header={header}>
        <ErrorRouteState
          eyebrow="Summary unavailable"
          title="This scan does not include a compiled summary"
          description="The heatmap route only renders backend-provided summary metrics. Retry the scan results request or return to Mission Control."
          actionHref="/"
          actionLabel="Return to scan control"
          onRetry={retry}
        />
      </MissionLayout>
    );
  }

  const complianceChartData = [
    { label: "Vulnerable", value: results.summary.vulnerable_assets, fill: chartColors.danger },
    {
      label: "Transitioning",
      value: results.summary.transitioning_assets,
      fill: chartColors.warning,
    },
    {
      label: "Ready",
      value: results.summary.fully_quantum_safe_assets,
      fill: chartColors.success,
    },
  ].filter((entry) => typeof entry.value === "number");

  const artifactChartData = results.progress
    ? [
        { label: "Assessments", value: results.progress.assessments_created },
        { label: "CBOMs", value: results.progress.cboms_created },
        { label: "Remediations", value: results.progress.remediations_created },
        { label: "Certificates", value: results.progress.certificates_created },
      ]
    : [];
  const orderedAssets = [...results.assets].sort((left, right) => {
    const rank = (tier: ReturnType<typeof getAssetTier>) => {
      switch (tier) {
        case "QUANTUM_VULNERABLE":
          return 0;
        case "PQC_TRANSITIONING":
          return 1;
        case "FULLY_QUANTUM_SAFE":
          return 2;
        default:
          return 3;
      }
    };

    return (
      rank(getAssetTier(left)) -
      rank(getAssetTier(right)) ||
      (getRiskScore(right) ?? -1) - (getRiskScore(left) ?? -1)
    );
  });

  return (
    <MissionLayout activeSection="risk-heatmap" contextScanId={results.scan_id} header={header}>
      <div className="space-y-5">
        <SummaryMetricGrid summary={results.summary} progress={results.progress} />

        <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="telemetry-panel overflow-hidden rounded-[28px] border border-white/8 bg-card/90 p-5 shadow-command">
            <div className="mb-5 flex items-start justify-between gap-3">
              <div>
                <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
                  Compliance heat bands
                </p>
                <h3 className="mt-3 text-2xl font-semibold text-foreground">
                  Scan-wide quantum exposure
                </h3>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                  Tier counts come directly from the backend summary, while the
                  asset grid below stays clickable for per-asset drill-in.
                </p>
              </div>
              <Badge variant="outline" className="gap-2">
                <Radar className="h-3.5 w-3.5" />
                {results.assets.length} assets
              </Badge>
            </div>

            {complianceChartData.some((entry) => entry.value > 0) ? (
              <div className="h-72 rounded-[24px] border border-white/6 bg-black/15 p-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={complianceChartData}>
                    <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
                    <XAxis dataKey="label" stroke="rgba(255,255,255,0.5)" />
                    <YAxis allowDecimals={false} stroke="rgba(255,255,255,0.5)" />
                    <Tooltip
                      cursor={{ fill: "rgba(255,255,255,0.04)" }}
                      contentStyle={{
                        backgroundColor: "rgba(17, 21, 37, 0.95)",
                        border: "1px solid rgba(255,255,255,0.1)",
                        borderRadius: 18,
                      }}
                    />
                    <Bar dataKey="value" radius={[12, 12, 0, 0]}>
                      {complianceChartData.map((entry) => (
                        <Cell key={entry.label} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="rounded-[24px] border border-white/8 bg-black/15 p-5 text-sm leading-6 text-muted-foreground">
                No compliance counts are available for this scan summary yet.
              </div>
            )}
          </div>

          <div className="space-y-5">
            <div className="telemetry-panel overflow-hidden rounded-[28px] border border-white/8 bg-card/90 p-5 shadow-command">
              <div className="mb-5 flex items-start justify-between gap-3">
                <div>
                  <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
                    Artifact flow
                  </p>
                  <h3 className="mt-3 text-2xl font-semibold text-foreground">
                    Persisted output count
                  </h3>
                </div>
                <ShieldCheck className="h-5 w-5 text-sidebar-accent" />
              </div>
              {artifactChartData.length > 0 ? (
                <div className="h-72 rounded-[24px] border border-white/6 bg-black/15 p-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={artifactChartData}>
                      <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
                      <XAxis dataKey="label" stroke="rgba(255,255,255,0.5)" />
                      <YAxis allowDecimals={false} stroke="rgba(255,255,255,0.5)" />
                      <Tooltip
                        cursor={{ fill: "rgba(255,255,255,0.04)" }}
                        contentStyle={{
                          backgroundColor: "rgba(17, 21, 37, 0.95)",
                          border: "1px solid rgba(255,255,255,0.1)",
                          borderRadius: 18,
                        }}
                      />
                      <Bar dataKey="value" fill={chartColors.primary} radius={[12, 12, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <MetricCard
                  label="Artifacts"
                  value="Unavailable"
                  hint="This route will not infer artifact counts if the backend omitted them."
                />
              )}
            </div>
            <DegradedModePanel degradedModes={results.degraded_modes} />
          </div>
        </div>

        <div className="telemetry-panel overflow-hidden rounded-[28px] border border-white/8 bg-card/90 p-5 shadow-command">
          <div className="mb-5 flex items-start justify-between gap-3">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
                Risk heatmap
              </p>
              <h3 className="mt-3 text-2xl font-semibold text-foreground">
                Asset-level investigation grid
              </h3>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
                Each asset card renders direct backend facts only: risk score,
                compliance tier, and negotiated TLS details when available.
              </p>
            </div>
            <Badge variant="outline" className="gap-2">
              <Layers3 className="h-3.5 w-3.5" />
              Drill into asset workbench
            </Badge>
          </div>

          {results.assets.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
              {orderedAssets.map((asset) => {
                const tier = getAssetTier(asset);
                const riskScore = getRiskScore(asset);

                return (
                  <Link
                    key={asset.asset_id}
                    href={`/assets/${asset.asset_id}?scan=${results.scan_id}`}
                    className={`group rounded-[26px] border border-white/8 bg-gradient-to-br ${getRiskTone(
                      riskScore
                    )} from-[rgba(255,255,255,0.06)] to-transparent p-[1px] transition-transform hover:-translate-y-0.5`}
                  >
                    <div className="h-full rounded-[25px] bg-[linear-gradient(180deg,rgba(18,22,38,0.94),rgba(11,14,24,0.98))] p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
                            {getAssetLocation(asset)}
                          </p>
                          <h4 className="mt-3 text-xl font-semibold text-foreground">
                            {getAssetLabel(asset)}
                          </h4>
                        </div>
                        <Badge variant={getTierVariant(tier)}>
                          {tier ? tier.replaceAll("_", " ") : "No tier"}
                        </Badge>
                      </div>

                      <div className="mt-5 grid gap-3 sm:grid-cols-2">
                        <MetricCard
                          label="Risk"
                          value={
                            typeof riskScore === "number"
                              ? riskScore.toFixed(1)
                              : "Unavailable"
                          }
                          className="min-h-[120px]"
                        />
                        <MetricCard
                          label="TLS"
                          value={asset.assessment?.tls_version ?? "Unavailable"}
                          hint={asset.assessment?.cipher_suite ?? "No cipher suite captured"}
                          className="min-h-[120px]"
                        />
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2">
                        <Badge variant="warning">{getUrgencyLabel(tier)}</Badge>
                        <Badge variant="outline">{getActionPriorityLabel(tier)}</Badge>
                      </div>

                      <div className="mt-4 flex items-center justify-between gap-3 text-sm text-muted-foreground">
                        <span>{asset.server_software ?? "Unknown server"}</span>
                        <span className="text-sidebar-accent transition-colors group-hover:text-white">
                          Open asset workbench
                        </span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="rounded-[24px] border border-white/8 bg-black/15 p-5 text-sm leading-6 text-muted-foreground">
              No assets were returned in the compiled scan payload, so the heatmap cannot render.
            </div>
          )}
        </div>

        <EventFeedPanel events={results.events} />

        <div className="flex justify-end">
          <Button asChild variant="outline" className="rounded-full px-5">
            <Link href={buildScanHref("/reports", results.scan_id)}>
              <Radar className="h-4 w-4" />
              Open engineer-first reports
            </Link>
          </Button>
        </div>
      </div>
    </MissionLayout>
  );
}
