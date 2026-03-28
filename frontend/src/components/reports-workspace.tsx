"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Bell,
  Printer,
  Search,
  Settings,
  ShieldCheck,
  UserRound,
} from "lucide-react";

import { MissionLayout } from "@/components/mission-layout";
import { DegradedModePanel } from "@/components/scan-overview-panels";
import { EmptyRouteState, ErrorRouteState, LoadingRouteState } from "@/components/route-state";
import { Button } from "@/components/ui/button";
import type { AssetResultResponse, ComplianceTier } from "@/lib/api";
import { formatTimestamp } from "@/lib/formatters";
import {
  getActionPriorityLabel,
  getAssetLabel,
  getAssetTier,
  getRecommendedNextAction,
  getUrgencyLabel,
} from "@/lib/result-helpers";
import { buildAssetHref, buildScanHref } from "@/lib/scan-storage";
import { useBackendHealth } from "@/lib/use-backend-health";
import { useScanResults } from "@/lib/use-scan-results";

type ReportTab = "engineer" | "executive";

export function ReportsWorkspace({
  initialScanParam,
}: {
  initialScanParam?: string | null;
}) {
  const [activeTab, setActiveTab] = useState<ReportTab>("engineer");
  const healthState = useBackendHealth();
  const { isHydrated, resolvedScanId, invalidQueryParam, isLoading, error, results, retry } =
    useScanResults({
      initialScanParam,
    });

  const header = (
    <header className="fixed left-0 right-0 top-0 z-50 h-14 border-b border-[#00FF41]/10 bg-[#111318]/80 backdrop-blur-md lg:pl-[18.5rem]">
      <div className="flex h-full items-center justify-between px-6">
        <div className="flex items-center gap-8">
          <span className="font-[var(--font-display)] text-xl font-bold tracking-tighter text-[#00FF41]">
            AEGIS
          </span>
          <nav className="hidden items-center gap-6 md:flex">
            <span className="font-[var(--font-display)] text-[10px] uppercase tracking-[0.1em] text-slate-500">
              Health {healthState === "healthy" ? "Nominal" : healthState === "checking" ? "Syncing" : "Offline"}
            </span>
            <span className="font-[var(--font-display)] text-[10px] uppercase tracking-[0.1em] text-slate-500">
              Target {results?.target ?? "Unbound"}
            </span>
            <span className="font-[var(--font-display)] text-[10px] uppercase tracking-[0.1em] text-slate-500">
              Reports
            </span>
          </nav>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" className="rounded p-1.5 text-[#00FF41] transition-all hover:bg-[#333539]/30" aria-label="Search">
            <Search className="h-4 w-4" />
          </button>
          <button type="button" className="rounded p-1.5 text-[#00FF41] transition-all hover:bg-[#333539]/30" aria-label="Status">
            <Bell className="h-4 w-4" />
          </button>
          <button type="button" className="rounded p-1.5 text-slate-400 transition-all hover:bg-[#333539]/30" aria-label="Settings">
            <Settings className="h-4 w-4" />
          </button>
          <button type="button" className="ml-2 rounded-full border border-white/10 p-1.5 text-slate-300" aria-label="Operator">
            <UserRound className="h-4 w-4" />
          </button>
        </div>
      </div>
    </header>
  );

  if (!isHydrated) {
    return (
      <MissionLayout activeSection="reports" contextScanId={null} header={header}>
        <LoadingRouteState
          eyebrow="Reports"
          title="Resolving report context"
          description="Waiting for a valid scan before rendering the engineer and CISO reporting surfaces."
        />
      </MissionLayout>
    );
  }

  if (invalidQueryParam) {
    return (
      <MissionLayout activeSection="reports" contextScanId={resolvedScanId} header={header}>
        <EmptyRouteState
          eyebrow="Invalid scan reference"
          title="This report route needs a valid scan ID"
          description="The report deck will not issue backend requests for malformed scan identifiers."
        />
      </MissionLayout>
    );
  }

  if (!resolvedScanId) {
    return (
      <MissionLayout activeSection="reports" contextScanId={resolvedScanId} header={header}>
        <EmptyRouteState
          eyebrow="No scan context"
          title="No scan is available for reporting"
          description="Launch a scan from Mission Control or open the route with a valid completed scan query parameter."
        />
      </MissionLayout>
    );
  }

  if (isLoading && !results) {
    return (
      <MissionLayout activeSection="reports" contextScanId={resolvedScanId} header={header}>
        <LoadingRouteState
          eyebrow="Reports"
          title="Loading report payload"
          description="Suppressing stale report content until the latest compiled scan results are available."
        />
      </MissionLayout>
    );
  }

  if (error) {
    return (
      <MissionLayout activeSection="reports" contextScanId={resolvedScanId} header={header}>
        <ErrorRouteState
          eyebrow="Reports unavailable"
          title="The reporting deck could not load this scan"
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
      <MissionLayout activeSection="reports" contextScanId={results?.scan_id ?? resolvedScanId} header={header}>
        <EmptyRouteState
          eyebrow="Scan still running"
          title="Reporting opens after result compilation"
          description="Mission Control remains the live status surface until the scan reaches a terminal state."
          actionHref="/"
          actionLabel="Back to Mission Control"
        />
      </MissionLayout>
    );
  }

  if (!results.summary) {
    return (
      <MissionLayout activeSection="reports" contextScanId={results.scan_id} header={header}>
        <ErrorRouteState
          eyebrow="Summary unavailable"
          title="This scan does not include a compiled summary"
          description="The reporting deck only renders backend-provided posture metrics. Retry the scan results request or return to Mission Control."
          actionHref="/"
          actionLabel="Return to scan control"
          onRetry={retry}
        />
      </MissionLayout>
    );
  }

  const rankedAssets = [...results.assets].sort((left, right) => {
    return compareTier(getAssetTier(left), getAssetTier(right)) || compareRisk(left, right);
  });
  const topFiveAssets = rankedAssets.slice(0, 5);
  const generatedAt = formatTimestamp(results.completed_at ?? results.created_at);
  const securityScore =
    typeof results.summary.highest_risk_score === "number"
      ? Math.max(0, 100 - Math.round(results.summary.highest_risk_score))
      : null;
  const tlsStatus =
    results.summary.tls_assets > 0
      ? Math.round(
          (results.summary.fully_quantum_safe_assets / results.summary.tls_assets) * 100
        )
      : 0;

  return (
    <MissionLayout activeSection="reports" contextScanId={results.scan_id} header={header}>
      <div className="space-y-8 pb-12">
        <header className="flex flex-col justify-between gap-4 md:flex-row md:items-end print:hidden">
          <div>
            <h1 className="font-[var(--font-display)] text-4xl font-bold tracking-tight text-white">
              Security posture report
            </h1>
            <p className="mt-1 text-sm text-[#b9ccb2]">Generated: {generatedAt}</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <div className="flex rounded-lg border border-white/10 bg-[#1e2024] p-1">
              <button
                type="button"
                onClick={() => setActiveTab("executive")}
                className={`px-4 py-1.5 text-xs font-bold uppercase ${activeTab === "executive" ? "rounded bg-[#00FF41] font-[var(--font-display)] text-[#003907]" : "font-[var(--font-display)] text-slate-400 hover:text-white"}`}
              >
                Executive
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("engineer")}
                className={`px-4 py-1.5 text-xs font-bold uppercase ${activeTab === "engineer" ? "rounded bg-[#00FF41] font-[var(--font-display)] text-[#003907]" : "font-[var(--font-display)] text-slate-400 hover:text-white"}`}
              >
                Engineer
              </button>
            </div>
            <Button
              variant="outline"
              className="rounded-lg border-white/10 bg-[#282a2e] text-xs font-[var(--font-display)] uppercase"
              onClick={() => window.print()}
            >
              <Printer className="h-4 w-4" />
              Export PDF
            </Button>
          </div>
        </header>

        {results.degraded_modes.length ? (
          <div className="print:hidden">
            <DegradedModePanel degradedModes={results.degraded_modes} />
          </div>
        ) : null}

        {activeTab === "engineer" ? (
          <div className="space-y-8">
            <section>
              <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                <div>
                  <h3 className="font-[var(--font-display)] text-2xl font-bold text-white">
                    Technical posture ledger
                  </h3>
                  <p className="mt-1 text-sm text-[#b9ccb2]">
                    Asset-level engineering report built from persisted assessment,
                    remediation, certificate, and runtime context.
                  </p>
                </div>
                <div className="flex items-center gap-4 text-xs font-[var(--font-display)] uppercase tracking-[0.12em] text-slate-400">
                  <span className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-[#00FF41]" />
                    Secure
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-[#ff4b2b]" />
                    Action required
                  </span>
                </div>
              </div>

              <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-4">
                <ExecutiveMetricCard
                  label="Assessments"
                  value={String(results.progress?.assessments_created ?? 0)}
                  hint="Compiled crypto assessments"
                />
                <ExecutiveMetricCard
                  label="CBOMs"
                  value={String(results.progress?.cboms_created ?? 0)}
                  hint="Evidence artifacts ready"
                />
                <ExecutiveMetricCard
                  label="Remediations"
                  value={String(results.progress?.remediations_created ?? 0)}
                  hint="Roadmaps generated"
                />
                <ExecutiveMetricCard
                  label="Certificates"
                  value={String(results.progress?.certificates_created ?? 0)}
                  hint="Issued from this scan"
                />
              </div>

              <div className="space-y-3">
                {rankedAssets.length ? (
                  rankedAssets.map((asset) => (
                    <EngineerLedgerRow
                      key={asset.asset_id}
                      asset={asset}
                      scanId={results.scan_id}
                    />
                  ))
                ) : (
                  <div className="rounded-xl border border-white/10 bg-[#1a1c20]/80 p-6 text-sm text-slate-500">
                    No asset records were returned for this scan.
                  </div>
                )}
              </div>
            </section>
          </div>
        ) : (
          <div className="space-y-8">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
              <ExecutiveMetricCard
                label="Security score"
                value={securityScore === null ? "N/A" : String(securityScore)}
                suffix={securityScore === null ? undefined : "/100"}
                tone="accent"
                hint={
                  typeof results.summary.highest_risk_score === "number"
                    ? `Peak risk ${results.summary.highest_risk_score.toFixed(1)}`
                    : "No assessed risk score"
                }
              />
              <ExecutiveMetricCard
                label="Assets scanned"
                value={String(results.summary.total_assets)}
                hint={`${results.summary.tls_assets} TLS assets`}
              />
              <ExecutiveMetricCard
                label="Vulnerabilities"
                value={String(results.summary.vulnerable_assets)}
                tone="danger"
                hint={`${results.summary.transitioning_assets} transitioning assets`}
              />
              <ExecutiveMetricCard
                label="TLS status"
                value={`${tlsStatus}%`}
                hint={`${results.progress?.certificates_created ?? 0} certificates issued`}
              />
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#1a1c20]/80 p-8 lg:col-span-2">
                <div className="absolute right-0 top-0 p-4 opacity-10">
                  <ShieldCheck className="h-20 w-20" />
                </div>
                <div className="relative z-10">
                  <h3 className="mb-6 flex items-center gap-3 font-[var(--font-display)] text-2xl font-bold text-white">
                    <span className="h-8 w-2 bg-[#00FF41]" />
                    Exposure narrative
                  </h3>
                  <div className="max-w-2xl space-y-4 text-sm leading-7 text-[#b9ccb2]">
                    <p>
                      The completed assessment against <span className="font-semibold text-white">{results.target}</span> found{" "}
                      <span className="font-semibold text-[#00FF41]">{results.summary.fully_quantum_safe_assets}</span> fully quantum-safe assets,
                      <span className="font-semibold text-[#72ff70]"> {results.summary.transitioning_assets}</span> transitioning assets,
                      and <span className="font-semibold text-[#ffb4a5]">{results.summary.vulnerable_assets}</span> quantum-vulnerable assets.
                    </p>
                    <p>
                      The backend pipeline produced <span className="font-semibold text-white">{results.progress?.remediations_created ?? 0}</span> remediation bundles and{" "}
                      <span className="font-semibold text-white">{results.progress?.certificates_created ?? 0}</span> certificates from the same persisted scan run.{" "}
                      {results.degraded_modes.length
                        ? `Degraded-mode notices were recorded (${results.degraded_modes.length}).`
                        : "No degraded-mode notices were recorded for this scan."}
                    </p>
                    <div className="grid grid-cols-1 gap-4 pt-4 md:grid-cols-2">
                      <NarrativeCallout
                        label="Remediation readiness"
                        value={`${results.progress?.remediations_created ?? 0} bundles available`}
                      />
                      <NarrativeCallout
                        label="Certificate issuance"
                        value={`${results.progress?.certificates_created ?? 0} certificates issued`}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-[#1e2024]/80 p-6">
                <h3 className="mb-6 font-[var(--font-display)] text-lg font-bold text-white">
                  TLS lifecycle
                </h3>
                <div className="space-y-5">
                  <LifecycleRow label="Compliant" value={results.summary.fully_quantum_safe_assets} tone="accent" />
                  <LifecycleRow label="Transitioning" value={results.summary.transitioning_assets} tone="warning" />
                  <LifecycleRow label="Vulnerable" value={results.summary.vulnerable_assets} tone="danger" />
                  <div className="pt-6">
                    <div className="flex h-3 gap-1 overflow-hidden rounded-full bg-[#333539]">
                      <div
                        className="bg-[#00FF41]"
                        style={{ width: `${results.summary.total_assets ? (results.summary.fully_quantum_safe_assets / results.summary.total_assets) * 100 : 0}%` }}
                      />
                      <div
                        className="bg-[#72ff70]"
                        style={{ width: `${results.summary.total_assets ? (results.summary.transitioning_assets / results.summary.total_assets) * 100 : 0}%` }}
                      />
                      <div
                        className="bg-[#ff4b2b]"
                        style={{ width: `${results.summary.total_assets ? (results.summary.vulnerable_assets / results.summary.total_assets) * 100 : 0}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <section className="overflow-hidden rounded-2xl border border-white/10 bg-[#282a2e]/60">
              <div className="clip-path-chamfer-tr flex items-center justify-between border-b border-white/10 bg-[#1a1c20] px-8 py-4">
                <h3 className="font-[var(--font-display)] text-sm font-bold uppercase tracking-[0.16em] text-[#00FF41]">
                  Top 5 critical risk assets
                </h3>
                <span className="font-mono text-[10px] text-slate-500">Sorted by risk score</span>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-[760px] w-full border-collapse text-left">
                  <thead>
                    <tr className="bg-[#0c0e12]/50">
                      <th className="px-8 py-4 text-[10px] font-[var(--font-display)] uppercase tracking-[0.14em] text-slate-400">Asset entity</th>
                      <th className="px-8 py-4 text-[10px] font-[var(--font-display)] uppercase tracking-[0.14em] text-slate-400">Risk score</th>
                      <th className="px-8 py-4 text-[10px] font-[var(--font-display)] uppercase tracking-[0.14em] text-slate-400">Primary posture</th>
                      <th className="px-8 py-4 text-[10px] font-[var(--font-display)] uppercase tracking-[0.14em] text-slate-400">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {topFiveAssets.length ? topFiveAssets.map((asset) => (
                      <tr key={asset.asset_id} className="group transition-colors hover:bg-[#00FF41]/5">
                        <td className="px-8 py-5">
                          <div>
                            <p className="font-[var(--font-display)] text-sm font-bold text-white">{getAssetLabel(asset)}</p>
                            <p className="text-xs text-slate-500">{asset.server_software ?? "Unknown server"}</p>
                          </div>
                        </td>
                        <td className="px-8 py-5">
                          <div className="flex items-center gap-2">
                            <div className="h-1 w-12 overflow-hidden rounded-full bg-[#333539]">
                              <div
                                className="h-full bg-[#ff4b2b]"
                                style={{ width: `${Math.min(asset.assessment?.risk_score ?? 0, 100)}%` }}
                              />
                            </div>
                            <span className="font-[var(--font-display)] text-sm font-bold text-[#ffb4a5]">
                              {typeof asset.assessment?.risk_score === "number" ? asset.assessment.risk_score.toFixed(1) : "N/A"}
                            </span>
                          </div>
                        </td>
                        <td className="px-8 py-5">
                          <div className="space-y-1">
                            <span className="rounded bg-[#93000a]/20 px-2 py-1 font-mono text-xs text-[#ffb4a5]">
                              {getActionPriorityLabel(getAssetTier(asset))}
                            </span>
                            <p className="text-xs text-slate-500">
                              {asset.assessment?.tls_version ?? "TLS unavailable"}
                              {asset.assessment?.cipher_suite
                                ? ` • ${asset.assessment.cipher_suite}`
                                : ""}
                            </p>
                          </div>
                        </td>
                        <td className="px-8 py-5">
                          <Link
                            href={buildAssetHref(asset.asset_id, results.scan_id)}
                            className="font-[var(--font-display)] text-[10px] font-bold uppercase tracking-[0.14em] text-[#72ff70] opacity-0 transition-opacity group-hover:opacity-100"
                          >
                            Launch workbench
                          </Link>
                        </td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan={4} className="px-8 py-8 text-sm text-slate-500">
                          No ranked assets were returned for this scan.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        )}

        <div className="grid gap-5 xl:grid-cols-[0.85fr_1.15fr]">
          <div className="rounded-xl border border-white/10 bg-[#1a1c20]/80 p-5">
            <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-slate-500">
              Route handoff
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Button asChild variant="outline" className="rounded-full px-5">
                <Link href={buildScanHref("/risk-heatmap", results.scan_id)}>
                  Open risk heatmap
                </Link>
              </Button>
              <Button asChild className="rounded-full bg-[#00FF41] px-5 text-[#003907] hover:bg-[#2aff63]">
                <Link href={buildScanHref("/assets", results.scan_id)}>
                  Open asset inventory
                </Link>
              </Button>
            </div>
            <p className="mt-4 text-sm leading-6 text-slate-400">
              Report timestamps remain aligned to the scan lifecycle: created{" "}
              {formatTimestamp(results.created_at)} and completed{" "}
              {formatTimestamp(results.completed_at)}.
            </p>
          </div>
          <div className="rounded-xl border border-white/10 bg-[#1a1c20]/80 p-5">
            <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-slate-500">
              Scan runtime context
            </p>
            {results.events.length ? (
              <div className="mt-4 space-y-3">
                {[...results.events].slice(-4).reverse().map((event) => (
                  <div key={`${event.timestamp}-${event.message}`} className="rounded-lg border border-white/8 bg-[#0c0e12]/80 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-[var(--font-display)] text-[10px] uppercase tracking-[0.14em] text-slate-400">
                        {event.stage ?? "runtime"}
                      </span>
                      <span className="font-[var(--font-display)] text-[9px] uppercase text-slate-500">
                        {formatTimestamp(event.timestamp)}
                      </span>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-[#b9ccb2]">{event.message}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-4 text-sm leading-6 text-slate-500">No runtime events were persisted for this scan.</p>
            )}
          </div>
        </div>
        <div className="print:block hidden mt-12 border-t border-gray-300 pt-8 text-center text-xs text-gray-500">
          <p>Aegis Cyber Security Protocol - Confidential Internal Use Only</p>
          <p>Scan Ref: {results.scan_id}</p>
        </div>
      </div>
    </MissionLayout>
  );
}

function ExecutiveMetricCard({
  label,
  value,
  hint,
  suffix,
  tone = "default",
}: {
  label: string;
  value: string;
  hint: string;
  suffix?: string;
  tone?: "default" | "accent" | "danger";
}) {
  const valueTone =
    tone === "accent"
      ? "text-[#72ff70]"
      : tone === "danger"
        ? "text-[#ffb4a5]"
        : "text-white";

  return (
    <div className="relative overflow-hidden rounded-xl border border-white/8 bg-[#282a2e]/80 p-6">
      {tone === "accent" ? (
        <div className="absolute right-0 top-0 h-24 w-24 -translate-y-8 translate-x-8 rounded-full bg-[#00FF41]/5" />
      ) : null}
      <p className="font-[var(--font-display)] text-xs font-medium uppercase tracking-[0.18em] text-slate-400">
        {label}
      </p>
      <div className="mt-3 flex items-end gap-1">
        <span className={`font-[var(--font-display)] text-5xl font-bold tracking-tight ${valueTone}`}>
          {value}
        </span>
        {suffix ? (
          <span className="pb-1 font-[var(--font-display)] text-sm text-slate-500">
            {suffix}
          </span>
        ) : null}
      </div>
      <p className="mt-4 text-xs text-slate-500">{hint}</p>
    </div>
  );
}

function NarrativeCallout({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-white/8 bg-[#333539]/20 p-4">
      <p className="font-[var(--font-display)] text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
        {label}
      </p>
      <p className="mt-2 text-sm text-white">{value}</p>
    </div>
  );
}

function LifecycleRow({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "accent" | "warning" | "danger";
}) {
  const dotTone =
    tone === "accent"
      ? "bg-[#00FF41]"
      : tone === "warning"
        ? "bg-[#72ff70]"
        : "bg-[#ff4b2b]";

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className={`h-2 w-2 rounded-full ${dotTone}`} />
        <span className="text-sm text-[#b9ccb2]">{label}</span>
      </div>
      <span className="font-[var(--font-display)] font-bold text-white">{value}</span>
    </div>
  );
}

function EngineerLedgerRow({
  asset,
  scanId,
}: {
  asset: AssetResultResponse;
  scanId: string;
}) {
  const tier = getAssetTier(asset);
  const urgency = getUrgencyLabel(tier);
  const actionPriority = getActionPriorityLabel(tier);
  const remediationStatus = asset.remediation
    ? "Remediation available"
    : tier === "QUANTUM_VULNERABLE"
      ? "Remediation required"
      : "Not generated";
  const borderTone =
    tier === "QUANTUM_VULNERABLE"
      ? "border-l-[#ff4b2b]"
      : tier === "PQC_TRANSITIONING"
        ? "border-l-[#72ff70]"
        : "border-l-[#00FF41]/30";

  return (
    <div
      className={`grid grid-cols-1 items-center gap-6 rounded-xl border border-white/10 bg-[#1a1c20]/90 p-5 transition-all hover:border-[#00FF41]/30 md:grid-cols-12 md:border-l-4 ${borderTone}`}
    >
      <div className="md:col-span-3">
        <p className="mb-1 font-mono text-xs text-slate-500">ID: {asset.asset_id}</p>
        <p className="font-semibold text-white">{getAssetLabel(asset)}</p>
        <p className="text-[10px] uppercase tracking-[0.12em] text-slate-500">
          {(asset.service_type ?? asset.protocol).toString()} •{" "}
          {asset.server_software ?? "Unknown server"}
        </p>
      </div>
      <div className="md:col-span-2">
        <p className="mb-2 font-[var(--font-display)] text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
          Protocol
        </p>
        <span className="inline-flex rounded bg-[#333539] px-2 py-1 font-mono text-xs text-[#72ff70]">
          {asset.assessment?.tls_version ?? `${asset.protocol.toUpperCase()} ${asset.port}`}
        </span>
      </div>
      <div className="md:col-span-3">
        <p className="mb-2 font-[var(--font-display)] text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
          Cipher suite
        </p>
        <p
          className="truncate font-mono text-xs text-white"
          title={asset.assessment?.cipher_suite ?? "Unavailable"}
        >
          {asset.assessment?.cipher_suite ?? "Unavailable"}
        </p>
      </div>
      <div className="md:col-span-2">
        <p className="mb-2 font-[var(--font-display)] text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
          Remediation
        </p>
        <div className="space-y-1">
          <p className="text-[10px] font-[var(--font-display)] font-bold uppercase tracking-[0.1em] text-[#b9ccb2]">
            {remediationStatus}
          </p>
          <p className="text-[10px] text-slate-500">
            {urgency} • {actionPriority}
          </p>
        </div>
      </div>
      <div className="flex justify-end md:col-span-2">
        <Button
          asChild
          variant="outline"
          size="icon"
          className="h-10 w-10 rounded-lg border-white/10 bg-[#282a2e] text-white hover:bg-[#00FF41] hover:text-[#003907]"
        >
          <Link
            href={buildAssetHref(
              asset.asset_id,
              scanId,
              asset.remediation ? "remediation" : undefined
            )}
          >
            <span className="sr-only">{getRecommendedNextAction(tier)}</span>
            <span className="font-[var(--font-display)] text-xs font-bold uppercase">Go</span>
          </Link>
        </Button>
      </div>
    </div>
  );
}

function compareTier(
  left: ComplianceTier | null | undefined,
  right: ComplianceTier | null | undefined
) {
  const rank = (tier: ComplianceTier | null | undefined) => {
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

  return rank(left) - rank(right);
}

function compareRisk(left: AssetResultResponse, right: AssetResultResponse) {
  return (right.assessment?.risk_score ?? -1) - (left.assessment?.risk_score ?? -1);
}
