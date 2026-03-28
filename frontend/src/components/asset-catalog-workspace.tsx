"use client";

import Link from "next/link";
import { FolderKanban, ShieldCheck } from "lucide-react";

import { AppHeader } from "@/components/app-header";
import { MissionLayout } from "@/components/mission-layout";
import { DegradedModePanel, EventFeedPanel, SummaryMetricGrid } from "@/components/scan-overview-panels";
import { EmptyRouteState, ErrorRouteState, LoadingRouteState } from "@/components/route-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  getActionPriorityLabel,
  getAssetLabel,
  getAssetLocation,
  getAssetTier,
  getRiskScore,
  getTierVariant,
  getUrgencyLabel,
} from "@/lib/result-helpers";
import { buildScanHref } from "@/lib/scan-storage";
import { useBackendHealth } from "@/lib/use-backend-health";
import { useScanResults } from "@/lib/use-scan-results";

export function AssetCatalogWorkspace({
  initialScanParam,
}: {
  initialScanParam?: string | null;
}) {
  const healthState = useBackendHealth();
  const { isHydrated, resolvedScanId, invalidQueryParam, isLoading, error, results, retry } =
    useScanResults({
      initialScanParam,
    });

  const header = (
    <AppHeader
      healthState={healthState}
      activeTarget={results?.target ?? null}
      activeStatus={results?.status ?? null}
      activeStage={results?.stage ?? null}
      elapsedSeconds={results?.elapsed_seconds ?? null}
      summary={results?.summary ?? null}
      degradedModeCount={results?.degraded_modes.length ?? 0}
      eyebrow="Asset Workbench"
      title="Asset intelligence catalog"
      description="Engineer-first asset selection surface with direct paths into CBOM, certificate, and HNDL remediation evidence."
      telemetryNote="The catalog only renders assets returned by the compiled scan results payload for the active scan context."
    />
  );

  if (!isHydrated) {
    return (
      <MissionLayout activeSection="assets" contextScanId={null} header={header}>
        <LoadingRouteState
          eyebrow="Asset workbench"
          title="Resolving asset catalog"
          description="Waiting for a valid scan context before loading asset-level investigation surfaces."
        />
      </MissionLayout>
    );
  }

  if (invalidQueryParam) {
    return (
      <MissionLayout activeSection="assets" contextScanId={resolvedScanId} header={header}>
        <EmptyRouteState
          eyebrow="Invalid scan reference"
          title="The asset catalog needs a valid scan ID"
          description="Open the catalog from Mission Control or use a valid scan query parameter to keep the investigation scoped correctly."
        />
      </MissionLayout>
    );
  }

  if (!resolvedScanId) {
    return (
      <MissionLayout activeSection="assets" contextScanId={resolvedScanId} header={header}>
        <EmptyRouteState
          eyebrow="No scan context"
          title="No scan is available for asset investigation"
          description="Launch a scan first or reuse a completed scan so the workbench can validate which assets belong to the active scope."
        />
      </MissionLayout>
    );
  }

  if (isLoading && !results) {
    return (
      <MissionLayout activeSection="assets" contextScanId={resolvedScanId} header={header}>
        <LoadingRouteState
          eyebrow="Asset workbench"
          title="Loading catalog data"
          description="Suppressing stale scan data until the latest asset inventory for this scan is ready."
        />
      </MissionLayout>
    );
  }

  if (error) {
    return (
      <MissionLayout activeSection="assets" contextScanId={resolvedScanId} header={header}>
        <ErrorRouteState
          eyebrow="Asset catalog unavailable"
          title="The asset workbench could not load this scan"
          description={error}
          actionHref="/"
          actionLabel="Return to scan control"
          onRetry={retry}
        />
      </MissionLayout>
    );
  }

  if (!results || results.status === "pending" || results.status === "running") {
    return (
      <MissionLayout activeSection="assets" contextScanId={results?.scan_id ?? resolvedScanId} header={header}>
        <EmptyRouteState
          eyebrow="Scan still running"
          title="The asset workbench opens after result compilation"
          description="Mission Control remains the source of truth until the scan reaches a terminal state and the asset list is compiled."
          actionHref="/"
          actionLabel="Back to Mission Control"
        />
      </MissionLayout>
    );
  }

  return (
    <MissionLayout activeSection="assets" contextScanId={results.scan_id} header={header}>
      <div className="space-y-5">
        <SummaryMetricGrid summary={results.summary} progress={results.progress} />

        <div className="telemetry-panel overflow-hidden rounded-[28px] border border-white/8 bg-card/90 p-5 shadow-command">
          <div className="mb-5 flex items-start justify-between gap-3">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
                Asset inventory
              </p>
              <h3 className="mt-3 text-2xl font-semibold text-foreground">
                Select an asset for deep inspection
              </h3>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
                Each card links into a scan-validated asset route. The detail
                page will refuse cross-scan navigation before it loads any
                deep artifacts.
              </p>
            </div>
            <Badge variant="outline" className="gap-2">
              <FolderKanban className="h-3.5 w-3.5" />
              {results.assets.length} scoped assets
            </Badge>
          </div>

          {results.assets.length ? (
            <div className="grid gap-4 xl:grid-cols-2">
              {results.assets.map((asset) => {
                const tier = getAssetTier(asset);
                const riskScore = getRiskScore(asset);

                return (
                  <Link
                    key={asset.asset_id}
                    href={`/assets/${asset.asset_id}?scan=${results.scan_id}`}
                    className="group rounded-[26px] border border-white/8 bg-[linear-gradient(180deg,rgba(18,22,38,0.95),rgba(11,14,24,0.98))] p-5 transition-transform hover:-translate-y-0.5 hover:border-sidebar-accent/25"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
                          {getAssetLocation(asset)}
                        </p>
                        <h4 className="mt-3 text-xl font-semibold text-foreground">
                          {getAssetLabel(asset)}
                        </h4>
                        <p className="mt-2 text-sm leading-6 text-muted-foreground">
                          {asset.server_software ?? "Unknown server"} |{" "}
                          {asset.assessment?.cipher_suite ?? "No cipher suite captured"}
                        </p>
                      </div>
                      <Badge variant={getTierVariant(tier)}>
                        {tier ? tier.replaceAll("_", " ") : "No tier"}
                      </Badge>
                    </div>

                    <div className="mt-5 grid gap-3 sm:grid-cols-3">
                      <CatalogMetric
                        label="Risk"
                        value={
                          typeof riskScore === "number"
                            ? riskScore.toFixed(1)
                            : "Unavailable"
                        }
                      />
                      <CatalogMetric
                        label="Certificate"
                        value={asset.certificate?.signing_algorithm ?? "Missing"}
                      />
                      <CatalogMetric
                        label="Remediation"
                        value={asset.remediation ? "Available" : "Not needed / missing"}
                      />
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Badge variant="warning">{getUrgencyLabel(tier)}</Badge>
                      <Badge variant="outline">{getActionPriorityLabel(tier)}</Badge>
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="rounded-[24px] border border-white/8 bg-black/15 p-5 text-sm leading-6 text-muted-foreground">
              No assets were returned for this scan, so the workbench has nothing to inspect.
            </div>
          )}
        </div>

        <div className="grid gap-5 xl:grid-cols-[0.8fr_1.2fr]">
          <div className="space-y-5">
            <DegradedModePanel degradedModes={results.degraded_modes} />
            <div className="rounded-[24px] border border-white/8 bg-black/15 p-5">
              <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
                Report handoff
              </p>
              <h3 className="mt-3 text-2xl font-semibold text-foreground">
                Need the synthesized stakeholder view?
              </h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                The reporting route uses the same scan payload but flips the
                framing between engineer-first and CISO summary views.
              </p>
              <Button asChild className="mt-4 rounded-full px-5">
                <Link href={buildScanHref("/reports", results.scan_id)}>
                  <ShieldCheck className="h-4 w-4" />
                  Open reports
                </Link>
              </Button>
            </div>
          </div>
          <EventFeedPanel events={results.events} />
        </div>
      </div>
    </MissionLayout>
  );
}

function CatalogMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[22px] border border-white/6 bg-white/[0.03] px-4 py-3">
      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-2 text-sm font-medium text-foreground">{value}</p>
    </div>
  );
}
