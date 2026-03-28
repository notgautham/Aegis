import Link from "next/link";
import { ArrowRight } from "lucide-react";

import type { MissionControlPriorityFindingResponse } from "@/lib/api";
import {
  getActionPriorityLabel,
  getUrgencyLabel,
} from "@/lib/result-helpers";
import { buildAssetHref, buildScanHref } from "@/lib/scan-storage";

import { Button } from "@/components/ui/button";

export function PriorityFindingsPanel({
  findings,
}: {
  findings: MissionControlPriorityFindingResponse[];
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-white/5 bg-[#1a1c20]/70 backdrop-blur-2xl">
      <div className="machined-header border-b border-white/5 bg-[#282a2e] px-6 py-3">
        <span className="font-[var(--font-display)] text-xs font-bold uppercase tracking-[0.2em] text-[#e2e2e8]">
          Priority Findings
        </span>
      </div>

      {findings.length ? (
        <div className="space-y-4 p-4">
          {findings.slice(0, 3).map((finding) => (
            <div
              key={`${finding.scan_id}-${finding.asset_id}`}
              className="group rounded-lg border border-white/5 bg-[#1e2024] p-3 transition-all hover:border-[#c31e00]/30"
            >
              <div className="mb-1 flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-bold text-[#e2e2e8]">
                    {finding.asset_label}
                  </p>
                </div>
                <span className="rounded border border-[#c31e00]/30 bg-[#c31e00]/20 px-1.5 py-0.5 text-[8px] font-bold uppercase text-[#ffb4a5]">
                  {getUrgencyLabel(finding.tier)}
                </span>
              </div>
              <p className="mb-2 text-[10px] text-slate-500">
                {finding.target}:{finding.port} | Risk{" "}
                {typeof finding.risk_score === "number"
                  ? finding.risk_score.toFixed(1)
                  : "Unavailable"}{" "}
                | {getActionPriorityLabel(finding.tier)}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  asChild
                  variant="ghost"
                  size="sm"
                  className="h-auto p-0 text-[9px] font-bold uppercase tracking-[0.16em] text-[#00FF41] hover:bg-transparent hover:text-[#72ff70]"
                >
                  <Link href={buildAssetHref(finding.asset_id, finding.scan_id)}>
                    View Report <ArrowRight className="h-3 w-3" />
                  </Link>
                </Button>
                <Button
                  asChild
                  variant="ghost"
                  size="sm"
                  className="h-auto p-0 text-[9px] font-bold uppercase tracking-[0.16em] text-slate-400 hover:bg-transparent hover:text-[#e2e2e8]"
                >
                  <Link href={buildAssetHref(finding.asset_id, finding.scan_id, "remediation")}>
                    Remediation
                  </Link>
                </Button>
                <Button
                  asChild
                  variant="ghost"
                  size="sm"
                  className="h-auto p-0 text-[9px] font-bold uppercase tracking-[0.16em] text-slate-400 hover:bg-transparent hover:text-[#e2e2e8]"
                >
                  <Link href={buildScanHref("/reports", finding.scan_id)}>
                    Report
                  </Link>
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="p-4 text-sm leading-6 text-slate-500">
          No priority findings are available yet. Run a completed compliance scan to surface the most urgent endpoints first.
        </div>
      )}
    </div>
  );
}
