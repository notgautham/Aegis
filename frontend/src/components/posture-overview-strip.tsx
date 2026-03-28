import { ShieldCheck, ShieldEllipsis, ShieldX } from "lucide-react";

import type { MissionControlPortfolioSummaryResponse } from "@/lib/api";

import { MetricCard } from "@/components/metric-card";

export function PostureOverviewStrip({
  summary,
}: {
  summary: MissionControlPortfolioSummaryResponse | null;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
      <MetricCard
        label="Completed scans"
        value={summary?.completed_scans ?? 0}
        hint={`${summary?.running_scans ?? 0} currently active`}
      />
      <MetricCard
        label="Vulnerable assets"
        value={summary?.vulnerable_assets ?? 0}
        tone="danger"
        hint="Critical internet-facing endpoints first"
      />
      <MetricCard
        label="Transitioning"
        value={summary?.transitioning_assets ?? 0}
        tone="warning"
        hint="Requires planned cryptographic uplift"
      />
      <MetricCard
        label="Compliant assets"
        value={summary?.compliant_assets ?? 0}
        tone="success"
        hint="Currently meeting post-quantum posture"
      />
      <MetricCard
        label="Certificates issued"
        value={summary?.certificates_issued ?? 0}
        hint="Compliance evidence generated"
      />
      <MetricCard
        label="Remediation bundles"
        value={summary?.remediation_bundles_generated ?? 0}
        hint={`${summary?.degraded_scan_count ?? 0} degraded scan${
          (summary?.degraded_scan_count ?? 0) === 1 ? "" : "s"
        }`}
      />
    </div>
  );
}

export function PostureStatusLegend() {
  return (
    <div className="flex flex-wrap gap-2">
      <div className="inline-flex items-center gap-2 rounded-full border border-status-failed/25 bg-status-failed/10 px-3 py-1.5 text-xs text-status-failed">
        <ShieldX className="h-3.5 w-3.5" />
        Vulnerable
      </div>
      <div className="inline-flex items-center gap-2 rounded-full border border-status-running/25 bg-status-running/10 px-3 py-1.5 text-xs text-status-running">
        <ShieldEllipsis className="h-3.5 w-3.5" />
        Transitioning
      </div>
      <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1.5 text-xs text-emerald-200">
        <ShieldCheck className="h-3.5 w-3.5" />
        Quantum ready
      </div>
    </div>
  );
}
