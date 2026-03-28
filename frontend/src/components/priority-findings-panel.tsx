import Link from "next/link";
import { AlertTriangle, ArrowRight } from "lucide-react";

import type { MissionControlPriorityFindingResponse } from "@/lib/api";
import {
  getActionPriorityLabel,
  getTierVariant,
  getUrgencyLabel,
} from "@/lib/result-helpers";
import { buildAssetHref, buildScanHref } from "@/lib/scan-storage";

import { BackgroundGradient } from "@/components/aceternity/background-gradient";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export function PriorityFindingsPanel({
  findings,
}: {
  findings: MissionControlPriorityFindingResponse[];
}) {
  return (
    <BackgroundGradient className="h-full p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
            Priority findings
          </p>
          <h3 className="mt-3 text-xl font-semibold text-foreground">
            Critical internet-facing exposure
          </h3>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-status-failed/20 bg-status-failed/10 text-status-failed">
          <AlertTriangle className="h-4 w-4" />
        </div>
      </div>

      {findings.length ? (
        <div className="mt-5 space-y-3">
          {findings.map((finding) => (
            <div
              key={`${finding.scan_id}-${finding.asset_id}`}
              className="rounded-[22px] border border-white/8 bg-white/[0.03] p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-base font-semibold text-foreground">
                    {finding.asset_label}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    {finding.target}:{finding.port} | {finding.service_type ?? "Unknown service"}
                  </p>
                </div>
                <Badge variant={getTierVariant(finding.tier)}>
                  {finding.tier ? finding.tier.replaceAll("_", " ") : "No tier"}
                </Badge>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Badge variant="outline">
                  Risk{" "}
                  {typeof finding.risk_score === "number"
                    ? finding.risk_score.toFixed(1)
                    : "Unavailable"}
                </Badge>
                <Badge variant="warning">{getUrgencyLabel(finding.tier)}</Badge>
                <Badge variant="outline">{getActionPriorityLabel(finding.tier)}</Badge>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button asChild size="sm" className="rounded-full px-4">
                  <Link href={buildAssetHref(finding.asset_id, finding.scan_id)}>
                    Open workbench
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild variant="outline" size="sm" className="rounded-full px-4">
                  <Link href={buildAssetHref(finding.asset_id, finding.scan_id, "remediation")}>
                    Review remediation
                  </Link>
                </Button>
                <Button asChild variant="ghost" size="sm" className="rounded-full px-4">
                  <Link href={buildScanHref("/reports", finding.scan_id)}>
                    Open report
                  </Link>
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-5 rounded-[22px] border border-dashed border-white/10 bg-black/15 px-4 py-4 text-sm leading-6 text-muted-foreground">
          No priority findings are available yet. Run a completed compliance scan to surface the most urgent endpoints first.
        </div>
      )}
    </BackgroundGradient>
  );
}
