import Link from "next/link";

import type { MissionControlRecentScanResponse } from "@/lib/api";
import { buildScanHref } from "@/lib/scan-storage";

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

export function RecentScansPanel({
  scans,
}: {
  scans: MissionControlRecentScanResponse[];
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-white/5 bg-[#1a1c20]/70 backdrop-blur-2xl">
      <div className="flex items-center justify-between border-b border-white/5 bg-[#282a2e] px-6 py-3">
        <span className="font-[var(--font-display)] text-xs font-bold uppercase tracking-[0.2em] text-[#e2e2e8]">
          Recent Operational History
        </span>
        <button className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#00FF41] hover:underline">
          Export Logs
        </button>
      </div>

      {scans.length ? (
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-white/5 bg-[#1a1c20]">
                <th className="px-6 py-3 font-[var(--font-display)] text-[10px] uppercase tracking-[0.18em] text-slate-500">
                  Target Segment
                </th>
                <th className="px-6 py-3 font-[var(--font-display)] text-[10px] uppercase tracking-[0.18em] text-slate-500">
                  Status
                </th>
                <th className="px-6 py-3 font-[var(--font-display)] text-[10px] uppercase tracking-[0.18em] text-slate-500">
                  Vulnerable
                </th>
                <th className="px-6 py-3 font-[var(--font-display)] text-[10px] uppercase tracking-[0.18em] text-slate-500">
                  Risk Score
                </th>
                <th className="px-6 py-3 font-[var(--font-display)] text-[10px] uppercase tracking-[0.18em] text-slate-500">
                  Timestamp
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {scans.map((scan) => (
                <tr
                  key={scan.scan_id}
                  className="cursor-pointer transition-colors hover:bg-white/5"
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <span className="text-slate-500">◎</span>
                      <div>
                        <Link
                          href={buildScanHref("/risk-heatmap", scan.scan_id)}
                          className="font-body text-sm font-medium text-[#e2e2e8]"
                        >
                          {scan.target}
                        </Link>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase ${
                        scan.status === "completed"
                          ? "border border-[#00FF41]/20 bg-[#00FF41]/10 text-[#00FF41]"
                          : scan.status === "failed"
                            ? "border border-[#c31e00]/20 bg-[#c31e00]/10 text-[#ffb4a5]"
                            : "border border-white/10 bg-white/5 text-slate-300"
                      }`}
                    >
                      {scan.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 font-[var(--font-display)] text-sm text-[#e2e2e8]">
                    {scan.summary.vulnerable_assets}
                  </td>
                  <td className="px-6 py-4 font-[var(--font-display)] text-sm text-[#00FF41]">
                    {typeof scan.summary.highest_risk_score === "number"
                      ? scan.summary.highest_risk_score.toFixed(2)
                      : "N/A"}
                  </td>
                  <td className="px-6 py-4 font-[var(--font-display)] text-[10px] uppercase text-slate-500">
                    {formatTimestamp(scan.completed_at ?? scan.created_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="p-4 text-sm leading-6 text-slate-500">
          No persisted scan history is available yet. The first completed scan will seed this timeline automatically.
        </div>
      )}
    </div>
  );
}
