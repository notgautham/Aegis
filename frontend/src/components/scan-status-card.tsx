"use client";

import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock3,
  Orbit,
  Loader2,
  RadioTower,
  RefreshCcw,
  ShieldAlert,
  Trash2,
} from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
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
  isPolling: boolean;
  pollingState: "idle" | "polling" | "retrying";
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

function formatDuration(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "Awaiting timeline";
  }

  const totalSeconds = Math.max(0, Math.floor(value));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }

  return `${seconds}s`;
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

function eventTone(event: ScanRuntimeEventResponse) {
  switch (event.kind) {
    case "error":
      return "border-status-failed/25 bg-status-failed/10 text-status-failed";
    case "degraded":
      return "border-status-running/25 bg-status-running/10 text-status-running";
    case "success":
      return "border-emerald-500/25 bg-emerald-500/10 text-emerald-200";
    default:
      return "border-white/8 bg-white/[0.03] text-muted-foreground";
  }
}

function recentEvents(events: ScanRuntimeEventResponse[] | undefined) {
  return (events ?? []).slice(-6).reverse();
}

export function ScanStatusCard({
  scan,
  isHydrated,
  isPolling,
  pollingState,
  pollingError,
  onManualRefresh,
  onClear,
}: ScanStatusCardProps) {
  const statusVariant = getStatusVariant(scan?.status ?? null);
  const progress = hasCompleteProgress(scan?.progress) ? scan.progress : null;
  const summary = scan?.summary ?? null;
  const events = recentEvents(scan?.events);
  const discoveryStillRunning =
    scan?.status === "running" && (progress?.assets_discovered ?? 0) === 0;

  return (
    <Card className="telemetry-panel relative h-full overflow-hidden">
      <div className="telemetry-grid pointer-events-none absolute inset-0 opacity-30" />
      <div className="pointer-events-none absolute inset-y-0 right-[-40px] w-44 bg-[radial-gradient(circle,_rgba(80,170,255,0.16),_transparent_68%)] blur-xl" />
      <CardHeader>
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <CardTitle>Active scan state</CardTitle>
            <CardDescription>
              Polls the backend truth source and turns the current scan into a
              readable operational story instead of a blind status loop.
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {scan ? (
              <Badge variant={statusVariant}>
                {scan.status.replaceAll("_", " ")}
              </Badge>
            ) : null}
            {pollingState === "retrying" ? (
              <Badge variant="warning">Retrying</Badge>
            ) : null}
            {isPolling ? (
              <Badge variant="outline" className="gap-2">
                <Loader2 className="h-3 w-3 animate-spin" />
                Polling
              </Badge>
            ) : null}
          </div>
        </div>
      </CardHeader>
      <CardContent className="relative space-y-5">
        {!isHydrated ? (
          <div className="space-y-3">
            <Skeleton className="h-5 w-28" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : !scan ? (
          <div className="rounded-2xl border border-dashed border-border/80 bg-black/10 p-6">
            <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
              Empty state
            </p>
            <h3 className="mt-3 text-xl font-semibold text-foreground">
              No active scan selected
            </h3>
            <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
              Start with one target in the scan launcher. Once a scan exists,
              this panel becomes the source of truth for lifecycle, counters,
              and terminal state.
            </p>
          </div>
        ) : (
          <>
            <div className="rounded-[24px] border border-white/8 bg-black/20 p-4 backdrop-blur-sm">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
                    Current stage
                  </p>
                  <h3 className="mt-3 text-2xl font-semibold text-foreground">
                    {formatStage(scan.stage)}
                  </h3>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                    {scan.stage_detail
                      ? scan.stage_detail
                      : discoveryStillRunning
                        ? "Discovery is still in flight. Counters stay at zero until assets are actually persisted."
                        : "The dashboard is reflecting only persisted backend truth."}
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-white/8 bg-white/[0.035] px-4 py-3">
                    <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                      Elapsed
                    </p>
                    <p className="mt-2 text-sm font-medium text-foreground">
                      {formatDuration(scan.elapsed_seconds)}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/8 bg-white/[0.035] px-4 py-3">
                    <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                      Stage entered
                    </p>
                    <p className="mt-2 text-sm font-medium text-foreground">
                      {formatTimestamp(scan.stage_started_at)}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid gap-3 lg:grid-cols-3">
              <div className="rounded-[24px] border border-white/6 bg-black/15 px-4 py-4">
                <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
                  Target
                </p>
                <p className="mt-3 truncate text-sm font-medium text-foreground">
                  {scan.target}
                </p>
              </div>
              <div className="rounded-[24px] border border-white/6 bg-black/15 px-4 py-4">
                <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
                  Created
                </p>
                <p className="mt-3 text-sm font-medium text-foreground">
                  {formatTimestamp(scan.created_at)}
                </p>
              </div>
              <div className="rounded-[24px] border border-white/6 bg-black/15 px-4 py-4">
                <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
                  Completed
                </p>
                <p className="mt-3 text-sm font-medium text-foreground">
                  {formatTimestamp(scan.completed_at)}
                </p>
              </div>
            </div>

            {progress ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
                    Pipeline counters
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Derived directly from persisted rows
                  </p>
                </div>
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                  {progressCards(progress).map(([label, value]) => (
                    <div
                      key={label}
                      className="rounded-[24px] border border-white/6 bg-white/[0.03] px-4 py-4"
                    >
                      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                        {label}
                      </p>
                      <p className="mt-3 text-2xl font-semibold text-foreground">
                        {value}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="rounded-[24px] border border-white/6 bg-black/10 px-4 py-4 text-sm leading-6 text-muted-foreground">
                Progress counters are currently unavailable. The panel is
                intentionally showing only known backend truth instead of
                inventing derived numbers.
              </div>
            )}

            {summary ? (
              <div className="grid gap-3 lg:grid-cols-2">
                <div className="rounded-[24px] border border-white/6 bg-black/15 px-4 py-4">
                  <div className="flex items-center gap-2">
                    <Orbit className="h-4 w-4 text-sidebar-accent" />
                    <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
                      Asset mix
                    </p>
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    <div>
                      <p className="text-2xl font-semibold text-foreground">
                        {summary.total_assets}
                      </p>
                      <p className="mt-1 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                        Total assets
                      </p>
                    </div>
                    <div>
                      <p className="text-2xl font-semibold text-foreground">
                        {summary.tls_assets}
                      </p>
                      <p className="mt-1 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                        TLS assets
                      </p>
                    </div>
                    <div>
                      <p className="text-2xl font-semibold text-foreground">
                        {summary.non_tls_assets}
                      </p>
                      <p className="mt-1 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                        Non-TLS assets
                      </p>
                    </div>
                  </div>
                </div>
                <div className="rounded-[24px] border border-white/6 bg-black/15 px-4 py-4">
                  <div className="flex items-center gap-2">
                    <ShieldAlert className="h-4 w-4 text-status-running" />
                    <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
                      Compliance mix
                    </p>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Badge variant="danger">
                      Vulnerable {summary.vulnerable_assets}
                    </Badge>
                    <Badge variant="warning">
                      Transitioning {summary.transitioning_assets}
                    </Badge>
                    <Badge variant="success">
                      Ready {summary.fully_quantum_safe_assets}
                    </Badge>
                    {typeof summary.highest_risk_score === "number" ? (
                      <Badge variant="outline">
                        Peak risk {summary.highest_risk_score.toFixed(1)}
                      </Badge>
                    ) : null}
                  </div>
                </div>
              </div>
            ) : null}

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

            <div className="rounded-[24px] border border-white/6 bg-black/15 px-4 py-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
                    Scan event feed
                  </p>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    Recent execution events help explain long-running scans and
                    make fallback behavior visible.
                  </p>
                </div>
                <Badge variant="outline" className="gap-2">
                  <RadioTower className="h-3.5 w-3.5" />
                  {events.length} recent event{events.length === 1 ? "" : "s"}
                </Badge>
              </div>

              {events.length > 0 ? (
                <div className="mt-4 space-y-3">
                  {events.map((event) => (
                    <div
                      key={`${event.timestamp}-${event.message}`}
                      className={`rounded-2xl border px-4 py-3 ${eventTone(event)}`}
                    >
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <p className="text-sm font-medium">
                            {event.message}
                          </p>
                          <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.18em] opacity-80">
                            {formatStage(event.stage)}
                          </p>
                        </div>
                        <div className="inline-flex items-center gap-2 text-xs opacity-80">
                          <Clock3 className="h-3.5 w-3.5" />
                          {formatTimestamp(event.timestamp)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-4 rounded-2xl border border-dashed border-white/10 bg-black/10 px-4 py-4 text-sm leading-6 text-muted-foreground">
                  No runtime events have been recorded yet. The scan may still
                  be queued, or the app may have restarted since this scan was
                  launched.
                </div>
              )}
            </div>

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
                        Open asset workbench
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

            <Separator />

            <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
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
