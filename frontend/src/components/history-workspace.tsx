"use client";

import Link from "next/link";
import { Clock3, History as HistoryIcon } from "lucide-react";

import { AppHeader } from "@/components/app-header";
import { Timeline, TimelineItem } from "@/components/aceternity/timeline";
import { MissionLayout } from "@/components/mission-layout";
import {
  EmptyRouteState,
  ErrorRouteState,
  LoadingRouteState,
} from "@/components/route-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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

function statusVariant(status: string) {
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

export function HistoryWorkspace({
  initialScanParam,
}: {
  initialScanParam?: string | null;
}) {
  const healthState = useBackendHealth();
  const { isHydrated, resolvedScanId } = useResolvedScan(initialScanParam);
  const { history, isLoading, error, retry } = useScanHistory();

  const header = (
    <AppHeader
      healthState={healthState}
      activeTarget={null}
      activeStatus={null}
      activeStage={null}
      elapsedSeconds={null}
      summary={null}
      degradedModeCount={0}
      eyebrow="History"
      title="Recent scan timeline"
      description="A lightweight scan history route that keeps Aegis scan-centric while making recent assessments feel like a mature operational console."
      telemetryNote="This route intentionally stops short of deep historical diffing and instead focuses on believable recent run history."
    />
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
          description="The timeline is waiting for the latest persisted scan history from the backend."
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
          title="Recent scan history appears after the first completed assessment"
          description="Mission Control will seed this timeline automatically once at least one scan has been persisted."
          actionHref="/"
          actionLabel="Open Mission Control"
        />
      </MissionLayout>
    );
  }

  return (
    <MissionLayout activeSection="history" contextScanId={resolvedScanId} header={header}>
      <div className="rounded-[28px] border border-white/8 bg-card/90 p-5 shadow-command">
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
              Timeline
            </p>
            <h3 className="mt-3 text-2xl font-semibold text-foreground">
              Recent scan activity
            </h3>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
              Reopen any completed run, relaunch a familiar target, or use this view to show the jury that Aegis behaves like a real assessment console over time.
            </p>
          </div>
          <Badge variant="outline" className="gap-2">
            <HistoryIcon className="h-3.5 w-3.5" />
            {history.items.length} entries
          </Badge>
        </div>

        <Timeline>
          {history.items.map((item) => (
            <TimelineItem
              key={item.scan_id}
              title={item.target}
              subtitle={`Created ${formatTimestamp(item.created_at)} | Completed ${formatTimestamp(item.completed_at)}`}
              badge={<Badge variant={statusVariant(item.status)}>{item.status}</Badge>}
            >
              <div className="flex flex-wrap gap-2">
                <Badge variant="danger">Vulnerable {item.summary.vulnerable_assets}</Badge>
                <Badge variant="warning">
                  Transitioning {item.summary.transitioning_assets}
                </Badge>
                <Badge variant="success">
                  Ready {item.summary.fully_quantum_safe_assets}
                </Badge>
                {typeof item.summary.highest_risk_score === "number" ? (
                  <Badge variant="outline">
                    Peak risk {item.summary.highest_risk_score.toFixed(1)}
                  </Badge>
                ) : null}
                {item.degraded_mode_count > 0 ? (
                  <Badge variant="warning">{item.degraded_mode_count} degraded</Badge>
                ) : null}
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button asChild size="sm" className="rounded-full px-4">
                  <Link href={buildScanHref("/risk-heatmap", item.scan_id)}>
                    Open results
                  </Link>
                </Button>
                <Button asChild variant="outline" size="sm" className="rounded-full px-4">
                  <Link href={buildScanHref("/reports", item.scan_id)}>Open report</Link>
                </Button>
                <Button asChild variant="ghost" size="sm" className="rounded-full px-4">
                  <Link href={buildScanHref("/assets", item.scan_id)}>
                    <Clock3 className="h-4 w-4" />
                    Inspect assets
                  </Link>
                </Button>
              </div>
            </TimelineItem>
          ))}
        </Timeline>
      </div>
    </MissionLayout>
  );
}
