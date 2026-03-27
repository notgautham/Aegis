import { AlertTriangle, Clock3, RadioTower } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { MetricCard } from "@/components/metric-card";
import type {
  ProgressResponse,
  ScanRuntimeEventResponse,
  ScanSummaryResponse,
} from "@/lib/api";
import { formatStage, formatTimestamp } from "@/lib/formatters";

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

export function SummaryMetricGrid({
  summary,
  progress,
}: {
  summary: ScanSummaryResponse | null;
  progress: ProgressResponse | null;
}) {
  if (!summary) {
    return null;
  }

  return (
    <div className="grid gap-4 lg:grid-cols-3 xl:grid-cols-6">
      <MetricCard label="Assets" value={summary.total_assets} />
      <MetricCard label="TLS assets" value={summary.tls_assets} />
      <MetricCard label="Vulnerable" value={summary.vulnerable_assets} tone="danger" />
      <MetricCard
        label="Transitioning"
        value={summary.transitioning_assets}
        tone="warning"
      />
      <MetricCard
        label="Ready"
        value={summary.fully_quantum_safe_assets}
        tone="success"
      />
      <MetricCard
        label="Certificates"
        value={progress?.certificates_created ?? "Unavailable"}
        hint={
          typeof summary.highest_risk_score === "number"
            ? `Peak risk ${summary.highest_risk_score.toFixed(1)}`
            : "No assessed risk score"
        }
      />
    </div>
  );
}

export function DegradedModePanel({ degradedModes }: { degradedModes: string[] }) {
  if (!degradedModes.length) {
    return null;
  }

  return (
    <div className="rounded-[24px] border border-status-running/25 bg-status-running/10 px-4 py-4">
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 text-status-running" />
        <p className="font-medium text-status-running">Degraded mode notices</p>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {degradedModes.map((message) => (
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
  );
}

export function EventFeedPanel({ events }: { events: ScanRuntimeEventResponse[] }) {
  const recentEvents = events.slice(-8).reverse();

  return (
    <div className="rounded-[24px] border border-white/8 bg-black/15 px-4 py-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
            Scan event feed
          </p>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Recent runtime events remain backend-sourced so long-running scans
            and fallbacks stay explainable.
          </p>
        </div>
        <Badge variant="outline" className="gap-2">
          <RadioTower className="h-3.5 w-3.5" />
          {recentEvents.length} event{recentEvents.length === 1 ? "" : "s"}
        </Badge>
      </div>

      {recentEvents.length ? (
        <div className="mt-4 space-y-3">
          {recentEvents.map((event) => (
            <div
              key={`${event.timestamp}-${event.message}`}
              className={`rounded-2xl border px-4 py-3 ${eventTone(event)}`}
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-sm font-medium">{event.message}</p>
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
          No runtime events were persisted for this scan context.
        </div>
      )}
    </div>
  );
}
