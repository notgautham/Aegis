import Link from "next/link";
import {
  ArrowRight,
  FileCog,
  FolderKanban,
  ShieldCheck,
  Wrench,
} from "lucide-react";

import type { MissionControlPriorityFindingResponse } from "@/lib/api";
import { buildAssetHref, buildScanHref } from "@/lib/scan-storage";

import { BackgroundGradient } from "@/components/aceternity/background-gradient";

function findPriorityAssetForScan(
  findings: MissionControlPriorityFindingResponse[],
  scanId: string | null
) {
  if (!scanId) {
    return null;
  }

  return findings.find((finding) => finding.scan_id === scanId) ?? null;
}

export function CommandActionsPanel({
  scanId,
  priorityFindings,
}: {
  scanId: string | null;
  priorityFindings: MissionControlPriorityFindingResponse[];
}) {
  const priorityAsset = findPriorityAssetForScan(priorityFindings, scanId);

  return (
    <BackgroundGradient className="h-full p-5">
      <div className="space-y-4">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
            Quick actions
          </p>
          <h3 className="mt-3 text-xl font-semibold text-foreground">
            Move from posture to evidence
          </h3>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Scan-scoped actions use the current completed scan first, then the most recent
            completed scan. Asset actions only enable when a deterministic priority asset exists.
          </p>
        </div>

        <div className="grid gap-3">
          <ActionLink
            href={buildScanHref("/risk-heatmap", scanId)}
            label="View heatmap"
            description="Open analytical posture view"
            icon={ShieldCheck}
            disabled={!scanId}
          />
          <ActionLink
            href={buildScanHref("/reports", scanId)}
            label="Open report"
            description="Engineer and executive reporting"
            icon={FileCog}
            disabled={!scanId}
          />
          <ActionLink
            href={
              priorityAsset
                ? buildAssetHref(priorityAsset.asset_id, priorityAsset.scan_id)
                : "/assets"
            }
            label="Open asset workbench"
            description={
              priorityAsset
                ? `Focus ${priorityAsset.asset_label}:${priorityAsset.port}`
                : "Await a deterministic priority asset"
            }
            icon={FolderKanban}
            disabled={!priorityAsset}
          />
          <ActionLink
            href={
              priorityAsset
                ? buildAssetHref(priorityAsset.asset_id, priorityAsset.scan_id, "remediation")
                : "/assets"
            }
            label="Review remediation"
            description={
              priorityAsset
                ? "Jump directly into remediation guidance"
                : "Await a deterministic priority asset"
            }
            icon={Wrench}
            disabled={!priorityAsset}
          />
        </div>
      </div>
    </BackgroundGradient>
  );
}

function ActionLink({
  href,
  label,
  description,
  icon: Icon,
  disabled,
}: {
  href: string;
  label: string;
  description: string;
  icon: typeof ShieldCheck;
  disabled: boolean;
}) {
  if (disabled) {
    return (
      <div className="rounded-[22px] border border-white/8 bg-white/[0.03] px-4 py-4 opacity-60">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/8 bg-black/15 text-muted-foreground">
            <Icon className="h-4 w-4" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">{label}</p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <Link
      href={href}
      className="group rounded-[22px] border border-white/8 bg-white/[0.03] px-4 py-4 transition-colors hover:border-sidebar-accent/30 hover:bg-sidebar-accent/10"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-sidebar-accent/20 bg-sidebar-accent/10 text-sidebar-accent">
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-foreground">{label}</p>
            <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-white" />
          </div>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
        </div>
      </div>
    </Link>
  );
}
