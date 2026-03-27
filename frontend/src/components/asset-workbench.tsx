"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ClipboardCopy,
  FileBadge2,
  FileJson2,
  FileText,
  ShieldCheck,
} from "lucide-react";

import {
  getAssetCbom,
  getAssetCertificate,
  getAssetRemediation,
  type CbomResponse,
  type CertificateResponse,
  type RemediationResponse,
} from "@/lib/api";
import { getErrorMessage, isAbortError, isNotFoundError } from "@/lib/api-helpers";
import { formatTimestamp, formatTitleCase } from "@/lib/formatters";
import { findAssetInResults, getAssetLabel, getAssetLocation, getAssetTier, getTierVariant } from "@/lib/result-helpers";
import { buildScanHref, normalizeUuid } from "@/lib/scan-storage";
import { useBackendHealth } from "@/lib/use-backend-health";
import { useScanResults } from "@/lib/use-scan-results";

import { AppHeader } from "@/components/app-header";
import { JsonTreeViewer } from "@/components/json-tree-viewer";
import { MissionLayout } from "@/components/mission-layout";
import { MetricCard } from "@/components/metric-card";
import { DegradedModePanel, EventFeedPanel } from "@/components/scan-overview-panels";
import {
  ArtifactStateCard,
  EmptyRouteState,
  ErrorRouteState,
  LoadingRouteState,
} from "@/components/route-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type AssetTab = "cbom" | "certificate" | "remediation";
type ArtifactStatus = "idle" | "loading" | "ready" | "missing" | "error";

interface ArtifactLoadState<T> {
  status: ArtifactStatus;
  data: T | null;
  message: string | null;
}

function initialArtifactState<T>(): ArtifactLoadState<T> {
  return { status: "idle", data: null, message: null };
}

function useAssetArtifacts({
  assetId,
  enabled,
}: {
  assetId: string;
  enabled: boolean;
}) {
  const [cbom, setCbom] = useState<ArtifactLoadState<CbomResponse>>(initialArtifactState);
  const [certificate, setCertificate] =
    useState<ArtifactLoadState<CertificateResponse>>(initialArtifactState);
  const [remediation, setRemediation] =
    useState<ArtifactLoadState<RemediationResponse>>(initialArtifactState);

  const requestTokenRef = useRef(0);
  const controllerRef = useRef<AbortController | null>(null);

  const loadArtifacts = useCallback(async () => {
    if (!enabled) {
      setCbom(initialArtifactState);
      setCertificate(initialArtifactState);
      setRemediation(initialArtifactState);
      return;
    }

    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    const token = requestTokenRef.current + 1;
    requestTokenRef.current = token;

    setCbom({ status: "loading", data: null, message: null });
    setCertificate({ status: "loading", data: null, message: null });
    setRemediation({ status: "loading", data: null, message: null });

    const [cbomResult, certificateResult, remediationResult] = await Promise.allSettled([
      getAssetCbom(assetId, { signal: controller.signal }),
      getAssetCertificate(assetId, { signal: controller.signal }),
      getAssetRemediation(assetId, { signal: controller.signal }),
    ]);

    if (requestTokenRef.current !== token) {
      return;
    }

    const mapResult = <T,>(
      result: PromiseSettledResult<T>,
      missingMessage: string,
      errorMessage: string
    ): ArtifactLoadState<T> => {
      if (result.status === "fulfilled") {
        return { status: "ready", data: result.value, message: null };
      }

      if (isAbortError(result.reason)) {
        return initialArtifactState();
      }

      if (isNotFoundError(result.reason)) {
        return { status: "missing", data: null, message: missingMessage };
      }

      return {
        status: "error",
        data: null,
        message: getErrorMessage(result.reason, errorMessage),
      };
    };

    setCbom(
      mapResult(
        cbomResult,
        "No CBOM artifact is available for this asset.",
        "The CBOM artifact could not be loaded."
      )
    );
    setCertificate(
      mapResult(
        certificateResult,
        "No compliance certificate is available for this asset.",
        "The certificate artifact could not be loaded."
      )
    );
    setRemediation(
      mapResult(
        remediationResult,
        "No remediation bundle is available for this asset.",
        "The remediation artifact could not be loaded."
      )
    );
  }, [assetId, enabled]);

  useEffect(() => {
    void loadArtifacts();

    return () => {
      controllerRef.current?.abort();
    };
  }, [loadArtifacts]);

  return { cbom, certificate, remediation, retry: loadArtifacts };
}

export function AssetWorkbench({
  assetId,
  initialScanParam,
}: {
  assetId: string;
  initialScanParam?: string | null;
}) {
  const [activeTab, setActiveTab] = useState<AssetTab>("cbom");
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");
  const healthState = useBackendHealth();
  const normalizedAssetId = normalizeUuid(assetId);
  const { isHydrated, resolvedScanId, invalidQueryParam, isLoading, error, results, retry } =
    useScanResults({ initialScanParam });

  const asset = useMemo(
    () => (normalizedAssetId ? findAssetInResults(results, normalizedAssetId) : null),
    [normalizedAssetId, results]
  );

  const {
    cbom,
    certificate,
    remediation,
    retry: retryArtifacts,
  } = useAssetArtifacts({
    assetId: normalizedAssetId ?? "",
    enabled: Boolean(results && asset && normalizedAssetId),
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
      title="Forensic asset deep-dive"
      description="CBOM structure, compliance certificate, and remediation evidence for one asset within the active scan."
      telemetryNote="Asset-level investigation stays anchored to the active scan and rejects cross-scan mismatches before loading deep artifacts."
    />
  );

  const handleCopyPem = useCallback(async () => {
    if (!certificate.data?.certificate_pem) {
      return;
    }

    try {
      await navigator.clipboard.writeText(certificate.data.certificate_pem);
      setCopyState("copied");
    } catch {
      setCopyState("failed");
    }
  }, [certificate.data?.certificate_pem]);

  useEffect(() => {
    if (copyState === "idle") {
      return;
    }

    const timeout = setTimeout(() => setCopyState("idle"), 2000);
    return () => clearTimeout(timeout);
  }, [copyState]);

  if (!isHydrated) {
    return (
      <MissionLayout activeSection="asset-workbench" contextScanId={null} header={header}>
        <LoadingRouteState
          eyebrow="Asset workbench"
          title="Resolving asset context"
          description="The workbench is waiting for both a valid scan and a valid asset identifier."
        />
      </MissionLayout>
    );
  }

  if (invalidQueryParam) {
    return (
      <MissionLayout activeSection="asset-workbench" contextScanId={resolvedScanId} header={header}>
        <EmptyRouteState
          eyebrow="Invalid scan reference"
          title="This asset route needs a valid scan ID"
          description="The workbench refuses malformed scan identifiers so it can keep asset navigation scoped correctly."
        />
      </MissionLayout>
    );
  }

  if (!resolvedScanId) {
    return (
      <MissionLayout activeSection="asset-workbench" contextScanId={resolvedScanId} header={header}>
        <EmptyRouteState
          eyebrow="No scan context"
          title="No scan is available for asset inspection"
          description="Open the workbench from a completed scan or provide a valid scan query parameter."
        />
      </MissionLayout>
    );
  }

  if (!normalizedAssetId) {
    return (
      <MissionLayout activeSection="asset-workbench" contextScanId={resolvedScanId} header={header}>
        <EmptyRouteState
          eyebrow="Invalid asset reference"
          title="This asset route needs a valid asset ID"
          description="The supplied asset identifier is malformed, so the workbench is refusing to issue any artifact requests."
          actionHref={buildScanHref("/assets", resolvedScanId)}
          actionLabel="Return to asset catalog"
        />
      </MissionLayout>
    );
  }

  if (isLoading && !results) {
    return (
      <MissionLayout activeSection="asset-workbench" contextScanId={resolvedScanId} header={header}>
        <LoadingRouteState
          eyebrow="Asset workbench"
          title="Loading scan and asset context"
          description="Stale asset data stays hidden until the latest scan payload confirms this asset belongs to the active scan."
        />
      </MissionLayout>
    );
  }

  if (error) {
    return (
      <MissionLayout activeSection="asset-workbench" contextScanId={results?.scan_id ?? resolvedScanId} header={header}>
        <ErrorRouteState
          eyebrow="Scan results unavailable"
          title="The workbench could not load the active scan"
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
      <MissionLayout activeSection="asset-workbench" contextScanId={results?.scan_id ?? resolvedScanId} header={header}>
        <EmptyRouteState
          eyebrow="Scan still running"
          title="Asset deep-dive opens after results compilation"
          description="Mission Control remains the right place while the scan is still discovering, assessing, and persisting assets."
          actionHref="/"
          actionLabel="Back to Mission Control"
        />
      </MissionLayout>
    );
  }

  if (!asset) {
    return (
      <MissionLayout activeSection="asset-workbench" header={header}>
        <ErrorRouteState
          eyebrow="Invalid asset for this scan"
          title="This asset does not belong to the active scan"
          description="The workbench validated the compiled scan payload and could not find the requested asset under the current scan ID."
          actionHref={buildScanHref("/assets", results.scan_id)}
          actionLabel="Return to asset catalog"
        />
      </MissionLayout>
    );
  }

  const tier = getAssetTier(asset);
  const hndlTimeline = remediation.data?.hndl_timeline ?? null;
  const hndlEntries = Array.isArray(hndlTimeline?.entries) ? hndlTimeline.entries : [];
  const citations = Array.isArray(remediation.data?.source_citations?.documents)
    ? remediation.data?.source_citations?.documents
    : [];

  return (
    <MissionLayout activeSection="asset-workbench" header={header}>
      <div className="space-y-5">
        <div className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="telemetry-panel overflow-hidden rounded-[28px] border border-white/8 bg-card/90 p-5 shadow-command">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
                  Active asset
                </p>
                <h3 className="mt-3 text-3xl font-semibold text-foreground">
                  {getAssetLabel(asset)}
                </h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {getAssetLocation(asset)} · {asset.server_software ?? "Unknown server"} ·{" "}
                  {asset.service_type ?? "Unknown service"}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant={getTierVariant(tier)}>
                  {tier ? formatTitleCase(tier) : "No tier"}
                </Badge>
                <Badge variant="outline">
                  {asset.assessment?.tls_version ?? "TLS unknown"}
                </Badge>
              </div>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <MetricCard
                label="Risk score"
                value={
                  typeof asset.assessment?.risk_score === "number"
                    ? asset.assessment.risk_score.toFixed(1)
                    : "Unavailable"
                }
              />
              <MetricCard
                label="Cipher suite"
                value={asset.assessment?.cipher_suite ?? "Unavailable"}
              />
              <MetricCard
                label="Certificate"
                value={asset.certificate?.signing_algorithm ?? "Unavailable"}
                hint={
                  asset.certificate
                    ? `${formatTimestamp(asset.certificate.valid_from)} → ${formatTimestamp(
                        asset.certificate.valid_until
                      )}`
                    : "No certificate metadata in compiled scan"
                }
              />
              <MetricCard
                label="Remediation"
                value={asset.remediation ? "Available" : "Unavailable"}
                hint={
                  hndlTimeline?.urgency
                    ? `Urgency ${String(hndlTimeline.urgency)}`
                    : "No remediation urgency available"
                }
              />
            </div>
          </div>

          <div className="space-y-5">
            <DegradedModePanel
              degradedModes={results.degraded_modes.filter((message) =>
                message.includes(getAssetLabel(asset)) || message.includes(String(asset.port))
              )}
            />
            <div className="rounded-[24px] border border-white/8 bg-black/15 p-5">
              <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
                Navigation
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <Button asChild variant="outline" className="rounded-full px-5">
                  <Link href={buildScanHref("/assets", results.scan_id)}>Asset catalog</Link>
                </Button>
                <Button asChild variant="ghost" className="rounded-full px-5">
                  <Link href={buildScanHref("/risk-heatmap", results.scan_id)}>
                    Back to heatmap
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <TabButton
            label="CBOM"
            icon={FileJson2}
            active={activeTab === "cbom"}
            onClick={() => setActiveTab("cbom")}
          />
          <TabButton
            label="Certificate"
            icon={FileBadge2}
            active={activeTab === "certificate"}
            onClick={() => setActiveTab("certificate")}
          />
          <TabButton
            label="HNDL & Remediation"
            icon={ShieldCheck}
            active={activeTab === "remediation"}
            onClick={() => setActiveTab("remediation")}
          />
        </div>

        {activeTab === "cbom" ? (
          <div className="telemetry-panel overflow-hidden rounded-[28px] border border-white/8 bg-card/90 p-5 shadow-command">
            <div className="mb-5 flex items-start justify-between gap-3">
              <div>
                <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
                  CBOM viewer
                </p>
                <h3 className="mt-3 text-2xl font-semibold text-foreground">
                  Cryptographic bill of materials
                </h3>
              </div>
              <Button variant="outline" size="sm" className="rounded-full px-4" onClick={() => void retryArtifacts()}>
                Reload artifacts
              </Button>
            </div>

            {cbom.status === "ready" && cbom.data ? (
              <div className="space-y-5">
                <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
                  <MetricCard label="Serial" value={cbom.data.serial_number} />
                  <MetricCard label="Generated" value={formatTimestamp(cbom.data.created_at)} />
                  <MetricCard
                    label="Risk score"
                    value={String((cbom.data.cbom_json.quantumRiskSummary as Record<string, unknown> | undefined)?.overallScore ?? "Unavailable")}
                  />
                  <MetricCard
                    label="Tier"
                    value={String((cbom.data.cbom_json.quantumRiskSummary as Record<string, unknown> | undefined)?.tier ?? "Unavailable")}
                  />
                </div>
                <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
                  <StructuredCbomPanel cbom={cbom.data} />
                  <div className="space-y-4">
                    <div className="rounded-[24px] border border-white/8 bg-black/15 p-4">
                      <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
                        Raw JSON tree
                      </p>
                      <div className="mt-4">
                        <JsonTreeViewer value={cbom.data.cbom_json} />
                      </div>
                    </div>
                    <div className="rounded-[24px] border border-white/8 bg-black/15 p-4">
                      <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
                        Full JSON
                      </p>
                      <pre className="mt-4 max-h-[26rem] overflow-auto rounded-[20px] border border-white/8 bg-black/25 p-4 text-xs leading-6 text-muted-foreground">
                        {JSON.stringify(cbom.data.cbom_json, null, 2)}
                      </pre>
                    </div>
                  </div>
                </div>
              </div>
            ) : cbom.status === "loading" ? (
              <LoadingRouteState
                eyebrow="CBOM"
                title="Loading CBOM artifact"
                description="The workbench is waiting for the latest persisted CBOM document for this asset."
              />
            ) : (
              <ArtifactStateCard
                title={cbom.status === "missing" ? "CBOM not available" : "CBOM unavailable"}
                description={cbom.message ?? "The CBOM artifact could not be rendered for this asset."}
                onRetry={retryArtifacts}
              />
            )}
          </div>
        ) : null}

        {activeTab === "certificate" ? (
          <div className="telemetry-panel overflow-hidden rounded-[28px] border border-white/8 bg-card/90 p-5 shadow-command">
            <div className="mb-5 flex items-start justify-between gap-3">
              <div>
                <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
                  Certificate viewer
                </p>
                <h3 className="mt-3 text-2xl font-semibold text-foreground">
                  Compliance certificate and extensions
                </h3>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" className="rounded-full px-4" onClick={() => void retryArtifacts()}>
                  Reload artifacts
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="rounded-full px-4"
                  onClick={() => void handleCopyPem()}
                  disabled={!certificate.data?.certificate_pem}
                >
                  <ClipboardCopy className="h-4 w-4" />
                  {copyState === "copied" ? "Copied" : copyState === "failed" ? "Copy failed" : "Copy PEM"}
                </Button>
              </div>
            </div>

            {certificate.status === "ready" && certificate.data ? (
              <div className="space-y-5">
                <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
                  <MetricCard label="Tier" value={formatTitleCase(certificate.data.tier)} />
                  <MetricCard label="Signing algorithm" value={certificate.data.signing_algorithm} />
                  <MetricCard label="Valid from" value={formatTimestamp(certificate.data.valid_from)} />
                  <MetricCard label="Valid until" value={formatTimestamp(certificate.data.valid_until)} />
                </div>
                <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
                  <div className="rounded-[24px] border border-white/8 bg-black/15 p-5">
                    <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
                      Extension payload
                    </p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {Object.entries(certificate.data.extensions_json ?? {}).map(([key, value]) => (
                        <Badge key={key} variant="outline" className="max-w-full whitespace-normal px-3 py-1.5 text-left">
                          {key}: {typeof value === "string" ? value : JSON.stringify(value)}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div className="rounded-[24px] border border-white/8 bg-black/15 p-4">
                    <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
                      PEM payload
                    </p>
                    <pre className="mt-4 max-h-[30rem] overflow-auto rounded-[20px] border border-white/8 bg-black/25 p-4 text-xs leading-6 text-muted-foreground">
                      {certificate.data.certificate_pem ?? "Certificate PEM unavailable."}
                    </pre>
                  </div>
                </div>
              </div>
            ) : certificate.status === "loading" ? (
              <LoadingRouteState
                eyebrow="Certificate"
                title="Loading certificate artifact"
                description="The workbench is requesting the latest persisted compliance certificate for this asset."
              />
            ) : (
              <ArtifactStateCard
                title={certificate.status === "missing" ? "Certificate not available" : "Certificate unavailable"}
                description={certificate.message ?? "The certificate artifact could not be rendered for this asset."}
                onRetry={retryArtifacts}
              />
            )}
          </div>
        ) : null}

        {activeTab === "remediation" ? (
          <div className="telemetry-panel overflow-hidden rounded-[28px] border border-white/8 bg-card/90 p-5 shadow-command">
            <div className="mb-5 flex items-start justify-between gap-3">
              <div>
                <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
                  HNDL & remediation
                </p>
                <h3 className="mt-3 text-2xl font-semibold text-foreground">
                  Timeline, patching, and migration guidance
                </h3>
              </div>
              <Button variant="outline" size="sm" className="rounded-full px-4" onClick={() => void retryArtifacts()}>
                Reload artifacts
              </Button>
            </div>

            {remediation.status === "ready" && remediation.data ? (
              <div className="space-y-5">
                <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
                  <MetricCard label="Urgency" value={String(hndlTimeline?.urgency ?? "Unavailable")} />
                  <MetricCard
                    label="Most urgent algorithm"
                    value={String(hndlTimeline?.mostUrgentAlgorithm ?? "Unavailable")}
                  />
                  <MetricCard label="Generated" value={formatTimestamp(remediation.data.created_at)} />
                  <MetricCard label="Citations" value={String(citations.length)} />
                </div>
                <div className="grid gap-5 xl:grid-cols-[0.8fr_1.2fr]">
                  <div className="space-y-5">
                    <div className="rounded-[24px] border border-white/8 bg-black/15 p-5">
                      <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
                        HNDL timeline
                      </p>
                      {hndlEntries.length ? (
                        <div className="mt-4 space-y-3">
                          {hndlEntries.map((entry, index) => (
                            <div
                              key={`${String(entry.algorithm)}-${index}`}
                              className="rounded-[20px] border border-white/8 bg-white/[0.03] p-4"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <p className="text-base font-semibold text-foreground">
                                    {String(entry.algorithm ?? "Unknown algorithm")}
                                  </p>
                                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                                    Break year {String(entry.breakYear ?? "Unavailable")} · {String(entry.logicalQubits ?? "Unknown")} logical qubits
                                  </p>
                                </div>
                                <Badge variant="outline">{String(entry.source ?? "Citation")}</Badge>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <ArtifactStateCard
                          title="No HNDL entries"
                          description="The remediation bundle did not include a structured HNDL entry list."
                        />
                      )}
                    </div>
                    <div className="rounded-[24px] border border-white/8 bg-black/15 p-5">
                      <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
                        Source citations
                      </p>
                      {citations.length ? (
                        <div className="mt-4 space-y-3">
                          {citations.map((citation, index) => (
                            <div
                              key={`${String(citation.title ?? "citation")}-${index}`}
                              className="rounded-[20px] border border-white/8 bg-white/[0.03] p-4"
                            >
                              <p className="text-sm font-semibold text-foreground">
                                {String(citation.title ?? "Untitled source")}
                              </p>
                              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                                {String(citation.section ?? "Section unavailable")}
                              </p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <ArtifactStateCard
                          title="No citations available"
                          description="The remediation bundle did not include structured source citations."
                        />
                      )}
                    </div>
                  </div>
                  <div className="space-y-5">
                    <div className="rounded-[24px] border border-white/8 bg-black/15 p-4">
                      <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
                        Patch configuration
                      </p>
                      <pre className="mt-4 max-h-[18rem] overflow-auto rounded-[20px] border border-white/8 bg-black/25 p-4 text-xs leading-6 text-muted-foreground">
                        {remediation.data.patch_config ?? "Patch configuration unavailable."}
                      </pre>
                    </div>
                    <div className="rounded-[24px] border border-white/8 bg-black/15 p-4">
                      <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
                        Migration roadmap
                      </p>
                      <pre className="mt-4 max-h-[22rem] overflow-auto whitespace-pre-wrap rounded-[20px] border border-white/8 bg-black/25 p-4 text-sm leading-7 text-muted-foreground">
                        {remediation.data.migration_roadmap ?? "Migration roadmap unavailable."}
                      </pre>
                    </div>
                  </div>
                </div>
              </div>
            ) : remediation.status === "loading" ? (
              <LoadingRouteState
                eyebrow="Remediation"
                title="Loading remediation artifact"
                description="The workbench is retrieving the latest remediation bundle for this asset."
              />
            ) : (
              <ArtifactStateCard
                title={remediation.status === "missing" ? "Remediation not available" : "Remediation unavailable"}
                description={remediation.message ?? "The remediation artifact could not be rendered for this asset."}
                onRetry={retryArtifacts}
              />
            )}
          </div>
        ) : null}

        <EventFeedPanel events={results.events} />
      </div>
    </MissionLayout>
  );
}

function TabButton({
  label,
  icon: Icon,
  active,
  onClick,
}: {
  label: string;
  icon: typeof FileText;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <Button variant={active ? "default" : "outline"} className="rounded-full px-5" onClick={onClick}>
      <Icon className="h-4 w-4" />
      {label}
    </Button>
  );
}

function StructuredCbomPanel({ cbom }: { cbom: CbomResponse }) {
  const component =
    Array.isArray(cbom.cbom_json.components) &&
    cbom.cbom_json.components.length > 0 &&
    typeof cbom.cbom_json.components[0] === "object"
      ? (cbom.cbom_json.components[0] as Record<string, unknown>)
      : null;
  const cryptoProperties =
    component && typeof component.cryptoProperties === "object"
      ? (component.cryptoProperties as Record<string, unknown>)
      : null;
  const quantumRiskSummary =
    typeof cbom.cbom_json.quantumRiskSummary === "object"
      ? (cbom.cbom_json.quantumRiskSummary as Record<string, unknown>)
      : null;

  return (
    <div className="space-y-5">
      <div className="rounded-[24px] border border-white/8 bg-black/15 p-5">
        <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
          Crypto properties
        </p>
        <pre className="mt-4 whitespace-pre-wrap rounded-[20px] border border-white/8 bg-black/25 p-4 text-sm leading-7 text-muted-foreground">
          {JSON.stringify(cryptoProperties, null, 2)}
        </pre>
      </div>
      <div className="rounded-[24px] border border-white/8 bg-black/15 p-5">
        <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
          Quantum risk summary
        </p>
        <pre className="mt-4 whitespace-pre-wrap rounded-[20px] border border-white/8 bg-black/25 p-4 text-sm leading-7 text-muted-foreground">
          {JSON.stringify(quantumRiskSummary, null, 2)}
        </pre>
      </div>
    </div>
  );
}
