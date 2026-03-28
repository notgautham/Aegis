"use client";

import Link from "next/link";
import { AlertTriangle, Bell, Layers3, Radar, Search, UserRound } from "lucide-react";
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

import { MissionLayout } from "@/components/mission-layout";
import { EmptyRouteState, ErrorRouteState, LoadingRouteState } from "@/components/route-state";
import { Button } from "@/components/ui/button";
import { formatDuration, formatStage, formatTimestamp, formatTitleCase } from "@/lib/formatters";
import {
  getActionPriorityLabel,
  getAssetLabel,
  getAssetTier,
  getRiskScore,
  getUrgencyLabel,
} from "@/lib/result-helpers";
import { buildScanHref } from "@/lib/scan-storage";
import { useBackendHealth } from "@/lib/use-backend-health";
import { useScanResults } from "@/lib/use-scan-results";

const chartColors = {
  danger: "#ffb4a5",
  warning: "#72ff70",
  success: "#00ff41",
  primary: "#ebffe2",
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

  const header = (
    <header className="fixed left-0 right-0 top-0 z-50 h-14 border-b border-[#00FF41]/10 bg-[#111318]/70 backdrop-blur-xl shadow-[0_1px_10px_rgba(0,255,65,0.05)] lg:pl-[18.5rem]">
      <div className="flex h-full items-center justify-between px-6">
        <div className="flex items-center gap-8">
          <span className="font-[var(--font-display)] text-xl font-bold tracking-tighter text-[#00FF41]">
            AEGIS_OS
          </span>
          <nav className="hidden gap-6 md:flex">
            <span className="font-[var(--font-display)] text-xs font-bold uppercase tracking-[0.2em] text-[#00FF41]">
              HEALTH: {healthState === "healthy" ? "100%" : healthState === "checking" ? "SYNC" : "OFFLINE"}
            </span>
            <span className="font-[var(--font-display)] text-xs uppercase tracking-[0.2em] text-slate-500">
              TARGET: {results?.target ?? "UNBOUND"}
            </span>
            <span className="font-[var(--font-display)] text-xs uppercase tracking-[0.2em] text-slate-500">
              ASSETS: {results?.assets.length ?? 0}
            </span>
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative hidden lg:block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#00FF41]/45" />
            <input
              className="w-52 rounded border border-[#00FF41]/10 bg-white/5 py-1 pl-9 pr-3 font-[var(--font-display)] text-[10px] uppercase tracking-[0.18em] text-[#00FF41] placeholder:text-[#00FF41]/30 focus:border-[#00FF41]/40 focus:outline-none"
              placeholder="SEARCH_SYSTEM..."
              type="text"
            />
          </div>
          <button
            type="button"
            className="text-slate-500 transition-all hover:text-[#00FF41]"
            aria-label="Notifications"
          >
            <Bell className="h-4 w-4" />
          </button>
          <button
            type="button"
            className="text-slate-500 transition-all hover:text-[#00FF41]"
            aria-label="Account"
          >
            <UserRound className="h-4 w-4" />
          </button>
        </div>
      </div>
    </header>
  );

  if (!isHydrated) {
    return (
      <MissionLayout activeSection="risk-heatmap" contextScanId={null} header={header}>
        <LoadingRouteState
          eyebrow="Risk surface"
          title="Resolving scan context"
          description="The workspace is waiting for a valid scan reference before it requests any backend data."
        />
      </MissionLayout>
    );
  }

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
    { label: "Transitioning", value: results.summary.transitioning_assets, fill: chartColors.warning },
    { label: "Ready", value: results.summary.fully_quantum_safe_assets, fill: chartColors.success },
  ];

  const artifactChartData = results.progress
    ? [
        { label: "Assessments", value: results.progress.assessments_created },
        { label: "CBOMs", value: results.progress.cboms_created },
        { label: "Remediations", value: results.progress.remediations_created },
        { label: "Certificates", value: results.progress.certificates_created },
      ]
    : [];
  const maxArtifactValue =
    artifactChartData.reduce((max, entry) => Math.max(max, entry.value), 0) || 1;
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
      <div className="space-y-8 pb-28">
        <div className="flex flex-col items-start justify-between gap-6 md:flex-row">
          <div className="space-y-1">
            <span className="font-[var(--font-display)] text-[10px] font-bold uppercase tracking-[0.2em] text-[#00FF41]">
              Risk Surface
            </span>
            <h1 className="font-[var(--font-display)] text-4xl font-extrabold uppercase tracking-tight text-white">
              Risk heatmap workspace
            </h1>
            <p className="max-w-2xl text-sm text-[#b9ccb2]">
              Scan-wide prioritization based on cryptographic posture. This view stays bound to one compiled scan and keeps every risk count, tier, and asset fact backend-sourced.
            </p>
            <div className="flex flex-wrap gap-2 pt-2 text-[10px] uppercase tracking-[0.18em] text-slate-500">
              <span>Target: {results.target}</span>
              <span>State: {formatTitleCase(results.status)}</span>
              <span>Elapsed: {formatDuration(results.elapsed_seconds)}</span>
              <span>Stage: {formatStage(results.stage)}</span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <HeaderInfoCard
              label="Peak telemetry"
              value={
                typeof results.summary.highest_risk_score === "number"
                  ? results.summary.highest_risk_score.toFixed(1)
                  : "N/A"
              }
              suffix="RS"
              tone="accent"
            />
            <HeaderInfoCard
              label="Degraded modes"
              value={String(results.degraded_modes.length)}
              badge={results.degraded_modes.length > 0 ? "Action req" : "Nominal"}
              tone={results.degraded_modes.length > 0 ? "danger" : "default"}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
          <SummaryTile label="Total assets" value={results.summary.total_assets} />
          <SummaryTile label="TLS assets" value={results.summary.tls_assets} />
          <SummaryTile label="Vulnerable" value={results.summary.vulnerable_assets} tone="danger" />
          <SummaryTile label="Transitioning" value={results.summary.transitioning_assets} tone="warning" />
          <SummaryTile label="Quantum safe" value={results.summary.fully_quantum_safe_assets} tone="success" />
          <SummaryTile
            label="Certs created"
            value={results.progress?.certificates_created ?? "Unavailable"}
          />
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="rounded-xl border border-white/5 bg-[#1a1c20]/70 p-6 backdrop-blur-2xl">
            <h3 className="mb-6 font-[var(--font-display)] text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
              Compliance distribution
            </h3>
            {complianceChartData.some((entry) => entry.value > 0) ? (
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={complianceChartData}>
                    <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
                    <XAxis dataKey="label" stroke="rgba(255,255,255,0.45)" />
                    <YAxis allowDecimals={false} stroke="rgba(255,255,255,0.45)" />
                    <Tooltip
                      cursor={{ fill: "rgba(255,255,255,0.04)" }}
                      contentStyle={{
                        backgroundColor: "rgba(17,19,24,0.96)",
                        border: "1px solid rgba(255,255,255,0.08)",
                        borderRadius: 12,
                      }}
                    />
                    <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                      {complianceChartData.map((entry) => (
                        <Cell key={entry.label} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <PanelEmptyState message="No compliance counts are available for this scan summary yet." />
            )}
          </div>

          <div className="rounded-xl border border-white/5 bg-[#1a1c20]/70 p-6 backdrop-blur-2xl">
            <h3 className="mb-6 font-[var(--font-display)] text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
              Artifact flow progress
            </h3>
            {artifactChartData.length > 0 ? (
              <div className="space-y-6">
                {artifactChartData.map((entry) => (
                  <div key={entry.label} className="space-y-2">
                    <div className="flex justify-between text-[10px] font-[var(--font-display)] uppercase">
                      <span className="text-slate-400">{entry.label}</span>
                      <span className="font-bold text-white">{entry.value}</span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#333539]">
                      <div
                        className="h-full bg-[#00FF41]"
                        style={{
                          width: `${Math.max(8, Math.round((entry.value / maxArtifactValue) * 100))}%`,
                          opacity:
                            entry.label === "Assessments"
                              ? 1
                              : entry.label === "CBOMs"
                                ? 0.75
                                : entry.label === "Remediations"
                                  ? 0.55
                                  : 0.35,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <PanelEmptyState message="Artifact counts are unavailable for this scan. The heatmap will not infer them." />
            )}
          </div>
        </div>

        {results.degraded_modes.length > 0 ? (
          <div className="rounded-lg border border-[#ffb4a5]/20 bg-[#c31e00]/10 p-4">
            <div className="mb-3 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-[#ffb4a5]" />
              <h3 className="font-[var(--font-display)] text-[10px] font-bold uppercase tracking-[0.18em] text-[#ffb4a5]">
                Active degraded modes
              </h3>
            </div>
            <div className="flex flex-wrap gap-2">
              {results.degraded_modes.map((message) => (
                <span
                  key={message}
                  className="border border-[#ffb4a5]/20 bg-[#c31e00]/20 px-2 py-1 text-[9px] font-bold uppercase text-[#ffb4a5]"
                >
                  {message}
                </span>
              ))}
            </div>
          </div>
        ) : null}

        <section>
          <div className="mb-4 flex items-end justify-between">
            <div>
              <h3 className="font-[var(--font-display)] text-lg font-bold uppercase tracking-tight text-white">
                Asset investigation grid
              </h3>
              <div className="text-[10px] font-[var(--font-display)] uppercase tracking-[0.18em] text-slate-500">
                Sorted by tier and risk score
              </div>
            </div>
            <div className="flex items-center gap-2 text-[10px] font-[var(--font-display)] uppercase tracking-[0.18em] text-slate-500">
              <Layers3 className="h-3.5 w-3.5 text-[#00FF41]" />
              Drill into asset workbench
            </div>
          </div>

          {results.assets.length > 0 ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {orderedAssets.map((asset) => {
                const tier = getAssetTier(asset);
                const riskScore = getRiskScore(asset);
                const borderTone =
                  tier === "QUANTUM_VULNERABLE"
                    ? "border-[#ffb4a5]"
                    : tier === "PQC_TRANSITIONING"
                      ? "border-[#72ff70]"
                      : "border-[#00FF41]";

                return (
                  <Link
                    key={asset.asset_id}
                    href={`/assets/${asset.asset_id}?scan=${results.scan_id}`}
                    className={`block border-l-4 bg-[#282a2e] p-5 transition-transform hover:translate-x-1 ${borderTone}`}
                  >
                    <div className="mb-4 flex items-start justify-between">
                      <div>
                        <div className="font-mono text-xs font-bold text-white">
                          {asset.ip_address ?? asset.hostname ?? asset.asset_id.slice(0, 8)}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {getAssetLabel(asset)} : {asset.port}/{asset.protocol}
                        </div>
                      </div>
                      <div className="text-right">
                        <div
                          className={`font-[var(--font-display)] text-lg font-black ${
                            tier === "QUANTUM_VULNERABLE"
                              ? "text-[#ffb4a5]"
                              : tier === "PQC_TRANSITIONING"
                                ? "text-[#72ff70]"
                                : "text-[#00FF41]"
                          }`}
                        >
                          {typeof riskScore === "number" ? riskScore.toFixed(1) : "N/A"}
                        </div>
                        <div className="text-[8px] font-bold uppercase text-slate-500">
                          Risk score
                        </div>
                      </div>
                    </div>

                    <div className="mb-4 flex flex-wrap gap-2">
                      <span
                        className={`px-2 py-0.5 text-[8px] font-bold uppercase ${
                          tier === "QUANTUM_VULNERABLE"
                            ? "bg-[#c31e00] text-white"
                            : tier === "PQC_TRANSITIONING"
                              ? "border border-[#72ff70]/30 bg-[#72ff70]/20 text-[#72ff70]"
                              : "border border-[#00FF41]/30 bg-[#00FF41]/15 text-[#00FF41]"
                        }`}
                      >
                        {tier ? formatTitleCase(tier) : "Unavailable"}
                      </span>
                      <span className="border border-white/10 bg-white/5 px-2 py-0.5 text-[8px] font-bold uppercase text-slate-300">
                        {getUrgencyLabel(tier)}
                      </span>
                      <span className="border border-white/10 bg-white/5 px-2 py-0.5 text-[8px] font-bold uppercase text-slate-300">
                        {getActionPriorityLabel(tier)}
                      </span>
                    </div>

                    <div className="mb-4 grid grid-cols-2 gap-y-2 text-[9px]">
                      <div className="text-slate-500">TLS version</div>
                      <div className="text-right text-slate-300">
                        {asset.assessment?.tls_version ?? "Unavailable"}
                      </div>
                      <div className="text-slate-500">Cipher suite</div>
                      <div className="truncate text-right text-slate-300">
                        {asset.assessment?.cipher_suite ?? "Unavailable"}
                      </div>
                      <div className="text-slate-500">Server</div>
                      <div className="text-right text-slate-300">
                        {asset.server_software ?? "Unknown"}
                      </div>
                    </div>

                    <div className="border border-white/5 bg-white/5 px-3 py-2 text-center text-[10px] font-[var(--font-display)] font-bold uppercase text-white transition-colors hover:bg-white/10">
                      Open asset workbench
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <PanelEmptyState message="No assets were returned in the compiled scan payload, so the heatmap cannot render." />
          )}
        </section>

        <div className="overflow-hidden rounded-xl border border-white/5 bg-[#1a1c20]/70 backdrop-blur-2xl">
          <div className="flex items-center justify-between border-b border-white/5 px-6 py-4">
            <h3 className="font-[var(--font-display)] text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
              Runtime event feed
            </h3>
            <span className="animate-pulse text-[10px] text-[#00FF41]">LIVE EVENTS</span>
          </div>
          <div className="max-h-64 space-y-4 overflow-y-auto p-6 font-mono text-[11px]">
            {results.events.length > 0 ? (
              [...results.events].slice(-8).reverse().map((event) => (
                <div
                  key={`${event.timestamp}-${event.message}`}
                  className={`flex gap-4 border-l py-1 pl-4 ${
                    event.kind === "error"
                      ? "border-[#ffb4a5]/50"
                      : event.kind === "success"
                        ? "border-[#00FF41]/30"
                        : "border-white/10"
                  }`}
                >
                  <span className="w-28 shrink-0 text-slate-500">
                    {formatTimestamp(event.timestamp)}
                  </span>
                  <span
                    className={`w-32 shrink-0 font-bold uppercase ${
                      event.kind === "error"
                        ? "text-[#ffb4a5]"
                        : event.kind === "success"
                          ? "text-[#00FF41]"
                          : "text-slate-400"
                    }`}
                  >
                    [{formatStage(event.stage)}]
                  </span>
                  <span className="text-slate-300">{event.message}</span>
                </div>
              ))
            ) : (
              <div className="text-sm leading-6 text-slate-500">
                No runtime events were persisted for this scan context.
              </div>
            )}
          </div>
        </div>
      </div>

      <footer className="fixed bottom-0 left-0 right-0 z-40 border-t border-white/5 bg-[#111318]/90 px-8 py-4 backdrop-blur-xl lg:left-[18.5rem]">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap gap-4">
            <Button
              asChild
              variant="outline"
              className="rounded text-[10px] font-[var(--font-display)] uppercase tracking-[0.16em] text-slate-300"
            >
              <Link href="/">Back to Mission Control</Link>
            </Button>
            <Button
              asChild
              variant="outline"
              className="rounded text-[10px] font-[var(--font-display)] uppercase tracking-[0.16em] text-slate-300"
            >
              <Link href={buildScanHref("/assets", results.scan_id)}>Open asset inventory</Link>
            </Button>
          </div>
          <Button
            asChild
            className="rounded bg-[#00FF41] px-6 text-xs font-[var(--font-display)] font-bold uppercase tracking-[0.18em] text-[#003907] hover:bg-[#2aff63]"
          >
            <Link href={buildScanHref("/reports", results.scan_id)}>
              <Radar className="h-4 w-4" />
              Open engineer-first reports
            </Link>
          </Button>
        </div>
      </footer>
    </MissionLayout>
  );
}

function HeaderInfoCard({
  label,
  value,
  suffix,
  badge,
  tone = "default",
}: Readonly<{
  label: string;
  value: string;
  suffix?: string;
  badge?: string;
  tone?: "default" | "accent" | "danger";
}>) {
  return (
    <div className="border-l border-white/10 bg-[#1a1c20] px-4 py-2">
      <div className="font-[var(--font-display)] text-[10px] uppercase text-slate-500">
        {label}
      </div>
      <div className="flex items-center gap-2">
        <div
          className={`font-[var(--font-display)] text-xl font-bold tracking-tighter ${
            tone === "danger"
              ? "text-[#ffb4a5]"
              : tone === "accent"
                ? "text-[#00FF41]"
                : "text-white"
          }`}
        >
          {value}
          {suffix ? <span className="ml-1 text-xs text-slate-400">{suffix}</span> : null}
        </div>
        {badge ? (
          <span className="rounded bg-[#c31e00]/20 px-1.5 py-0.5 text-[8px] font-bold uppercase text-[#ffb4a5]">
            {badge}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function SummaryTile({
  label,
  value,
  tone = "default",
}: Readonly<{
  label: string;
  value: number | string;
  tone?: "default" | "danger" | "warning" | "success";
}>) {
  const accentClass =
    tone === "danger"
      ? "border-[#c31e00]/50 text-[#ffb4a5]"
      : tone === "warning"
        ? "border-[#72ff70]/50 text-[#72ff70]"
        : tone === "success"
          ? "border-[#00FF41]/50 text-[#00FF41]"
          : "border-white/5 text-white";

  return (
    <div className={`border-l bg-[#1e2024] p-4 shadow-lg ${accentClass}`}>
      <div className="mb-1 font-[var(--font-display)] text-[10px] uppercase text-slate-400">
        {label}
      </div>
      <div className="font-[var(--font-display)] text-2xl font-bold">{value}</div>
    </div>
  );
}

function PanelEmptyState({ message }: Readonly<{ message: string }>) {
  return <div className="text-sm leading-6 text-slate-500">{message}</div>;
}
