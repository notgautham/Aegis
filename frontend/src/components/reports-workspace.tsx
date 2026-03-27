"use client";

import { useState } from "react";
import Link from "next/link";
import { FileCog, ShieldCheck, Wrench } from "lucide-react";

import { AppHeader } from "@/components/app-header";
import { MetricCard } from "@/components/metric-card";
import { MissionLayout } from "@/components/mission-layout";
import { DegradedModePanel, EventFeedPanel, SummaryMetricGrid } from "@/components/scan-overview-panels";
import { EmptyRouteState, ErrorRouteState, LoadingRouteState } from "@/components/route-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatTimestamp } from "@/lib/formatters";
import { getAssetLabel, getAssetTier, getTierVariant } from "@/lib/result-helpers";
import { buildScanHref } from "@/lib/scan-storage";
import { useBackendHealth } from "@/lib/use-backend-health";
import { useScanResults } from "@/lib/use-scan-results";

type ReportTab = "engineer" | "ciso";

export function ReportsWorkspace({
  initialScanParam,
}: {
  initialScanParam?: string | null;
}) {
  const [activeTab, setActiveTab] = useState<ReportTab>("engineer");
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
      eyebrow="Report Deck"
      title="Dual-perspective reporting"
      description="One compiled scan payload rendered for technical implementation teams and executive stakeholders without changing the underlying facts."
      telemetryNote="Engineer Details opens first, but both tabs consume the same scan results contract and the same backend counts."
    />
  );

  if (!isHydrated) {
    return (
      <MissionLayout activeSection="reports" contextScanId={null} header={header}>
        <LoadingRouteState
          eyebrow="Reports"
          title="Resolving report context"
          description="Waiting for a valid scan before rendering the engineer and CISO reporting surfaces."
        />
      </MissionLayout>
    );
  }

  if (invalidQueryParam) {
    return (
      <MissionLayout activeSection="reports" contextScanId={resolvedScanId} header={header}>
        <EmptyRouteState
          eyebrow="Invalid scan reference"
          title="This report route needs a valid scan ID"
          description="The report deck will not issue backend requests for malformed scan identifiers."
        />
      </MissionLayout>
    );
  }

  if (!resolvedScanId) {
    return (
      <MissionLayout activeSection="reports" contextScanId={resolvedScanId} header={header}>
        <EmptyRouteState
          eyebrow="No scan context"
          title="No scan is available for reporting"
          description="Launch a scan from Mission Control or open the route with a valid completed scan query parameter."
        />
      </MissionLayout>
    );
  }

  if (isLoading && !results) {
    return (
      <MissionLayout activeSection="reports" contextScanId={resolvedScanId} header={header}>
        <LoadingRouteState
          eyebrow="Reports"
          title="Loading report payload"
          description="Suppressing stale report content until the latest compiled scan results are available."
        />
      </MissionLayout>
    );
  }

  if (error) {
    return (
      <MissionLayout activeSection="reports" contextScanId={resolvedScanId} header={header}>
        <ErrorRouteState
          eyebrow="Reports unavailable"
          title="The reporting deck could not load this scan"
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
      <MissionLayout activeSection="reports" contextScanId={results?.scan_id ?? resolvedScanId} header={header}>
        <EmptyRouteState
          eyebrow="Scan still running"
          title="Reporting opens after result compilation"
          description="Mission Control remains the live status surface until the scan reaches a terminal state."
          actionHref="/"
          actionLabel="Back to Mission Control"
        />
      </MissionLayout>
    );
  }

  if (!results.summary) {
    return (
      <MissionLayout activeSection="reports" contextScanId={results.scan_id} header={header}>
        <ErrorRouteState
          eyebrow="Summary unavailable"
          title="This scan does not include a compiled summary"
          description="The reporting deck only renders backend-provided posture metrics. Retry the scan results request or return to Mission Control."
          actionHref="/"
          actionLabel="Return to scan control"
          onRetry={retry}
        />
      </MissionLayout>
    );
  }

  const vulnerableAssets = results.assets.filter(
    (asset) => getAssetTier(asset) === "QUANTUM_VULNERABLE"
  );

  return (
    <MissionLayout activeSection="reports" contextScanId={results.scan_id} header={header}>
      <div className="space-y-5">
        <SummaryMetricGrid summary={results.summary} progress={results.progress} />

        <div className="flex flex-wrap gap-2">
          <Button
            variant={activeTab === "engineer" ? "default" : "outline"}
            className="rounded-full px-5"
            onClick={() => setActiveTab("engineer")}
          >
            <Wrench className="h-4 w-4" />
            Engineer Details
          </Button>
          <Button
            variant={activeTab === "ciso" ? "default" : "outline"}
            className="rounded-full px-5"
            onClick={() => setActiveTab("ciso")}
          >
            <ShieldCheck className="h-4 w-4" />
            CISO Summary
          </Button>
        </div>

        {activeTab === "engineer" ? (
          <div className="grid gap-5 xl:grid-cols-[1.25fr_0.75fr]">
            <div className="telemetry-panel overflow-hidden rounded-[28px] border border-white/8 bg-card/90 p-5 shadow-command">
              <div className="mb-5 flex items-start justify-between gap-3">
                <div>
                  <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
                    Engineer details
                  </p>
                  <h3 className="mt-3 text-2xl font-semibold text-foreground">
                    Asset-by-asset implementation view
                  </h3>
                </div>
                <Badge variant="outline" className="gap-2">
                  <FileCog className="h-3.5 w-3.5" />
                  {results.assets.length} assets in scope
                </Badge>
              </div>

              <div className="space-y-4">
                {results.assets.map((asset) => (
                  <div
                    key={asset.asset_id}
                    className="rounded-[24px] border border-white/8 bg-black/15 p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                          {asset.protocol.toUpperCase()} {asset.port}
                        </p>
                        <h4 className="mt-3 text-xl font-semibold text-foreground">
                          {getAssetLabel(asset)}
                        </h4>
                        <p className="mt-2 text-sm leading-6 text-muted-foreground">
                          {asset.assessment?.cipher_suite ?? "Cipher suite unavailable"} |{" "}
                          {asset.server_software ?? "Unknown server"}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant={getTierVariant(getAssetTier(asset))}>
                          {getAssetTier(asset)?.replaceAll("_", " ") ?? "No tier"}
                        </Badge>
                        <Badge variant="outline">
                          {typeof asset.assessment?.risk_score === "number"
                            ? `Risk ${asset.assessment.risk_score.toFixed(1)}`
                            : "Risk unavailable"}
                        </Badge>
                      </div>
                    </div>
                    <div className="mt-4 grid gap-3 lg:grid-cols-3">
                      <MetricCard
                        label="TLS version"
                        value={asset.assessment?.tls_version ?? "Unavailable"}
                      />
                      <MetricCard
                        label="Certificate"
                        value={asset.certificate?.signing_algorithm ?? "Unavailable"}
                      />
                      <MetricCard
                        label="Remediation"
                        value={asset.remediation ? "Available" : "Unavailable"}
                      />
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Button asChild variant="outline" size="sm" className="rounded-full px-4">
                        <Link href={`/assets/${asset.asset_id}?scan=${results.scan_id}`}>
                          Open asset workbench
                        </Link>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-5">
              <div className="rounded-[24px] border border-white/8 bg-black/15 p-5">
                <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
                  Implementation posture
                </p>
                <div className="mt-4 space-y-3">
                  <MetricCard
                    label="Assessments created"
                    value={results.progress?.assessments_created ?? "Unavailable"}
                  />
                  <MetricCard
                    label="Remediations created"
                    value={results.progress?.remediations_created ?? "Unavailable"}
                  />
                  <MetricCard
                    label="Certificates issued"
                    value={results.progress?.certificates_created ?? "Unavailable"}
                  />
                </div>
              </div>
              <DegradedModePanel degradedModes={results.degraded_modes} />
            </div>
          </div>
        ) : (
          <div className="grid gap-5 xl:grid-cols-[1fr_1fr]">
            <div className="telemetry-panel overflow-hidden rounded-[28px] border border-white/8 bg-card/90 p-5 shadow-command">
              <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
                CISO summary
              </p>
              <h3 className="mt-3 text-2xl font-semibold text-foreground">
                Executive posture snapshot
              </h3>
              <div className="mt-5 grid gap-4 lg:grid-cols-2">
                <MetricCard label="Assets scanned" value={results.summary.total_assets} />
                <MetricCard label="TLS assets" value={results.summary.tls_assets} />
                <MetricCard
                  label="Vulnerable services"
                  value={results.summary.vulnerable_assets}
                  tone="danger"
                />
                <MetricCard
                  label="Highest risk score"
                  value={
                    typeof results.summary.highest_risk_score === "number"
                      ? results.summary.highest_risk_score.toFixed(1)
                      : "Unavailable"
                  }
                />
              </div>

              <div className="mt-5 rounded-[24px] border border-white/8 bg-black/15 p-5">
                <p className="text-base font-semibold text-foreground">
                  Current posture narrative
                </p>
                <p className="mt-3 text-sm leading-7 text-muted-foreground">
                  The completed scan against <span className="text-foreground">{results.target}</span> found{" "}
                  <span className="text-foreground">{results.summary.tls_assets}</span> TLS assets and{" "}
                  <span className="text-foreground">{results.summary.vulnerable_assets}</span> services currently
                  classified as quantum vulnerable. A total of{" "}
                  <span className="text-foreground">{results.progress?.certificates_created ?? "an unavailable number of"}</span>{" "}
                  compliance certificates were issued from the same backend pipeline, and degraded-mode notices{" "}
                  {results.degraded_modes.length ? "were observed during execution." : "were not observed for this scan."}
                </p>
              </div>
            </div>

            <div className="space-y-5">
              <div className="rounded-[24px] border border-white/8 bg-black/15 p-5">
                <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
                  Priority exposure list
                </p>
                <div className="mt-4 space-y-3">
                  {vulnerableAssets.length ? (
                    vulnerableAssets.map((asset) => (
                      <div
                        key={asset.asset_id}
                        className="rounded-[20px] border border-white/8 bg-white/[0.03] p-4"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-base font-semibold text-foreground">
                              {getAssetLabel(asset)}
                            </p>
                            <p className="mt-2 text-sm leading-6 text-muted-foreground">
                              {asset.assessment?.cipher_suite ?? "Cipher suite unavailable"}
                            </p>
                          </div>
                          <Badge variant="danger">Vulnerable</Badge>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-[20px] border border-white/8 bg-white/[0.03] p-4 text-sm leading-6 text-muted-foreground">
                      No vulnerable assets were reported in the backend summary.
                    </div>
                  )}
                </div>
              </div>
              <DegradedModePanel degradedModes={results.degraded_modes} />
            </div>
          </div>
        )}

        <div className="grid gap-5 xl:grid-cols-[0.85fr_1.15fr]">
          <div className="rounded-[24px] border border-white/8 bg-black/15 p-5">
            <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
              Route handoff
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Button asChild variant="outline" className="rounded-full px-5">
                <Link href={buildScanHref("/risk-heatmap", results.scan_id)}>
                  Open risk heatmap
                </Link>
              </Button>
              <Button asChild className="rounded-full px-5">
                <Link href={buildScanHref("/assets", results.scan_id)}>
                  Open asset workbench
                </Link>
              </Button>
            </div>
            <p className="mt-4 text-sm leading-6 text-muted-foreground">
              Report timestamps remain aligned to the scan lifecycle: created{" "}
              {formatTimestamp(results.created_at)} and completed{" "}
              {formatTimestamp(results.completed_at)}.
            </p>
          </div>
          <EventFeedPanel events={results.events} />
        </div>
      </div>
    </MissionLayout>
  );
}
