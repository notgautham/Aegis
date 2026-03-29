"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  RefreshCcw,
  Trash2,
} from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { buildScanHref } from "@/lib/scan-storage";

import type {
  ProgressResponse,
  ScanRuntimeEventResponse,
  ScanStatusResponse,
} from "@/lib/api";

interface ScanStatusCardProps {
  scan: ScanStatusResponse | null;
  isHydrated: boolean;
  pollingError: string | null;
  onManualRefresh: () => void;
  onClear: () => void;
}

function formatTimestamp(value: string | null | undefined): string {
  if (!value) {
    return "Pending";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Unavailable";
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function getStatusVariant(status: string | null) {
  switch (status) {
    case "completed":
      return "success" as const;
    case "failed":
      return "danger" as const;
    case "running":
      return "warning" as const;
    default:
      return "outline" as const;
  }
}

function formatStage(stage: string | null | undefined): string {
  if (!stage) {
    return "No active telemetry";
  }

  return stage.replaceAll("_", " ");
}

function hasCompleteProgress(
  progress: ProgressResponse | null | undefined
): progress is ProgressResponse {
  return Boolean(
    progress &&
      [
        progress.assets_discovered,
        progress.assessments_created,
        progress.cboms_created,
        progress.remediations_created,
        progress.certificates_created,
      ].every((value) => typeof value === "number" && Number.isFinite(value))
  );
}

function progressCards(progress: ProgressResponse) {
  return [
    ["Assets", progress.assets_discovered],
    ["Assessments", progress.assessments_created],
    ["CBOMs", progress.cboms_created],
    ["Remediations", progress.remediations_created],
    ["Certificates", progress.certificates_created],
  ];
}

function recentEvents(events: ScanRuntimeEventResponse[] | undefined) {
  return (events ?? []).slice(-6).reverse();
}

export function ScanStatusCard({
  scan,
  isHydrated,
  pollingError,
  onManualRefresh,
  onClear,
}: ScanStatusCardProps) {
  const progress = hasCompleteProgress(scan?.progress) ? scan.progress : null;
  const summary = scan?.summary ?? null;
  const events = recentEvents(scan?.events);
  const discoveryStillRunning =
    scan?.status === "running" && (progress?.assets_discovered ?? 0) === 0;
  const completionPercent = approximateStageProgress(scan);
  const [elapsedNowMs, setElapsedNowMs] = useState(() => deriveElapsedMs(scan));

  useEffect(() => {
    setElapsedNowMs(deriveElapsedMs(scan));
    if (!scan || (scan.status !== "pending" && scan.status !== "running")) {
      return;
    }

    const interval = setInterval(() => {
      setElapsedNowMs(deriveElapsedMs(scan));
    }, 1000);

    return () => clearInterval(interval);
  }, [scan]);

  const elapsedLabel = useMemo(() => formatDuration(elapsedNowMs), [elapsedNowMs]);

  return (
    <Card className="relative overflow-hidden rounded-xl border border-white/5 bg-[#1a1c20]/70 shadow-2xl shadow-black/50 backdrop-blur-2xl">
      <CardContent className="space-y-5 p-6">
        {!isHydrated ? (
          <div className="space-y-3">
            <Skeleton className="h-5 w-28" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : !scan ? (
          <div className="rounded-lg border border-dashed border-white/10 bg-[#111318] p-6">
            <p className="font-[var(--font-display)] text-[10px] uppercase tracking-[0.2em] text-slate-500">
              Empty state
            </p>
            <h3 className="mt-3 font-[var(--font-display)] text-xl font-semibold text-[#e2e2e8]">
              No active scan selected
            </h3>
            <p className="mt-2 max-w-xl text-sm leading-6 text-slate-500">
              Start with one target in the scan launcher. Once a scan exists,
              this panel becomes the source of truth for lifecycle, counters,
              and terminal state.
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-end justify-between gap-4">
              <div className="min-w-0">
                <h3 className="font-[var(--font-display)] text-lg font-bold tracking-tight text-[#e2e2e8]">
                  Active Scan:{" "}
                  <span className="text-[#00FF41]">{scan.target.toUpperCase()}</span>
                </h3>
                <p className="font-[var(--font-display)] text-[10px] uppercase tracking-[0.16em] text-slate-500">
                  Started: {formatTimestamp(scan.created_at)} {"//"} Thread_ID:{" "}
                  {scan.scan_id.slice(0, 8)}
                </p>
              </div>
              <div className="text-right">
                <span className="font-[var(--font-display)] text-2xl font-bold text-[#e2e2e8]">
                  {completionPercent}%
                </span>
                <p className="mt-1 font-[var(--font-display)] text-[10px] uppercase tracking-[0.16em] text-slate-500">
                  Elapsed {elapsedLabel}
                </p>
              </div>
            </div>

            <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#0c0e12]">
              <div
                className="h-full bg-[#00FF41] shadow-[0_0_10px_rgba(0,255,65,0.4)]"
                style={{ width: `${completionPercent}%` }}
              />
            </div>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
              <div className="rounded-lg border border-white/5 bg-[#0c0e12] p-3 font-mono text-[11px] leading-relaxed text-[#72ff70] md:col-span-2">
                {events.length > 0 ? (
                  events.slice(0, 4).map((event) => (
                    <p key={`${event.timestamp}-${event.message}`}>
                      [{formatTimestamp(event.timestamp)}] {event.message}
                    </p>
                  ))
                ) : (
                  <>
                    <p>[INIT] Awaiting runtime events from orchestrator...</p>
                    <p>[STATE] {formatStage(scan.stage)}</p>
                    <p>
                      [DETAIL]{" "}
                      {scan.stage_detail ??
                        (discoveryStillRunning
                          ? "Discovery in progress, awaiting persisted assets."
                          : "Scan context active.")}
                    </p>
                  </>
                )}
              </div>
              <div className="space-y-3">
                <RuntimeStat
                  label="Assets Identified"
                  value={summary?.total_assets ?? progress?.assets_discovered ?? 0}
                />
                <RuntimeStat
                  label="Compliance Pass"
                  value={`${summary ? complianceRate(summary) : 0}%`}
                  accent
                />
                <RuntimeStat
                  label="Alert Flags"
                  value={scan.degraded_modes.length}
                  danger
                />
              </div>
            </div>

            {scan.degraded_modes.length > 0 ? (
              <div className="rounded-[24px] border border-status-running/25 bg-status-running/10 px-4 py-4">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-status-running" />
                  <p className="font-medium text-status-running">
                    Degraded mode notices
                  </p>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {scan.degraded_modes.map((message) => (
                    <Badge
                      key={message}
                      variant="warning"
                      className="max-w-full whitespace-normal text-left leading-5"
                    >
                      {message}
                    </Badge>
                  ))}
                </div>
              </div>
            ) : null}

            {pollingError ? (
              <div className="flex items-start gap-3 rounded-2xl border border-status-failed/25 bg-status-failed/10 px-4 py-4 text-sm text-status-failed">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <div>
                  <p className="font-medium">Connection issue while polling</p>
                  <p className="mt-1 leading-6 text-status-failed/85">
                    {pollingError}
                  </p>
                </div>
              </div>
            ) : null}

            {scan.status === "completed" ? (
              <div className="flex items-start gap-3 rounded-2xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-4 text-sm text-emerald-200">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                <div>
                  <p className="font-medium">Scan completed</p>
                  <p className="mt-1 leading-6 text-emerald-200/85">
                    {summary
                      ? `Completed with ${summary.tls_assets} TLS asset${summary.tls_assets === 1 ? "" : "s"}, ${summary.vulnerable_assets} vulnerable service${summary.vulnerable_assets === 1 ? "" : "s"}, and ${progress?.certificates_created ?? 0} issued certificate${(progress?.certificates_created ?? 0) === 1 ? "" : "s"}.`
                      : "Phase 10 will unlock the richer results views, but the scan lifecycle is already complete and stable."}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button asChild size="sm" className="h-9 rounded-full px-4">
                      <Link href={buildScanHref("/risk-heatmap", scan.scan_id)}>
                        Open risk heatmap
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    </Button>
                    <Button asChild variant="outline" size="sm" className="h-9 rounded-full px-4">
                      <Link href={buildScanHref("/reports", scan.scan_id)}>
                        Open reports
                      </Link>
                    </Button>
                    <Button asChild variant="ghost" size="sm" className="h-9 rounded-full px-4">
                      <Link href={buildScanHref("/assets", scan.scan_id)}>
                        Open assets
                      </Link>
                    </Button>
                  </div>
                </div>
              </div>
            ) : null}

            {scan.status === "failed" ? (
              <div className="flex items-start gap-3 rounded-2xl border border-status-failed/25 bg-status-failed/10 px-4 py-4 text-sm text-status-failed">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <div>
                  <p className="font-medium">Scan failed</p>
                  <p className="mt-1 leading-6 text-status-failed/85">
                    The active scan context and recent event trail are preserved
                    until you clear them, which helps with inspection and retry
                    workflows.
                  </p>
                </div>
              </div>
            ) : null}
            <div className="flex flex-col gap-3 border-t border-white/5 pt-4 sm:flex-row sm:justify-end">
              <Button variant="outline" onClick={onManualRefresh}>
                <RefreshCcw className="h-4 w-4" />
                Refresh now
              </Button>
              <Button variant="ghost" onClick={onClear}>
                <Trash2 className="h-4 w-4" />
                Clear current scan
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function deriveElapsedMs(scan: ScanStatusResponse | null): number {
  if (!scan) {
    return 0;
  }

  if (typeof scan.elapsed_seconds === "number" && Number.isFinite(scan.elapsed_seconds)) {
    if (scan.status === "pending" || scan.status === "running") {
      const stageReference = scan.stage_started_at ?? scan.created_at;
      if (stageReference) {
        const sinceStageMs = Date.now() - new Date(stageReference).getTime();
        if (Number.isFinite(sinceStageMs) && sinceStageMs >= 0) {
          return Math.max(scan.elapsed_seconds * 1000, sinceStageMs);
        }
      }
    }
    return Math.max(scan.elapsed_seconds * 1000, 0);
  }

  const start = scan.created_at ? new Date(scan.created_at).getTime() : NaN;
  if (!Number.isFinite(start)) {
    return 0;
  }

  const end =
    scan.status === "completed" || scan.status === "failed"
      ? scan.completed_at
        ? new Date(scan.completed_at).getTime()
        : Date.now()
      : Date.now();
  return Math.max(end - start, 0);
}

function formatDuration(durationMs: number): string {
  const totalSeconds = Math.max(Math.floor(durationMs / 1000), 0);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${String(minutes).padStart(2, "0")}m ${String(seconds).padStart(2, "0")}s`;
  }
  return `${minutes}m ${String(seconds).padStart(2, "0")}s`;
}

function approximateStageProgress(scan: ScanStatusResponse | null): number {
  if (!scan) {
    return 0;
  }
  if (scan.status === "completed" || scan.status === "failed") {
    return 100;
  }

  switch (scan.stage) {
    case "queued":
      return 8;
    case "resolving_target":
      return 15;
    case "enumerating_domains":
      return 26;
    case "validating_dns":
      return 36;
    case "scanning_ports":
      return 52;
    case "probing_tls":
      return 66;
    case "assessing_tls_assets":
      return 78;
    case "generating_remediation":
      return 90;
    case "issuing_certificates":
      return 96;
    default:
      return 18;
  }
}

function complianceRate(summary: NonNullable<ScanStatusResponse["summary"]>): number {
  if (!summary.total_assets) {
    return 0;
  }
  return Math.round((summary.fully_quantum_safe_assets / summary.total_assets) * 100);
}

function RuntimeStat({
  label,
  value,
  accent = false,
  danger = false,
}: Readonly<{
  label: string;
  value: number | string;
  accent?: boolean;
  danger?: boolean;
}>) {
  return (
    <div className="flex items-center justify-between border-b border-white/5 pb-2 last:border-b-0 last:pb-0">
      <span className="font-[var(--font-display)] text-[10px] uppercase text-slate-500">
        {label}
      </span>
      <span
        className={`font-[var(--font-display)] font-bold ${
          accent ? "text-[#00FF41]" : danger ? "text-[#ffb4a5]" : "text-[#e2e2e8]"
        }`}
      >
        {value}
      </span>
    </div>
  );
}
