import Link from "next/link";
import { Radar } from "lucide-react";

import type { MissionControlRecentScanResponse } from "@/lib/api";
import { buildScanHref } from "@/lib/scan-storage";

import { BentoCard } from "@/components/aceternity/bento-grid";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

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

function statusVariant(status: MissionControlRecentScanResponse["status"]) {
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

export function RecentScansPanel({
  scans,
  onRelaunch,
}: {
  scans: MissionControlRecentScanResponse[];
  onRelaunch: (target: string) => void;
}) {
  return (
    <BentoCard className="xl:col-span-7">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
            Recent scans
          </p>
          <h3 className="mt-3 text-2xl font-semibold text-foreground">
            Lightweight scan history
          </h3>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Recent runs stay scan-centric. The summaries below are backend-sourced posture counts, not generated narratives.
          </p>
        </div>
        <Badge variant="outline" className="gap-2">
          <Radar className="h-3.5 w-3.5" />
          {scans.length} recent
        </Badge>
      </div>

      {scans.length ? (
        <div className="mt-5 space-y-3">
          {scans.map((scan) => (
            <div
              key={scan.scan_id}
              className="rounded-[22px] border border-white/8 bg-white/[0.03] p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-base font-semibold text-foreground">{scan.target}</p>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    Created {formatTimestamp(scan.created_at)} | Completed {formatTimestamp(scan.completed_at)}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant={statusVariant(scan.status)}>{scan.status}</Badge>
                  {scan.degraded_mode_count > 0 ? (
                    <Badge variant="warning">{scan.degraded_mode_count} degraded</Badge>
                  ) : null}
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Badge variant="danger">Vulnerable {scan.summary.vulnerable_assets}</Badge>
                <Badge variant="warning">
                  Transitioning {scan.summary.transitioning_assets}
                </Badge>
                <Badge variant="success">
                  Ready {scan.summary.fully_quantum_safe_assets}
                </Badge>
                {typeof scan.summary.highest_risk_score === "number" ? (
                  <Badge variant="outline">
                    Peak risk {scan.summary.highest_risk_score.toFixed(1)}
                  </Badge>
                ) : null}
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button asChild size="sm" className="rounded-full px-4">
                  <Link href={buildScanHref("/risk-heatmap", scan.scan_id)}>Open results</Link>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-full px-4"
                  onClick={() => onRelaunch(scan.target)}
                >
                  Relaunch
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-5 rounded-[22px] border border-dashed border-white/10 bg-black/15 px-4 py-4 text-sm leading-6 text-muted-foreground">
          No persisted scan history is available yet. The first completed scan will seed this timeline automatically.
        </div>
      )}
    </BentoCard>
  );
}
