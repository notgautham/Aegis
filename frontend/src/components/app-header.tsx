import {
  Activity,
  AlertTriangle,
  Binary,
  Orbit,
  Radar,
  Signal,
  SignalHigh,
  SignalZero,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { formatDuration, formatStage } from "@/lib/formatters";
import type { ScanSummaryResponse } from "@/lib/api";

type HealthState = "checking" | "healthy" | "offline";

interface AppHeaderProps {
  healthState: HealthState;
  activeTarget: string | null;
  activeStatus: string | null;
  activeStage: string | null;
  elapsedSeconds: number | null;
  summary: ScanSummaryResponse | null;
  degradedModeCount: number;
  eyebrow?: string;
  title?: string;
  description?: string;
  telemetryNote?: string;
}

function healthPresentation(state: HealthState) {
  switch (state) {
    case "healthy":
      return {
        icon: SignalHigh,
        label: "Backend reachable",
        variant: "success" as const,
      };
    case "offline":
      return {
        icon: SignalZero,
        label: "Backend disconnected",
        variant: "danger" as const,
      };
    default:
      return {
        icon: Signal,
        label: "Checking backend",
        variant: "outline" as const,
      };
  }
}

function formatStatus(status: string | null): string {
  if (!status) {
    return "No active scan";
  }

  return status.replaceAll("_", " ");
}

export function AppHeader({
  healthState,
  activeTarget,
  activeStatus,
  activeStage,
  elapsedSeconds,
  summary,
  degradedModeCount,
  eyebrow = "Mission Control",
  title = "Scan orchestration dashboard",
  description = "Live command surface for discovery, compliance posture, remediation generation, and certificate issuance across one trustworthy scan.",
  telemetryNote = "Ground-truth metrics remain backend-sourced so the interface explains the scan without inventing state.",
}: AppHeaderProps) {
  const health = healthPresentation(healthState);
  const HealthIcon = health.icon;

  return (
    <header className="telemetry-panel relative overflow-hidden rounded-[30px] border border-border/70 bg-header-panel px-6 py-5 shadow-command sm:px-7">
      <div className="telemetry-grid pointer-events-none absolute inset-0 opacity-40" />
      <div className="pointer-events-none absolute -right-16 top-0 h-40 w-40 rounded-full bg-[radial-gradient(circle,_rgba(77,167,255,0.2),_transparent_68%)]" />
      <div className="pointer-events-none absolute bottom-0 left-1/3 h-24 w-48 rounded-full bg-[radial-gradient(circle,_rgba(39,216,154,0.15),_transparent_70%)] blur-2xl" />

      <div className="relative flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.32em] text-muted-foreground">
            {eyebrow}
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-foreground sm:text-[2.25rem]">
            {title}
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
            {description}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {degradedModeCount > 0 ? (
            <Badge variant="warning" className="h-fit gap-2 px-3 py-1.5">
              <AlertTriangle className="h-3.5 w-3.5" />
              {degradedModeCount} degraded mode
              {degradedModeCount === 1 ? "" : "s"}
            </Badge>
          ) : null}
          <Badge variant={health.variant} className="h-fit gap-2 px-3 py-1.5">
            <HealthIcon className="h-3.5 w-3.5" />
            {health.label}
          </Badge>
        </div>
      </div>

      <div className="relative mt-1 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-[24px] border border-white/8 bg-white/[0.035] px-4 py-4 backdrop-blur-sm">
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
            Current target
          </p>
          <p className="mt-3 truncate text-base font-medium text-foreground">
            {activeTarget ?? "No scan selected"}
          </p>
        </div>
        <div className="rounded-[24px] border border-white/8 bg-white/[0.035] px-4 py-4 backdrop-blur-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
                Pipeline state
              </p>
              <div className="mt-3 flex items-center gap-2 text-base font-medium text-foreground">
                <Activity className="h-4 w-4 text-status-running" />
                {formatStatus(activeStatus)}
              </div>
            </div>
            <Badge
              variant="outline"
              className="border-white/10 bg-black/15 text-muted-foreground"
            >
              {formatDuration(elapsedSeconds)}
            </Badge>
          </div>
          <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
            <Radar className="h-4 w-4 text-sidebar-accent" />
            {formatStage(activeStage)}
          </div>
        </div>
        <div className="rounded-[24px] border border-white/8 bg-white/[0.035] px-4 py-4 backdrop-blur-sm">
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
            Threat mix
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Badge variant="danger" className="gap-2">
              <Orbit className="h-3.5 w-3.5" />
              Vulnerable {summary?.vulnerable_assets ?? 0}
            </Badge>
            <Badge variant="warning">
              Transitioning {summary?.transitioning_assets ?? 0}
            </Badge>
            <Badge variant="success">
              Ready {summary?.fully_quantum_safe_assets ?? 0}
            </Badge>
          </div>
        </div>
        <div className="rounded-[24px] border border-white/8 bg-white/[0.035] px-4 py-4 backdrop-blur-sm">
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
            Peak telemetry
          </p>
          <p className="mt-3 text-base font-medium text-foreground">
            {typeof summary?.highest_risk_score === "number"
              ? `Risk ${summary.highest_risk_score.toFixed(1)}`
              : "Awaiting assessed assets"}
          </p>
          <div className="mt-2 flex items-start gap-2 text-sm leading-6 text-muted-foreground">
            <Binary className="mt-0.5 h-4 w-4 shrink-0 text-sidebar-accent" />
            <p>{telemetryNote}</p>
          </div>
        </div>
      </div>
    </header>
  );
}
