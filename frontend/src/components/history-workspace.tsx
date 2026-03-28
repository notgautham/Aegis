"use client";

import Link from "next/link";
import { Bell, Clock3, Search, Settings, UserRound } from "lucide-react";

import { MissionLayout } from "@/components/mission-layout";
import {
  EmptyRouteState,
  ErrorRouteState,
  LoadingRouteState,
} from "@/components/route-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ScanHistoryItemResponse, ScanStatus } from "@/lib/api";
import { buildScanHref } from "@/lib/scan-storage";
import { useBackendHealth } from "@/lib/use-backend-health";
import { useResolvedScan } from "@/lib/use-resolved-scan";
import { useScanHistory } from "@/lib/use-scan-history";

function formatTimestamp(value: string | null): string {
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

export function HistoryWorkspace({
  initialScanParam,
}: {
  initialScanParam?: string | null;
}) {
  const healthState = useBackendHealth();
  const { isHydrated, resolvedScanId } = useResolvedScan(initialScanParam);
  const { history, isLoading, error, retry } = useScanHistory();

  const header = (
    <header className="fixed left-0 right-0 top-0 z-50 h-14 border-b border-[#00FF41]/10 bg-[#111318]/80 backdrop-blur-md lg:pl-[18.5rem]">
      <div className="flex h-full items-center justify-between px-6">
        <div className="flex items-center gap-8">
          <span className="font-[var(--font-display)] text-xl font-bold tracking-tighter text-[#00FF41]">
            AEGIS
          </span>
          <nav className="hidden items-center gap-6 md:flex">
            <span className="font-[var(--font-display)] text-[10px] uppercase tracking-[0.1em] text-slate-500">
              Health{" "}
              {healthState === "healthy"
                ? "Nominal"
                : healthState === "checking"
                  ? "Syncing"
                  : "Offline"}
            </span>
            <span className="font-[var(--font-display)] text-[10px] uppercase tracking-[0.1em] text-slate-500">
              History
            </span>
            <span className="font-[var(--font-display)] text-[10px] uppercase tracking-[0.1em] text-slate-500">
              Timeline
            </span>
          </nav>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="rounded p-1.5 text-[#00FF41] transition-all hover:bg-[#333539]/30"
            aria-label="Search"
          >
            <Search className="h-4 w-4" />
          </button>
          <button
            type="button"
            className="rounded p-1.5 text-[#00FF41] transition-all hover:bg-[#333539]/30"
            aria-label="Status"
          >
            <Bell className="h-4 w-4" />
          </button>
          <button
            type="button"
            className="rounded p-1.5 text-slate-400 transition-all hover:bg-[#333539]/30"
            aria-label="Settings"
          >
            <Settings className="h-4 w-4" />
          </button>
          <button
            type="button"
            className="ml-2 rounded-full border border-white/10 p-1.5 text-slate-300"
            aria-label="Operator"
          >
            <UserRound className="h-4 w-4" />
          </button>
        </div>
      </div>
    </header>
  );

  if (!isHydrated) {
    return (
      <MissionLayout activeSection="history" contextScanId={resolvedScanId} header={header}>
        <LoadingRouteState
          eyebrow="History"
          title="Resolving timeline context"
          description="Loading recent scan history without flashing stale route state."
        />
      </MissionLayout>
    );
  }

  if (isLoading && !history) {
    return (
      <MissionLayout activeSection="history" contextScanId={resolvedScanId} header={header}>
        <LoadingRouteState
          eyebrow="History"
          title="Loading recent scans"
          description="The operational timeline is waiting for the latest persisted scan history from the backend."
        />
      </MissionLayout>
    );
  }

  if (error) {
    return (
      <MissionLayout activeSection="history" contextScanId={resolvedScanId} header={header}>
        <ErrorRouteState
          eyebrow="History unavailable"
          title="The recent scan timeline could not be loaded"
          description={error}
          actionHref="/"
          actionLabel="Return to Mission Control"
          onRetry={retry}
        />
      </MissionLayout>
    );
  }

  if (!history || history.items.length === 0) {
    return (
      <MissionLayout activeSection="history" contextScanId={resolvedScanId} header={header}>
        <EmptyRouteState
          eyebrow="No history yet"
          title="Recent scan history appears after the first persisted assessment"
          description="Mission Control will seed this timeline automatically once at least one scan has been completed or failed."
          actionHref="/"
          actionLabel="Open Mission Control"
        />
      </MissionLayout>
    );
  }

  return (
    <MissionLayout activeSection="history" contextScanId={resolvedScanId} header={header}>
      <div className="space-y-10 pb-12">
        <section className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <h1 className="font-[var(--font-display)] text-3xl font-bold tracking-tight text-white">
              Operational timeline
            </h1>
            <p className="mt-1 text-sm text-[#b9ccb2]">
              Reverse chronological audit of persisted scan runs across recent banking
              security assessments.
            </p>
          </div>
          <div className="flex gap-3">
            <Button
              variant="outline"
              className="rounded-lg border-white/10 bg-[#282a2e] text-xs font-[var(--font-display)] uppercase"
            >
              Filter by target
            </Button>
            <Button asChild className="rounded-lg bg-[#00FF41] text-xs font-[var(--font-display)] uppercase text-[#003907] hover:bg-[#2aff63]">
              <Link href="/">Initiate scan</Link>
            </Button>
          </div>
        </section>

        <div className="space-y-4">
          {history.items.map((item) => (
            <HistoryTimelineRow key={item.scan_id} item={item} />
          ))}
        </div>

        <div className="flex justify-center">
          <Button
            variant="outline"
            className="rounded-lg border-white/10 bg-[#282a2e] px-8 text-xs font-[var(--font-display)] uppercase tracking-[0.14em] text-slate-300"
          >
            Retrieve historical archive
          </Button>
        </div>
      </div>
    </MissionLayout>
  );
}

function HistoryTimelineRow({ item }: { item: ScanHistoryItemResponse }) {
  const statusTone = getStatusAccent(item.status);
  const summaryCards = [
    {
      label: "Vulnerable",
      value: item.summary.vulnerable_assets,
      valueClass: "text-[#ffb4a5]",
      highlight: item.summary.vulnerable_assets > 0,
    },
    {
      label: "Transitioning",
      value: item.summary.transitioning_assets,
      valueClass: "text-[#72ff70]",
      highlight: item.summary.transitioning_assets > 0,
    },
    {
      label: "Compliant",
      value: item.summary.fully_quantum_safe_assets,
      valueClass: "text-[#00FF41]",
      highlight: item.summary.fully_quantum_safe_assets > 0,
    },
  ];

  return (
    <div
      className={`group relative rounded-r-xl border-l-4 bg-[#1a1c20]/95 p-5 transition-all duration-300 hover:bg-[#1e2024] ${statusTone.container}`}
    >
      <div className="flex flex-col gap-6 lg:flex-row lg:items-center">
        <div className="min-w-[280px] flex-1">
          <div className="mb-2 flex items-center gap-3">
            <Badge className={statusTone.badgeClass}>{item.status.toUpperCase()}</Badge>
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-slate-500">
              ID: {item.scan_id.slice(0, 8)}
            </span>
          </div>
          <h3 className="font-[var(--font-display)] text-lg font-bold text-white">
            {item.target}
          </h3>
          <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-[#b9ccb2]">
            <span className="inline-flex items-center gap-1.5">
              <Clock3 className="h-3.5 w-3.5" />
              {formatTimestamp(item.created_at)}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Clock3 className="h-3.5 w-3.5" />
              {item.status === "completed"
                ? `${formatTimestamp(item.completed_at)} (${formatDuration(item.created_at, item.completed_at)})`
                : item.status === "failed"
                  ? `Failed ${formatTimestamp(item.completed_at)}`
                  : "Pending completion"}
            </span>
          </div>
        </div>

        <div className="grid flex-[2] grid-cols-2 gap-4 md:grid-cols-4">
          {summaryCards.map((card) => (
            <div
              key={card.label}
              className={`rounded-lg border p-3 ${
                card.highlight
                  ? "border-white/10 bg-[#282a2e]/80"
                  : "border-white/5 bg-[#282a2e]/45"
              }`}
            >
              <p className="font-[var(--font-display)] text-[9px] uppercase tracking-[0.14em] text-slate-400">
                {card.label}
              </p>
              <p className={`mt-1 font-[var(--font-display)] text-xl font-bold ${card.valueClass}`}>
                {String(card.value).padStart(2, "0")}
              </p>
            </div>
          ))}
          <div
            className={`rounded-lg border p-3 ${
              typeof item.summary.highest_risk_score === "number"
                ? item.summary.highest_risk_score >= 80
                  ? "border-[#c31e00]/30 bg-[#333539]"
                  : "border-[#00FF41]/20 bg-[#333539]"
                : "border-white/5 bg-[#282a2e]/45"
            }`}
          >
            <p
              className={`font-[var(--font-display)] text-[9px] uppercase tracking-[0.14em] ${
                typeof item.summary.highest_risk_score === "number" &&
                item.summary.highest_risk_score >= 80
                  ? "text-[#ffb4a5]"
                  : "text-slate-400"
              }`}
            >
              Max risk score
            </p>
            <p className="mt-1 font-[var(--font-display)] text-xl font-bold text-white">
              {typeof item.summary.highest_risk_score === "number"
                ? `${item.summary.highest_risk_score.toFixed(1)}`
                : "N/A"}{" "}
              {typeof item.summary.highest_risk_score === "number" ? (
                <span className="text-[10px] font-normal text-slate-500">/100</span>
              ) : null}
            </p>
          </div>
        </div>

        <div className="flex min-w-[156px] gap-2 lg:flex-col">
          <Button
            asChild
            variant="outline"
            className="flex-1 rounded border-white/10 bg-[#282a2e] text-[10px] font-[var(--font-display)] uppercase tracking-[0.14em] text-slate-200 hover:bg-[#333539] lg:w-full"
          >
            <Link href={buildScanHref("/risk-heatmap", item.scan_id)}>Open results</Link>
          </Button>
          <Button
            asChild
            variant="outline"
            className="flex-1 rounded border-white/10 bg-[#282a2e] text-[10px] font-[var(--font-display)] uppercase tracking-[0.14em] text-slate-200 hover:bg-[#333539] lg:w-full"
          >
            <Link href={buildScanHref("/assets", item.scan_id)}>Inspect assets</Link>
          </Button>
          <Button
            asChild
            variant={item.status === "failed" ? "outline" : "ghost"}
            className={`flex-1 rounded text-[10px] font-[var(--font-display)] uppercase tracking-[0.14em] lg:w-full ${
              item.status === "failed"
                ? "border-[#c31e00]/20 bg-[#c31e00]/10 text-[#ffb4a5] hover:bg-[#c31e00]/20"
                : "text-[#72ff70] hover:bg-[#00FF41]/10"
            }`}
          >
            <Link href={buildScanHref("/reports", item.scan_id)}>
              {item.status === "failed" ? "Open report" : "Open report"}
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

function getStatusAccent(status: ScanStatus) {
  switch (status) {
    case "completed":
      return {
        container: "border-l-[#00FF41]",
        badgeClass:
          "border border-[#00FF41]/20 bg-[#00FF41]/10 text-[#00FF41] font-[var(--font-display)] text-[10px] tracking-[0.12em]",
      };
    case "failed":
      return {
        container: "border-l-[#c31e00]",
        badgeClass:
          "border border-[#c31e00]/20 bg-[#c31e00]/10 text-[#ffb4a5] font-[var(--font-display)] text-[10px] tracking-[0.12em]",
      };
    case "running":
      return {
        container: "border-l-[#72ff70]",
        badgeClass:
          "border border-[#72ff70]/20 bg-[#72ff70]/10 text-[#72ff70] font-[var(--font-display)] text-[10px] tracking-[0.12em]",
      };
    default:
      return {
        container: "border-l-white/20",
        badgeClass:
          "border border-white/10 bg-white/5 text-slate-300 font-[var(--font-display)] text-[10px] tracking-[0.12em]",
      };
  }
}

function formatDuration(createdAt: string | null, completedAt: string | null) {
  if (!createdAt || !completedAt) {
    return "Duration unavailable";
  }

  const start = new Date(createdAt).getTime();
  const end = new Date(completedAt).getTime();
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) {
    return "Duration unavailable";
  }

  const totalSeconds = Math.round((end - start) / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (minutes === 0) {
    return `${seconds}s`;
  }

  return `${minutes}m ${seconds}s`;
}
