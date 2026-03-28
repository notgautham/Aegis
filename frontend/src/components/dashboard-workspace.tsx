"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { AppHeader } from "@/components/app-header";
import { BentoGrid } from "@/components/aceternity/bento-grid";
import { BackgroundGradient } from "@/components/aceternity/background-gradient";
import { Spotlight } from "@/components/aceternity/spotlight";
import { CommandActionsPanel } from "@/components/command-actions-panel";
import { MissionLayout } from "@/components/mission-layout";
import { PostureOverviewStrip, PostureStatusLegend } from "@/components/posture-overview-strip";
import { PriorityFindingsPanel } from "@/components/priority-findings-panel";
import { RecentScansPanel } from "@/components/recent-scans-panel";
import { SavedTargetsPanel } from "@/components/saved-targets-panel";
import { ScanStatusCard } from "@/components/scan-status-card";
import { ScanWorkflowPanel } from "@/components/scan-workflow-panel";
import {
  ApiError,
  createScan,
  getScanStatus,
  type ScanStatusResponse,
} from "@/lib/api";
import {
  buildSavedTarget,
  loadRecentLaunches,
  loadSavedTargets,
  markSavedTargetUsed,
  recordRecentLaunch,
  removeSavedTarget,
  type EnvironmentTag,
  type PriorityTag,
  type RecentLaunchContext,
  type SavedTarget,
  type ScanProfile,
  upsertSavedTarget,
} from "@/lib/mission-control-storage";
import { loadPersistedScanState, persistScanState } from "@/lib/scan-storage";
import { useBackendHealth } from "@/lib/use-backend-health";
import { useMissionControlOverview } from "@/lib/use-mission-control-overview";

const BASE_POLL_INTERVAL_MS = 3000;
const MAX_POLL_INTERVAL_MS = 15000;

type PollingState = "idle" | "polling" | "retrying";

function isProbableTarget(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) {
    return false;
  }

  const domainPattern =
    /^(?=.{1,253}$)(?!-)(?:[a-zA-Z0-9-]{1,63}\.)+[a-zA-Z]{2,63}$/;
  const ipv4Pattern =
    /^(?:\d{1,3}\.){3}\d{1,3}(?:\/(?:[0-9]|[12][0-9]|3[0-2]))?$/;
  const ipv6OrCidrPattern = /^[0-9a-fA-F:]+(?:\/\d{1,3})?$/;

  return (
    domainPattern.test(trimmed) ||
    ipv4Pattern.test(trimmed) ||
    ipv6OrCidrPattern.test(trimmed)
  );
}

export function DashboardWorkspace() {
  const [inputValue, setInputValue] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [activeScan, setActiveScan] = useState<ScanStatusResponse | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);
  const [pollingState, setPollingState] = useState<PollingState>("idle");
  const [pollingError, setPollingError] = useState<string | null>(null);
  const [savedTargets, setSavedTargets] = useState<SavedTarget[]>([]);
  const [recentLaunches, setRecentLaunches] = useState<RecentLaunchContext[]>([]);
  const [profile, setProfile] = useState<ScanProfile>("full_quantum_readiness");
  const [scanNotes, setScanNotes] = useState("");
  const [environmentTag, setEnvironmentTag] = useState<EnvironmentTag | null>(null);
  const [priorityTag, setPriorityTag] = useState<PriorityTag | null>(null);

  const pollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeScanIdRef = useRef<string | null>(null);
  const latestRequestTokenRef = useRef(0);
  const backoffRef = useRef(BASE_POLL_INTERVAL_MS);
  const healthState = useBackendHealth();
  const {
    overview,
    isLoading: overviewLoading,
    error: overviewError,
    retry: retryOverview,
  } = useMissionControlOverview();

  const activeTarget = activeScan?.target ?? null;
  const activeStatus = activeScan?.status ?? null;
  const isPolling = pollingState === "polling" || pollingState === "retrying";
  const canPoll =
    activeScan?.scan_id &&
    (activeScan.status === "pending" || activeScan.status === "running");

  const refreshSavedTargets = useCallback(() => {
    setSavedTargets(loadSavedTargets());
  }, []);

  const refreshRecentLaunches = useCallback(() => {
    setRecentLaunches(loadRecentLaunches());
  }, []);

  const clearPollTimer = () => {
    if (pollTimeoutRef.current) {
      clearTimeout(pollTimeoutRef.current);
      pollTimeoutRef.current = null;
    }
  };

  const refreshScan = useCallback(
    async (scanId: string, options?: { preserveRetryState?: boolean }) => {
      const requestToken = latestRequestTokenRef.current + 1;
      latestRequestTokenRef.current = requestToken;
      setPollingState(options?.preserveRetryState ? "retrying" : "polling");

      try {
        const response = await getScanStatus(scanId);
        if (
          activeScanIdRef.current !== scanId ||
          latestRequestTokenRef.current !== requestToken
        ) {
          return;
        }

        setActiveScan(response);
        setPollingError(null);
        backoffRef.current = BASE_POLL_INTERVAL_MS;

        if (response.status === "completed" || response.status === "failed") {
          clearPollTimer();
          setPollingState("idle");
          persistScanState({ scanId: response.scan_id, target: response.target });
          return;
        }

        clearPollTimer();
        pollTimeoutRef.current = setTimeout(() => {
          void refreshScan(scanId);
        }, BASE_POLL_INTERVAL_MS);
      } catch (error) {
        if (
          activeScanIdRef.current !== scanId ||
          latestRequestTokenRef.current !== requestToken
        ) {
          return;
        }

        const message =
          error instanceof ApiError
            ? error.message
            : "Polling failed temporarily. The dashboard will retry automatically.";
        setPollingError(message);
        setPollingState("retrying");
        clearPollTimer();
        backoffRef.current = Math.min(backoffRef.current * 2, MAX_POLL_INTERVAL_MS);
        pollTimeoutRef.current = setTimeout(() => {
          void refreshScan(scanId, { preserveRetryState: true });
        }, backoffRef.current);
      }
    },
    []
  );

  useEffect(() => {
    setIsHydrated(true);
    activeScanIdRef.current = null;
    refreshSavedTargets();
    refreshRecentLaunches();

    if (typeof window === "undefined") {
      return;
    }

    const parsed = loadPersistedScanState();
    if (!parsed) {
      return;
    }

    activeScanIdRef.current = parsed.scanId;
    setActiveScan({
      scan_id: parsed.scanId,
      target: parsed.target,
      status: "pending",
      created_at: null,
      completed_at: null,
      progress: null,
      summary: null,
      stage: "queued",
      stage_detail: parsed.target,
      stage_started_at: null,
      elapsed_seconds: null,
      events: [],
      degraded_modes: [],
    });
    void refreshScan(parsed.scanId);
  }, [refreshRecentLaunches, refreshSavedTargets, refreshScan]);

  useEffect(() => {
    activeScanIdRef.current = activeScan?.scan_id ?? null;

    if (!activeScan?.scan_id) {
      clearPollTimer();
      setPollingState("idle");
      return;
    }

    persistScanState({
      scanId: activeScan.scan_id,
      target: activeScan.target,
    });

    if (!canPoll) {
      clearPollTimer();
      setPollingState("idle");
    }
  }, [activeScan, canPoll]);

  useEffect(() => {
    if (activeScan?.status === "completed" || activeScan?.status === "failed") {
      void retryOverview();
    }
  }, [activeScan?.scan_id, activeScan?.status, retryOverview]);

  useEffect(() => {
    return () => {
      clearPollTimer();
    };
  }, []);

  const shellStatus = useMemo(() => {
    if (pollingState === "retrying") {
      return "running";
    }
    return activeStatus;
  }, [activeStatus, pollingState]);

  const resolvedActionScanId = useMemo(() => {
    if (activeScan?.status === "completed") {
      return activeScan.scan_id;
    }

    return (
      overview?.recent_scans.find((scan) => scan.status === "completed")?.scan_id ??
      null
    );
  }, [activeScan, overview?.recent_scans]);

  const handleSubmitForTarget = useCallback(
    async (submittedTarget?: string) => {
      const normalized = (submittedTarget ?? inputValue).trim();
      if (isSubmitting) {
        return;
      }

      if (!normalized) {
        setFormError("Enter a domain, IP, or CIDR target.");
        return;
      }

      if (!isProbableTarget(normalized)) {
        setFormError("That target does not look like a valid domain, IP, or CIDR.");
        return;
      }

      setIsSubmitting(true);
      setFormError(null);
      setPollingError(null);
      clearPollTimer();

      try {
        const response = await createScan(normalized);
        const initialScan: ScanStatusResponse = {
          ...response,
          completed_at: null,
          progress: null,
          summary: null,
          stage: "queued",
          stage_detail: response.target,
          stage_started_at: null,
          elapsed_seconds: null,
          events: [],
          degraded_modes: [],
        };
        setActiveScan(initialScan);
        activeScanIdRef.current = response.scan_id;
        persistScanState({ scanId: response.scan_id, target: response.target });
        recordRecentLaunch({
          scan_id: response.scan_id,
          target: response.target,
          target_label:
            savedTargets.find((item) => item.target === response.target)?.label ?? null,
          scan_profile: profile,
          scan_notes: scanNotes.trim() || null,
          environment_tag: environmentTag,
          priority_tag: priorityTag,
          launched_at: new Date().toISOString(),
        });
        const matchingSavedTarget = savedTargets.find(
          (item) => item.target === response.target
        );
        if (matchingSavedTarget) {
          markSavedTargetUsed(matchingSavedTarget.id);
          refreshSavedTargets();
        }
        refreshRecentLaunches();
        await refreshScan(response.scan_id);
      } catch (error) {
        setFormError(
          error instanceof ApiError
            ? error.message
            : "Scan creation failed. Please try again."
        );
      } finally {
        setIsSubmitting(false);
      }
    },
    [
      environmentTag,
      inputValue,
      isSubmitting,
      priorityTag,
      profile,
      refreshRecentLaunches,
      refreshSavedTargets,
      refreshScan,
      savedTargets,
      scanNotes,
    ]
  );

  const handleManualRefresh = async () => {
    if (!activeScanIdRef.current) {
      return;
    }
    clearPollTimer();
    await refreshScan(activeScanIdRef.current);
  };

  const handleClearScan = () => {
    clearPollTimer();
    setActiveScan(null);
    setPollingError(null);
    setPollingState("idle");
    activeScanIdRef.current = null;
    persistScanState(null);
  };

  const handleSelectSavedTarget = (targetId: string) => {
    const selected = savedTargets.find((item) => item.id === targetId);
    if (!selected) {
      return;
    }

    setInputValue(selected.target);
    setEnvironmentTag(selected.environment_tag ?? null);
  };

  const handleSelectSavedTargetObject = (selected: SavedTarget) => {
    setInputValue(selected.target);
    setEnvironmentTag(selected.environment_tag ?? null);
  };

  const handleSaveTarget = (
    target: Omit<SavedTarget, "id" | "last_used_at"> & { id?: string }
  ) => {
    upsertSavedTarget(buildSavedTarget(target));
    refreshSavedTargets();
  };

  const header = (
    <div className="relative overflow-hidden rounded-[30px]">
      <Spotlight />
      <AppHeader
        healthState={healthState}
        activeTarget={activeTarget}
        activeStatus={shellStatus}
        activeStage={activeScan?.stage ?? null}
        elapsedSeconds={activeScan?.elapsed_seconds ?? null}
        summary={activeScan?.summary ?? null}
        degradedModeCount={
          activeScan?.degraded_modes.length ??
          overview?.portfolio_summary.degraded_scan_count ??
          0
        }
        eyebrow="Mission Control"
        title="Quantum readiness command platform"
        description="Portfolio-level scan launch, posture visibility, remediation prioritization, and certificate-readiness evidence for internet-facing banking assets."
        telemetryNote="Mission Control stays scan-centric while adding saved targets, workflow presets, and a stronger banking operations presentation layer."
      />
    </div>
  );

  return (
    <MissionLayout
      activeSection="mission-control"
      contextScanId={activeScan?.scan_id ?? resolvedActionScanId}
      header={header}
    >
      <div className="space-y-5">
        <PostureOverviewStrip summary={overview?.portfolio_summary ?? null} />

        <BackgroundGradient className="px-5 py-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
                Command posture
              </p>
              <h3 className="mt-3 text-xl font-semibold text-foreground">
                Decision-first banking security console
              </h3>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
                Judges should be able to see posture, relaunch known targets, move into risk evidence, and open executive reporting without hunting through passive widgets.
              </p>
            </div>
            <PostureStatusLegend />
          </div>
          {overviewError ? (
            <div className="mt-4 rounded-[22px] border border-status-failed/25 bg-status-failed/10 px-4 py-4 text-sm leading-6 text-status-failed">
              Mission Control overview failed to load: {overviewError}
              <button
                type="button"
                className="ml-2 underline underline-offset-4"
                onClick={() => void retryOverview()}
              >
                Retry overview
              </button>
            </div>
          ) : overviewLoading ? (
            <div className="mt-4 rounded-[22px] border border-white/8 bg-white/[0.03] px-4 py-4 text-sm leading-6 text-muted-foreground">
              Loading portfolio summary, recent scans, and priority findings...
            </div>
          ) : null}
        </BackgroundGradient>

        <BentoGrid>
          <SavedTargetsPanel
            savedTargets={savedTargets}
            recentLaunches={recentLaunches}
            recentScans={overview?.recent_scans ?? []}
            onSelectTarget={handleSelectSavedTargetObject}
            onSaveTarget={handleSaveTarget}
            onDeleteTarget={(targetId) => {
              removeSavedTarget(targetId);
              refreshSavedTargets();
            }}
            onRelaunchTarget={(target) => {
              setInputValue(target);
              void handleSubmitForTarget(target);
            }}
          />

          <div className="space-y-5 xl:col-span-5">
            <ScanWorkflowPanel
              value={inputValue}
              onValueChange={setInputValue}
              onSubmit={() => void handleSubmitForTarget()}
              isSubmitting={isSubmitting}
              error={formError}
              profile={profile}
              onProfileChange={setProfile}
              notes={scanNotes}
              onNotesChange={setScanNotes}
              environmentTag={environmentTag}
              onEnvironmentTagChange={setEnvironmentTag}
              priorityTag={priorityTag}
              onPriorityTagChange={setPriorityTag}
              savedTargets={savedTargets}
              onSavedTargetSelect={handleSelectSavedTarget}
            />
            <CommandActionsPanel
              scanId={resolvedActionScanId}
              priorityFindings={overview?.priority_findings ?? []}
            />
          </div>

          <div className="xl:col-span-3">
            <ScanStatusCard
              scan={activeScan}
              isHydrated={isHydrated}
              isPolling={isPolling}
              pollingState={pollingState}
              pollingError={pollingError}
              onManualRefresh={handleManualRefresh}
              onClear={handleClearScan}
            />
          </div>
        </BentoGrid>

        <BentoGrid>
          <RecentScansPanel
            scans={overview?.recent_scans ?? []}
            onRelaunch={(target) => {
              setInputValue(target);
              void handleSubmitForTarget(target);
            }}
          />
          <div className="space-y-5 xl:col-span-5">
            <PriorityFindingsPanel findings={overview?.priority_findings ?? []} />
          </div>
        </BentoGrid>
      </div>
    </MissionLayout>
  );
}
