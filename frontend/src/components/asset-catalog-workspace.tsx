"use client";

import Link from "next/link";
import { useState } from "react";
import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  Search,
  Settings,
  Shield,
  UserRound,
  XCircle,
} from "lucide-react";

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
import { buildAssetHref, buildScanHref } from "@/lib/scan-storage";
import { useBackendHealth } from "@/lib/use-backend-health";
import { useScanResults } from "@/lib/use-scan-results";

export function AssetCatalogWorkspace({
  initialScanParam,
}: {
  initialScanParam?: string | null;
}) {
  const [filterValue, setFilterValue] = useState("");
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
          <button
            type="button"
            className="text-slate-500 transition-all hover:text-[#00FF41]"
            aria-label="Security status"
          >
            <Shield className="h-4 w-4" />
          </button>
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
            aria-label="System settings"
          >
            <Settings className="h-4 w-4" />
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
      <MissionLayout activeSection="assets" contextScanId={null} header={header}>
        <LoadingRouteState
          eyebrow="Asset inventory"
          title="Resolving asset catalog"
          description="Waiting for a valid scan context before loading the scan-scoped inventory matrix."
        />
      </MissionLayout>
    );
  }

  if (invalidQueryParam) {
    return (
      <MissionLayout activeSection="assets" contextScanId={resolvedScanId} header={header}>
        <EmptyRouteState
          eyebrow="Invalid scan reference"
          title="The asset inventory needs a valid scan ID"
          description="Open this route from Mission Control, Heatmap, or Reports so the inventory stays bound to one real scan."
        />
      </MissionLayout>
    );
  }

  if (!resolvedScanId) {
    return (
      <MissionLayout activeSection="assets" contextScanId={resolvedScanId} header={header}>
        <EmptyRouteState
          eyebrow="No scan context"
          title="No scan is available for asset inventory"
          description="Launch a scan first or reopen a completed one so the inventory can render backend-confirmed assets."
        />
      </MissionLayout>
    );
  }

  if (isLoading && !results) {
    return (
      <MissionLayout activeSection="assets" contextScanId={resolvedScanId} header={header}>
        <LoadingRouteState
          eyebrow="Asset inventory"
          title="Loading inventory matrix"
          description="Suppressing stale asset data until the latest compiled results for this scan are ready."
        />
      </MissionLayout>
    );
  }

  if (error) {
    return (
      <MissionLayout activeSection="assets" contextScanId={resolvedScanId} header={header}>
        <ErrorRouteState
          eyebrow="Asset inventory unavailable"
          title="The asset route could not load this scan"
          description={error}
          actionHref="/"
          actionLabel="Return to Mission Control"
          onRetry={retry}
        />
      </MissionLayout>
    );
  }

  if (!results || results.status === "pending" || results.status === "running") {
    return (
      <MissionLayout activeSection="assets" contextScanId={results?.scan_id ?? resolvedScanId} header={header}>
        <EmptyRouteState
          eyebrow="Scan still running"
          title="The inventory opens after result compilation"
          description="Mission Control remains the live source of truth until the scan completes and the asset list is compiled."
          actionHref="/"
          actionLabel="Back to Mission Control"
        />
      </MissionLayout>
    );
  }

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

  const normalizedFilter = filterValue.trim().toLowerCase();
  const filteredAssets = normalizedFilter
    ? orderedAssets.filter((asset) => {
        const haystack = [
          asset.hostname,
          asset.ip_address,
          asset.service_type,
          asset.server_software,
          asset.assessment?.tls_version,
          asset.assessment?.cipher_suite,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return haystack.includes(normalizedFilter);
      })
    : orderedAssets;

  const vulnerableCount = results.summary?.vulnerable_assets ?? 0;
  const tlsAssetsCount = results.summary?.tls_assets ?? 0;
  const certificateCount =
    results.progress?.certificates_created ??
    results.assets.filter((asset) => asset.certificate).length;
  const remediationCount =
    results.progress?.remediations_created ??
    results.assets.filter((asset) => asset.remediation).length;

  return (
    <MissionLayout activeSection="assets" contextScanId={results.scan_id} header={header}>
      <div className="space-y-6 pb-28">
        {results.degraded_modes.length > 0 ? (
          <div className="flex items-start gap-4 rounded-xl border border-[#c31e00]/20 bg-[#c31e00]/10 p-4">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#ffb4a5]" />
            <div className="min-w-0 flex-1">
              <p className="font-[var(--font-display)] text-sm font-bold uppercase tracking-[0.16em] text-[#ffb4a5]">
                Degraded monitoring mode
              </p>
              <p className="mt-1 text-xs leading-6 text-[#ffd7d0]">
                This scan completed with restricted runtime behavior. Asset inventory is still rendered from persisted backend truth, and each degraded notice remains visible below.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
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
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
          <div className="clip-path-chamfer-tr glass-panel relative overflow-hidden rounded-xl border border-white/10 p-6 lg:col-span-3">
            <div className="relative z-10">
              <div className="mb-2 flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-[#00FF41]" />
                <span className="font-[var(--font-display)] text-[10px] uppercase tracking-[0.2em] text-slate-400">
                  Active scan context
                </span>
              </div>
              <h1 className="font-[var(--font-display)] text-4xl font-black uppercase tracking-tight text-white">
                {results.target}
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[#b9ccb2]">
                Scan-scoped inventory of internet-facing endpoints discovered in this compiled run. Every row below maps directly to the backend results payload for this scan and opens into the forensic workbench.
              </p>
              <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-[10px] font-[var(--font-display)] uppercase tracking-[0.18em] text-slate-500">
                <span>State: {formatTitleCase(results.status)}</span>
                <span>Created: {formatTimestamp(results.created_at)}</span>
                <span>Completed: {formatTimestamp(results.completed_at)}</span>
                <span>Elapsed: {formatDuration(results.elapsed_seconds)}</span>
                <span>Stage: {formatStage(results.stage)}</span>
              </div>
              {results.stage_detail ? (
                <p className="mt-3 text-xs leading-6 text-slate-400">{results.stage_detail}</p>
              ) : null}
            </div>
            <div className="relative z-10 mt-6 flex flex-wrap gap-4">
              <Button
                asChild
                className="rounded bg-[#00FF41] px-6 text-xs font-[var(--font-display)] font-bold uppercase tracking-[0.18em] text-[#003907] hover:bg-[#26ff5d]"
              >
                <Link href={buildScanHref("/risk-heatmap", results.scan_id)}>Open heatmap</Link>
              </Button>
              <Button
                asChild
                variant="outline"
                className="rounded border-white/15 bg-[#1e2024] px-6 text-xs font-[var(--font-display)] font-bold uppercase tracking-[0.18em] text-slate-200 hover:bg-[#282a2e]"
              >
                <Link href={buildScanHref("/reports", results.scan_id)}>Open reports</Link>
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 lg:grid-cols-2">
            <MetricTile label="Total assets" value={results.summary?.total_assets ?? results.assets.length} tone="default" />
            <MetricTile label="Critical risks" value={vulnerableCount} tone="danger" />
            <MetricTile label="TLS assets" value={tlsAssetsCount} tone="default" />
            <MetricTile label="Certificates" value={certificateCount} tone="accent" />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-4">
          <div className="flex flex-col gap-4 xl:col-span-3">
            <div className="flex flex-col justify-between gap-3 px-1 md:flex-row md:items-center">
              <div>
                <h2 className="font-[var(--font-display)] text-lg font-bold uppercase tracking-[0.16em] text-white">
                  Inventory matrix
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  Filter by host, IP, service, TLS version, or software to narrow the current scan scope.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <div className="flex h-10 items-center rounded-lg border border-white/10 bg-[#0c0e12] px-3">
                  <Search className="mr-2 h-4 w-4 text-slate-500" />
                  <input
                    className="w-64 border-none bg-transparent text-sm text-white placeholder:text-slate-600 focus:outline-none"
                    placeholder="Filter by host, IP, or service..."
                    value={filterValue}
                    onChange={(event) => setFilterValue(event.target.value)}
                  />
                </div>
                <div className="flex h-10 items-center rounded-lg border border-white/10 bg-[#282a2e] px-3 text-xs font-bold uppercase tracking-[0.16em] text-slate-300">
                  {filteredAssets.length} visible
                </div>
              </div>
            </div>

            <div className="glass-panel overflow-hidden rounded-xl border border-white/10 shadow-2xl">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left">
                  <thead>
                    <tr className="bg-[#282a2e]/70 text-[10px] font-[var(--font-display)] uppercase tracking-[0.16em] text-slate-400">
                      <th className="border-b border-white/5 px-4 py-4 font-semibold">Hostname / IP</th>
                      <th className="border-b border-white/5 px-4 py-4 font-semibold">Port/Prot</th>
                      <th className="border-b border-white/5 px-4 py-4 font-semibold">Service</th>
                      <th className="border-b border-white/5 px-4 py-4 font-semibold">Software</th>
                      <th className="border-b border-white/5 px-4 py-4 font-semibold">TLS/Cipher</th>
                      <th className="border-b border-white/5 px-4 py-4 text-center font-semibold">Risk</th>
                      <th className="border-b border-white/5 px-4 py-4 font-semibold">Urgency</th>
                      <th className="border-b border-white/5 px-4 py-4 font-semibold">Cert</th>
                      <th className="border-b border-white/5 px-4 py-4 font-semibold">Action</th>
                    </tr>
                  </thead>
                  <tbody className="text-xs">
                    {filteredAssets.length > 0 ? (
                      filteredAssets.map((asset) => {
                        const tier = getAssetTier(asset);
                        const riskScore = getRiskScore(asset);
                        const riskPercent = typeof riskScore === "number" ? Math.min(Math.max(riskScore, 0), 100) : 0;
                        const certPresent = Boolean(asset.certificate);

                        return (
                          <tr
                            key={asset.asset_id}
                            className="group cursor-pointer border-b border-white/5 transition-colors hover:bg-[#282a2e]"
                          >
                            <td className="px-4 py-4">
                              <div className="font-bold text-white">{asset.hostname ?? asset.ip_address ?? getAssetLabel(asset)}</div>
                              <div className="text-[10px] text-slate-500">{asset.ip_address ?? "No IP captured"}</div>
                            </td>
                            <td className="px-4 py-4">
                              <span className="font-mono text-[#00FF41]">{asset.port}</span>
                              <span className="text-slate-500">/{asset.protocol.toUpperCase()}</span>
                            </td>
                            <td className="px-4 py-4 font-medium text-[#b9ccb2]">
                              {asset.service_type ? formatTitleCase(asset.service_type) : "Unknown"}
                            </td>
                            <td className="px-4 py-4 text-slate-400">
                              {asset.server_software ?? "Unavailable"}
                            </td>
                            <td className="px-4 py-4">
                              <div className="space-y-1">
                                <div className="text-[#72ff70]">
                                  {asset.assessment?.tls_version ?? "No TLS telemetry"}
                                </div>
                                <div className="max-w-[15rem] truncate font-mono text-[10px] text-slate-500">
                                  {asset.assessment?.cipher_suite ?? "Cipher unavailable"}
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-4">
                              <div className="flex flex-col items-center gap-2">
                                <span
                                  className={`font-[var(--font-display)] text-sm font-bold ${
                                    tier === "QUANTUM_VULNERABLE"
                                      ? "text-[#ffb4a5]"
                                      : tier === "PQC_TRANSITIONING"
                                        ? "text-[#72ff70]"
                                        : "text-white"
                                  }`}
                                >
                                  {typeof riskScore === "number" ? riskScore.toFixed(1) : "N/A"}
                                </span>
                                <div className="h-1.5 w-12 overflow-hidden rounded-full bg-[#1e2024]">
                                  <div
                                    className={`h-full ${
                                      tier === "QUANTUM_VULNERABLE"
                                        ? "bg-[#ff4b2b]"
                                        : tier === "PQC_TRANSITIONING"
                                          ? "bg-[#72ff70]"
                                          : "bg-[#00FF41]"
                                    }`}
                                    style={{ width: `${riskPercent}%` }}
                                  />
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-4">
                              <div className="space-y-1">
                                <span
                                  className={`inline-flex rounded-sm px-2 py-0.5 text-[9px] font-bold uppercase tracking-tight ${
                                    tier === "QUANTUM_VULNERABLE"
                                      ? "bg-[#c31e00]/20 text-[#ffb4a5]"
                                      : tier === "PQC_TRANSITIONING"
                                        ? "bg-[#72ff70]/10 text-[#72ff70]"
                                        : tier === "FULLY_QUANTUM_SAFE"
                                          ? "bg-[#00FF41]/10 text-[#00FF41]"
                                          : "bg-[#1e2024] text-slate-400"
                                  }`}
                                >
                                  {getUrgencyLabel(tier)}
                                </span>
                                <div className="text-[10px] uppercase tracking-[0.12em] text-slate-500">
                                  {getActionPriorityLabel(tier)}
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-4">
                              {certPresent ? (
                                <CheckCircle2 className="h-4 w-4 text-[#00FF41]" />
                              ) : (
                                <XCircle className="h-4 w-4 text-[#ffb4a5]" />
                              )}
                            </td>
                            <td className="px-4 py-4">
                              <Link
                                href={buildAssetHref(asset.asset_id, results.scan_id)}
                                className="font-[var(--font-display)] text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400 transition-colors group-hover:text-[#00FF41]"
                              >
                                Open workbench
                              </Link>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={9} className="px-4 py-10 text-center text-sm leading-6 text-slate-500">
                          No assets match the current filter for this scan.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center justify-between border-t border-white/5 bg-[#1a1c20] px-4 py-3">
                <span className="font-[var(--font-display)] text-[10px] uppercase tracking-[0.16em] text-slate-500">
                  Showing {filteredAssets.length} of {results.assets.length} scoped assets
                </span>
                <div className="flex items-center gap-3 text-[10px] font-[var(--font-display)] uppercase tracking-[0.16em] text-slate-500">
                  <span>Remediations: {remediationCount}</span>
                  <span>Certificates: {certificateCount}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <div className="px-2">
              <h2 className="font-[var(--font-display)] text-lg font-bold uppercase tracking-[0.16em] text-white">
                System events
              </h2>
            </div>
            <div className="glass-panel flex min-h-[500px] flex-col gap-4 rounded-xl border border-white/10 p-4">
              <div className="relative flex-1 space-y-8 border-l border-white/10 pl-6">
                {results.events.length > 0 ? (
                  [...results.events].slice(-8).reverse().map((event) => (
                    <div key={`${event.timestamp}-${event.message}`} className="relative">
                      <div
                        className={`absolute -left-[29px] top-0 flex h-4 w-4 items-center justify-center rounded-full ring-4 ring-[#111318] ${
                          event.kind === "error"
                            ? "bg-[#c31e00]"
                            : event.kind === "success"
                              ? "bg-[#00FF41]"
                              : "bg-[#333539]"
                        }`}
                      >
                        {event.kind === "error" ? (
                          <AlertTriangle className="h-2.5 w-2.5 text-[#ffdad6]" />
                        ) : event.kind === "success" ? (
                          <CheckCircle2 className="h-2.5 w-2.5 text-[#003907]" />
                        ) : (
                          <div className="h-1.5 w-1.5 rounded-full bg-white/70" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-start justify-between gap-3">
                          <span
                            className={`font-[var(--font-display)] text-[10px] font-bold uppercase tracking-[0.14em] ${
                              event.kind === "error"
                                ? "text-[#ffb4a5]"
                                : event.kind === "success"
                                  ? "text-[#00FF41]"
                                  : "text-[#b9ccb2]"
                            }`}
                          >
                            {formatStage(event.stage)}
                          </span>
                          <span className="font-[var(--font-display)] text-[9px] uppercase text-slate-500">
                            {formatTimestamp(event.timestamp)}
                          </span>
                        </div>
                        <p className="mt-1 text-xs leading-relaxed text-[#b9ccb2]">{event.message}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-sm leading-6 text-slate-500">
                    No runtime events were persisted for this scan context.
                  </div>
                )}
              </div>

              <div className="mt-auto border-t border-white/5 pt-4">
                <div className="space-y-2 text-[10px] font-[var(--font-display)] uppercase tracking-[0.16em] text-slate-500">
                  <div className="flex items-center justify-between">
                    <span>Vulnerable assets</span>
                    <span>{vulnerableCount}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Transitioning assets</span>
                    <span>{results.summary?.transitioning_assets ?? 0}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Quantum safe</span>
                    <span>{results.summary?.fully_quantum_safe_assets ?? 0}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </MissionLayout>
  );
}

function MetricTile({
  label,
  value,
  tone,
}: Readonly<{
  label: string;
  value: number;
  tone: "default" | "danger" | "accent";
}>) {
  return (
    <div className="glass-panel flex flex-col items-center justify-center rounded-xl border border-white/10 p-4 text-center">
      <span
        className={`font-[var(--font-display)] text-3xl font-black ${
          tone === "danger" ? "text-[#ffb4a5]" : tone === "accent" ? "text-[#00FF41]" : "text-white"
        }`}
      >
        {value}
      </span>
      <span className="mt-1 font-[var(--font-display)] text-[10px] uppercase tracking-[0.16em] text-slate-500">
        {label}
      </span>
    </div>
  );
}
