"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Copy,
  Download,
  FileBadge2,
  FileJson2,
  FileText,
  Network,
  ShieldCheck,
  ShieldAlert,
  ShieldEllipsis,
  UserRound,
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
import { formatDuration, formatStage, formatTimestamp, formatTitleCase } from "@/lib/formatters";
import {
  findAssetInResults,
  getActionPriorityLabel,
  getAssetLabel,
  getAssetLocation,
  getAssetTier,
  getRecommendedNextAction,
  getRiskReason,
  getTierVariant,
  getUrgencyLabel,
} from "@/lib/result-helpers";
import { buildScanHref, normalizeUuid } from "@/lib/scan-storage";
import { useBackendHealth } from "@/lib/use-backend-health";
import { useScanResults } from "@/lib/use-scan-results";

import { JsonTreeViewer } from "@/components/json-tree-viewer";
import { MissionLayout } from "@/components/mission-layout";
import { MetricCard } from "@/components/metric-card";
import { DegradedModePanel } from "@/components/scan-overview-panels";
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
  initialTabParam,
}: {
  assetId: string;
  initialScanParam?: string | null;
  initialTabParam?: string | null;
}) {
  const router = useRouter();
  const initialTab = normalizeAssetTab(initialTabParam);
  const [activeTab, setActiveTab] = useState<AssetTab>(initialTab);
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
  const assetFileStem =
    asset?.hostname ?? asset?.ip_address ?? normalizedAssetId ?? "asset";

  const header = (
    <header className="fixed left-0 right-0 top-0 z-50 h-14 border-b border-[#00FF41]/10 bg-[#111318]/70 backdrop-blur-xl shadow-[0_1px_10px_rgba(0,255,65,0.05)] lg:pl-[18.5rem]">
      <div className="flex h-full items-center justify-between px-6">
        <div className="flex items-center gap-8">
          <span className="font-[var(--font-display)] text-xl font-bold tracking-tighter text-[#00FF41]">
            AEGIS_OS
          </span>
          <nav className="hidden gap-6 md:flex">
            <span className="font-[var(--font-display)] text-xs font-bold uppercase tracking-[0.2em] text-[#00FF41]">
              HEALTH: {healthState === "healthy" ? "100%" : healthState === "checking" ? "SYNC" : "OFFLINE"}
            </span>
            <span className="font-[var(--font-display)] text-xs uppercase tracking-[0.2em] text-slate-500">
              TARGET: {results?.target ?? "UNBOUND"}
            </span>
            <span className="font-[var(--font-display)] text-xs uppercase tracking-[0.2em] text-slate-500">
              STAGE: {results?.stage ? formatStage(results.stage) : "UNBOUND"}
            </span>
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <button
            type="button"
            className="text-slate-500 transition-all hover:text-[#00FF41]"
            aria-label="Account"
          >
            <UserRound className="h-4 w-4" />
          </button>
        </div>
      </div>
    </header>
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

  const handleDownloadCbom = useCallback(() => {
    if (!cbom.data) {
      return;
    }
    downloadBlob(
      JSON.stringify(cbom.data.cbom_json, null, 2),
      `${assetFileStem}-cbom.json`,
      "application/json"
    );
  }, [assetFileStem, cbom.data]);

  const handleDownloadPem = useCallback(() => {
    if (!certificate.data?.certificate_pem) {
      return;
    }
    downloadBlob(
      certificate.data.certificate_pem,
      `${assetFileStem}-certificate.pem`,
      "application/x-pem-file"
    );
  }, [assetFileStem, certificate.data?.certificate_pem]);

  useEffect(() => {
    if (copyState === "idle") {
      return;
    }

    const timeout = setTimeout(() => setCopyState("idle"), 2000);
    return () => clearTimeout(timeout);
  }, [copyState]);

  if (!isHydrated) {
    return (
      <MissionLayout activeSection="assets" contextScanId={null} header={header}>
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
      <MissionLayout activeSection="assets" contextScanId={resolvedScanId} header={header}>
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
      <MissionLayout activeSection="assets" contextScanId={resolvedScanId} header={header}>
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
      <MissionLayout activeSection="assets" contextScanId={resolvedScanId} header={header}>
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
      <MissionLayout activeSection="assets" contextScanId={resolvedScanId} header={header}>
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
      <MissionLayout activeSection="assets" contextScanId={results?.scan_id ?? resolvedScanId} header={header}>
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
      <MissionLayout activeSection="assets" contextScanId={results?.scan_id ?? resolvedScanId} header={header}>
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
      <MissionLayout activeSection="assets" header={header}>
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
  const recommendedNextAction = getRecommendedNextAction(tier);
  const riskReason = getRiskReason(asset);
  const hndlTimeline = remediation.data?.hndl_timeline ?? null;
  const hndlEntries = Array.isArray(hndlTimeline?.entries) ? hndlTimeline.entries : [];
  const citations = Array.isArray(remediation.data?.source_citations?.documents)
    ? remediation.data?.source_citations?.documents
    : [];
  const assetSpecificDegradedModes = results.degraded_modes.filter(
    (message) =>
      message.includes(getAssetLabel(asset)) ||
      message.includes(asset.hostname ?? "") ||
      message.includes(asset.ip_address ?? "") ||
      message.includes(String(asset.port))
  );
  const riskSignals = [
    riskReason,
    asset.certificate
      ? `Certificate validity is tracked through ${formatTimestamp(asset.certificate.valid_from)} to ${formatTimestamp(asset.certificate.valid_until)}.`
      : "No compliance certificate metadata was persisted for this asset in the compiled scan payload.",
    asset.remediation
      ? "A remediation bundle is available and can be reviewed in the HNDL and remediation section."
      : "No remediation bundle is currently attached to this asset.",
  ];
  const nextSteps = [
    recommendedNextAction,
    asset.certificate
      ? "Review certificate details and confirm whether signing posture matches the required compliance tier."
      : "Issue or inspect certificate evidence after validating the remediation path.",
    remediation.data?.migration_roadmap
      ? "Review the migration roadmap and apply the staged guidance in order."
      : "Use the artifact tabs below to inspect the available evidence before applying operational changes.",
  ];

  return (
    <MissionLayout activeSection="assets" contextScanId={results.scan_id} header={header}>
      <div className="space-y-8 pb-20">
        <header className="mb-8 space-y-4">
          <Link
            href={buildScanHref("/assets", results.scan_id)}
            className="inline-flex w-fit items-center gap-2 group text-slate-400 hover:text-[#00FF41] transition-colors"
          >
            <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
            <span className="font-[var(--font-display)] text-xs font-bold uppercase tracking-[0.15em]">
              Return to Inventory
            </span>
          </Link>
          <div className="mb-6 flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
            <div>
              <div className="mb-1 flex items-center gap-3">
                <Network className="h-5 w-5 text-[#00FF41]" />
                <h1 className="font-[var(--font-display)] text-3xl font-bold tracking-tight text-white">
                  {getAssetLabel(asset)}
                </h1>
              </div>
              <p className="font-[var(--font-display)] text-xs uppercase tracking-[0.18em] text-slate-400">
                {asset.service_type ? formatTitleCase(asset.service_type) : "Unknown service"} | {results.target}
              </p>
            </div>
            <div className="flex items-center gap-4">
              <HeroStatCard
                label="Risk score"
                value={
                  typeof asset.assessment?.risk_score === "number"
                    ? asset.assessment.risk_score.toFixed(1)
                    : "Unavailable"
                }
                tone="danger"
              />
              <HeroStatCard
                label="Posture"
                value={tier ? formatTitleCase(tier) : "Unavailable"}
                tone={tier === "QUANTUM_VULNERABLE" ? "danger" : tier === "PQC_TRANSITIONING" ? "accent" : "default"}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-0.5 overflow-hidden rounded-xl border border-white/10 bg-white/5 md:grid-cols-3 lg:grid-cols-6">
            <SummaryRailTile label="Identity" value={asset.asset_id.slice(0, 12)} />
            <SummaryRailTile label="Port / Protocol" value={`${asset.port} / ${asset.protocol.toUpperCase()}`} />
            <SummaryRailTile label="Service" value={asset.service_type ? formatTitleCase(asset.service_type) : "Unknown"} />
            <SummaryRailTile label="Tier" value={tier ? formatTitleCase(tier) : "Unavailable"} />
            <SummaryRailTile label="Urgency" value={getUrgencyLabel(tier)} tone="danger" />
            <SummaryRailTile label="Action Priority" value={getActionPriorityLabel(tier)} tone="accent" />
          </div>
        </header>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="flex flex-col gap-5 lg:col-span-2">
            <div className="relative overflow-hidden rounded-xl border border-white/10 bg-[#1a1c20]/80 p-6">
              <div className="absolute right-[-4rem] top-[-4rem] h-40 w-40 rounded-full bg-[#c31e00]/10 blur-3xl" />
              <h3 className="mb-4 flex items-center gap-2 font-[var(--font-display)] text-lg font-bold text-white">
                <ShieldAlert className="h-5 w-5 text-[#ffb4a5]" />
                Why is this asset risky?
              </h3>
              <div className="space-y-4">
                {riskSignals.map((signal, index) => (
                  <div key={`${signal}-${index}`} className="flex items-start gap-4">
                    <div className="mt-1 h-2 w-2 rounded-full bg-[#ff4b2b] shadow-[0_0_8px_#ff4b2b]" />
                    <p className="text-sm leading-7 text-[#b9ccb2]">{signal}</p>
                  </div>
                ))}
              </div>
            </div>
            {assetSpecificDegradedModes.length ? (
              <DegradedModePanel degradedModes={assetSpecificDegradedModes} />
            ) : null}
          </div>

          <div className="space-y-5">
            <div className="clip-path-chamfer-tr rounded-xl border border-white/10 bg-[#282a2e]/80 p-6">
              <h3 className="mb-4 flex items-center gap-2 font-[var(--font-display)] text-lg font-bold text-[#00FF41]">
                <ShieldEllipsis className="h-5 w-5" />
                Recommended next steps
              </h3>
              <div className="space-y-3">
                {nextSteps.map((step, index) => (
                  <div key={`${step}-${index}`} className="flex items-start gap-3 rounded-lg border border-white/8 bg-[#0c0e12]/80 p-3">
                    <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-[#00FF41]" />
                    <p className="text-xs uppercase tracking-[0.12em] text-slate-200">{step}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-xl border border-white/10 bg-[#1a1c20]/80 p-5">
              <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-slate-500">
                Navigation
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <Button asChild variant="outline" className="rounded-full px-5">
                  <Link href={buildScanHref("/assets", results.scan_id)}>Asset catalog</Link>
                </Button>
                <Button asChild variant="ghost" className="rounded-full px-5">
                  <Link href={buildScanHref("/risk-heatmap", results.scan_id)}>Back to heatmap</Link>
                </Button>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <CompactInfoTile label="TLS" value={asset.assessment?.tls_version ?? "Unavailable"} />
                <CompactInfoTile label="Runtime" value={formatDuration(results.elapsed_seconds)} />
              </div>
            </div>
          </div>
        </div>

        <div className="hidden">
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
                hint={`${getUrgencyLabel(tier)} | ${getActionPriorityLabel(tier)}`}
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
            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              <div className="rounded-[24px] border border-white/8 bg-black/15 p-4">
                <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
                  Why this asset is risky
                </p>
                <p className="mt-3 text-sm leading-7 text-muted-foreground">{riskReason}</p>
              </div>
              <div className="rounded-[24px] border border-white/8 bg-black/15 p-4">
                <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
                  Recommended next action
                </p>
                <p className="mt-3 text-sm leading-7 text-muted-foreground">
                  {recommendedNextAction}
                </p>
              </div>
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

        </div>

        <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0c0e12]/80">
          <div className="flex flex-wrap border-b border-white/10 bg-[#1a1c20]/50">
          <TabButton
            label="CBOM"
            icon={FileJson2}
            active={activeTab === "cbom"}
            onClick={() => {
              setActiveTab("cbom");
              updateAssetTab(
                router,
                assetId,
                results?.scan_id ?? resolvedScanId ?? initialScanParam ?? null,
                "cbom"
              );
            }}
          />
          <TabButton
            label="Certificate"
            icon={FileBadge2}
            active={activeTab === "certificate"}
            onClick={() => {
              setActiveTab("certificate");
              updateAssetTab(
                router,
                assetId,
                results?.scan_id ?? resolvedScanId ?? initialScanParam ?? null,
                "certificate"
              );
            }}
          />
          <TabButton
            label="HNDL & Remediation"
            icon={ShieldCheck}
            active={activeTab === "remediation"}
            onClick={() => {
              setActiveTab("remediation");
              updateAssetTab(
                router,
                assetId,
                results?.scan_id ?? resolvedScanId ?? initialScanParam ?? null,
                "remediation"
              );
            }}
          />
          </div>
        </div>

        {activeTab === "cbom" ? (
          <div className="overflow-hidden rounded-xl border border-white/10 bg-[#1a1c20]/80 p-6 shadow-lg">
              <div className="mb-6 flex items-start justify-between gap-3">
                <div>
                <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-slate-500">
                  CBOM viewer
                </p>
                <h3 className="mt-2 font-[var(--font-display)] text-2xl font-bold text-white">
                  Cryptographic bill of materials
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
                  onClick={handleDownloadCbom}
                  disabled={!cbom.data}
                >
                  Download JSON
                </Button>
              </div>
            </div>

            {cbom.status === "ready" && cbom.data ? (
              <div className="space-y-5">
                <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
                  <ArtifactMiniTile label="Serial" value={cbom.data.serial_number} />
                  <ArtifactMiniTile label="Generated" value={formatTimestamp(cbom.data.created_at)} />
                  <ArtifactMiniTile
                    label="Risk score"
                    value={String((cbom.data.cbom_json.quantumRiskSummary as Record<string, unknown> | undefined)?.overallScore ?? "Unavailable")}
                  />
                  <ArtifactMiniTile
                    label="Tier"
                    value={String((cbom.data.cbom_json.quantumRiskSummary as Record<string, unknown> | undefined)?.tier ?? "Unavailable")}
                  />
                </div>
                <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
                  <StructuredCbomPanel cbom={cbom.data} />
                  <div className="space-y-4">
                    <div className="rounded-lg border border-white/10 bg-[#0c0e12]/80 p-5">
                      <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-slate-500">
                        Raw JSON tree
                      </p>
                      <div className="mt-4">
                        <JsonTreeViewer value={cbom.data.cbom_json} />
                      </div>
                    </div>
                    <div className="rounded-lg border border-white/10 bg-[#0c0e12]/80 p-5">
                      <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-slate-500">
                        Full JSON
                      </p>
                      <pre className="mt-4 max-h-[26rem] overflow-auto rounded-md border border-white/5 bg-[#1a1c20] p-4 text-xs leading-6 text-slate-300">
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
          <div className="overflow-hidden rounded-xl border border-white/10 bg-[#1a1c20]/80 p-6 shadow-lg">
            <div className="mb-6 flex items-start justify-between gap-3">
              <div>
                <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-slate-500">
                  Certificate viewer
                </p>
                <h3 className="mt-2 font-[var(--font-display)] text-2xl font-bold text-white">
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
                  <Copy className="h-4 w-4" />
                  {copyState === "copied" ? "Copied" : copyState === "failed" ? "Copy failed" : "Copy PEM"}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="rounded-full px-4"
                  onClick={handleDownloadPem}
                  disabled={!certificate.data?.certificate_pem}
                >
                  Download PEM
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
                  <div className="rounded-lg border border-white/10 bg-[#0c0e12]/80 p-5">
                    <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-slate-500">
                      Extension payload
                    </p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {Object.entries(certificate.data.extensions_json ?? {}).map(([key, value]) => (
                        <Badge key={key} variant="outline" className="max-w-full whitespace-normal px-3 py-1.5 text-left bg-[#1e2024] border-white/10 text-white">
                          {key}: {typeof value === "string" ? value : JSON.stringify(value)}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div className="rounded-lg border border-white/10 bg-[#0c0e12]/80 p-5">
                    <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-slate-500">
                      PEM payload
                    </p>
                    <pre className="mt-4 max-h-[30rem] overflow-auto rounded-md border border-white/5 bg-[#1a1c20] p-4 text-xs leading-6 text-slate-300">
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
          <div className="overflow-hidden rounded-xl border border-white/10 bg-[#1a1c20]/80 p-6 shadow-lg">
            <div className="mb-6 flex items-start justify-between gap-3">
              <div>
                <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-slate-500">
                  HNDL & remediation
                </p>
                <h3 className="mt-2 font-[var(--font-display)] text-2xl font-bold text-white">
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
                    <div className="rounded-lg border border-white/10 bg-[#0c0e12]/80 p-5">
                      <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-slate-500">
                        HNDL timeline
                      </p>
                      {hndlEntries.length ? (
                        <div className="mt-4 space-y-3">
                          {hndlEntries.map((entry, index) => (
                            <div
                              key={`${String(entry.algorithm)}-${index}`}
                              className="rounded-md border border-white/10 bg-[#1e2024] p-4"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <p className="text-sm font-medium text-white">
                                    {String(entry.algorithm ?? "Unknown algorithm")}
                                  </p>
                                  <p className="mt-1 text-xs leading-6 text-slate-400">
                                    Break year {String(entry.breakYear ?? "Unavailable")} · {String(entry.logicalQubits ?? "Unknown")} logical qubits
                                  </p>
                                </div>
                                <Badge variant="outline" className="bg-[#1a1c20] border-white/10 text-white">{String(entry.source ?? "Citation")}</Badge>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="mt-4">
                          <ArtifactStateCard
                            title="No HNDL entries"
                            description="The remediation bundle did not include a structured HNDL entry list."
                          />
                        </div>
                      )}
                    </div>
                    <div className="rounded-lg border border-white/10 bg-[#0c0e12]/80 p-5">
                      <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-slate-500">
                        Source citations
                      </p>
                      {citations.length ? (
                        <div className="mt-4 space-y-3">
                          {citations.map((citation, index) => (
                            <div
                              key={`${String(citation.title ?? "citation")}-${index}`}
                              className="rounded-md border border-white/10 bg-[#1e2024] p-4"
                            >
                              <p className="text-sm font-medium text-white">
                                {String(citation.title ?? "Untitled source")}
                              </p>
                              <p className="mt-2 text-xs leading-6 text-slate-400">
                                {String(citation.section ?? "Section unavailable")}
                              </p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="mt-4">
                          <ArtifactStateCard
                            title="No citations available"
                            description="The remediation bundle did not include structured source citations."
                          />
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="space-y-5">
                    <div className="rounded-lg border border-white/10 bg-[#0c0e12]/80 p-5">
                      <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-slate-500">
                        Patch configuration
                      </p>
                      <pre className="mt-4 max-h-[18rem] overflow-auto rounded-md border border-white/5 bg-[#1a1c20] p-4 text-xs leading-6 text-slate-300">
                        {remediation.data.patch_config ?? "Patch configuration unavailable."}
                      </pre>
                    </div>
                    <div className="rounded-lg border border-white/10 bg-[#0c0e12]/80 p-5">
                      <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-slate-500">
                        Migration roadmap
                      </p>
                      <pre className="mt-4 max-h-[22rem] overflow-auto whitespace-pre-wrap rounded-md border border-white/5 bg-[#1a1c20] p-4 text-sm leading-7 text-slate-300">
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

        <div className="rounded-xl border border-white/10 bg-[#1a1c20]/80 p-5">
          <div className="flex items-center justify-between">
            <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-slate-500">
              Scan runtime context
            </p>
            <span className="font-[var(--font-display)] text-[10px] uppercase tracking-[0.16em] text-[#00FF41]">
              {formatStage(results.stage)}
            </span>
          </div>
          {results.events.length ? (
            <div className="mt-4 space-y-3">
              {[...results.events].slice(-4).reverse().map((event) => (
                <div key={`${event.timestamp}-${event.message}`} className="rounded-lg border border-white/8 bg-[#0c0e12]/80 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-[var(--font-display)] text-[10px] uppercase tracking-[0.14em] text-slate-400">
                      {formatStage(event.stage)}
                    </span>
                    <span className="font-[var(--font-display)] text-[9px] uppercase text-slate-500">
                      {formatTimestamp(event.timestamp)}
                    </span>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-[#b9ccb2]">{event.message}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-4 text-sm leading-6 text-slate-500">
              No runtime events were persisted for this asset context.
            </p>
          )}
        </div>
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
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-2 px-8 py-4 text-xs font-[var(--font-display)] uppercase tracking-[0.18em] transition-colors ${
        active
          ? "border-b-2 border-[#00FF41] text-[#00FF41]"
          : "text-slate-500 hover:text-white"
      }`}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}

function HeroStatCard({
  label,
  value,
  tone = "default",
}: Readonly<{
  label: string;
  value: string;
  tone?: "default" | "danger" | "accent";
}>) {
  return (
    <div
      className={`rounded-lg border px-4 py-2 text-center ${
        tone === "danger"
          ? "border-[#ffb4a5]/30 bg-[#93000a]/20"
          : tone === "accent"
            ? "border-[#00FF41]/20 bg-[#1e2024]"
            : "border-white/10 bg-[#1e2024]"
      }`}
    >
      <p className="font-[var(--font-display)] text-[10px] uppercase text-slate-400">{label}</p>
      <p
        className={`font-[var(--font-display)] text-2xl font-black ${
          tone === "danger" ? "text-[#ffb4a5]" : tone === "accent" ? "text-[#00FF41]" : "text-white"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function SummaryRailTile({
  label,
  value,
  tone = "default",
}: Readonly<{
  label: string;
  value: string;
  tone?: "default" | "danger" | "accent";
}>) {
  return (
    <div className="bg-[#1a1c20] p-4">
      <p className="font-[var(--font-display)] text-[10px] uppercase tracking-[0.16em] text-slate-500">
        {label}
      </p>
      <p
        className={`mt-1 text-sm font-medium ${
          tone === "danger" ? "text-[#ffb4a5]" : tone === "accent" ? "text-[#00FF41]" : "text-white"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function CompactInfoTile({
  label,
  value,
}: Readonly<{
  label: string;
  value: string;
}>) {
  return (
    <div className="rounded-lg border border-white/8 bg-[#0c0e12]/80 p-3">
      <p className="font-[var(--font-display)] text-[10px] uppercase tracking-[0.16em] text-slate-500">
        {label}
      </p>
      <p className="mt-1 text-sm font-medium text-white">{value}</p>
    </div>
  );
}

function ArtifactMiniTile({
  label,
  value,
}: Readonly<{
  label: string;
  value: string;
}>) {
  return (
    <div className="rounded-lg border border-white/10 bg-[#1e2024] p-4">
      <p className="font-[var(--font-display)] text-[10px] uppercase tracking-[0.16em] text-slate-500">
        {label}
      </p>
      <p className="mt-1 font-mono text-sm text-white">{value}</p>
    </div>
  );
}

function normalizeAssetTab(value: string | null | undefined): AssetTab {
  switch (value) {
    case "certificate":
    case "remediation":
      return value;
    default:
      return "cbom";
  }
}

function updateAssetTab(
  router: ReturnType<typeof useRouter>,
  assetId: string,
  scanId: string | null,
  tab: AssetTab
) {
  const nextParams = new URLSearchParams();
  if (scanId) {
    nextParams.set("scan", scanId);
  }
  nextParams.set("tab", tab);
  router.replace(`/assets/${assetId}?${nextParams.toString()}`, { scroll: false });
}

function downloadBlob(contents: string, filename: string, type: string) {
  const blob = new Blob([contents], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
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
      <div className="rounded-lg border border-white/10 bg-[#0c0e12]/80 p-5">
        <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-slate-500">
          Crypto properties
        </p>
        <pre className="mt-4 whitespace-pre-wrap rounded-md border border-white/5 bg-[#1a1c20] p-4 text-sm leading-7 text-slate-300">
          {JSON.stringify(cryptoProperties, null, 2)}
        </pre>
      </div>
      <div className="rounded-lg border border-white/10 bg-[#0c0e12]/80 p-5">
        <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-slate-500">
          Quantum risk summary
        </p>
        <pre className="mt-4 whitespace-pre-wrap rounded-md border border-white/5 bg-[#1a1c20] p-4 text-sm leading-7 text-slate-300">
          {JSON.stringify(quantumRiskSummary, null, 2)}
        </pre>
      </div>
    </div>
  );
}
