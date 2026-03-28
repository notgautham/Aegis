"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Bell, Search, UserRound } from "lucide-react";

import { MissionLayout } from "@/components/mission-layout";
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
import {
  loadPersistedScanState,
  persistScanState,
} from "@/lib/scan-storage";
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
              ACTIVE: {activeTarget ? "01" : "00"}
            </span>
            <span className="font-[var(--font-display)] text-xs uppercase tracking-[0.2em] text-slate-500">
              SAVED TARGETS: {savedTargets.length}
            </span>
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative hidden lg:block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#00FF41]/45" />
            <input
              className="w-52 rounded border border-[#00FF41]/10 bg-white/5 py-1 pl-9 pr-3 font-[var(--font-display)] text-[10px] uppercase tracking-[0.18em] text-[#00FF41] placeholder:text-[#00FF41]/30 focus:outline-none focus:border-[#00FF41]/40"
              placeholder="SEARCH_SYSTEM..."
              type="text"
            />
          </div>
          <button
            type="button"
            className="text-slate-500 transition-all hover:text-[#00FF41]"
            aria-label="Notifications"
          >
            <Bell className="h-4 w-4" />
          </button>
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

  return (
    <MissionLayout
      activeSection="mission-control"
      contextScanId={activeScan?.scan_id ?? resolvedActionScanId}
      header={header}
    >
      <div className="space-y-6">
        <section className="grid grid-cols-1 gap-4 lg:grid-cols-4">
          <div className="relative overflow-hidden rounded-xl border border-white/5 bg-[#1a1c20]/70 p-6 backdrop-blur-2xl lg:col-span-3">
            <div className="relative z-10">
              <h2 className="mb-1 font-[var(--font-display)] text-[10px] uppercase tracking-[0.2em] text-slate-500">
                Portfolio Security Posture
              </h2>
              <div className="flex flex-wrap items-baseline gap-4">
                <span className="font-[var(--font-display)] text-5xl font-bold tracking-tighter text-[#00FF41]">
                  {overview?.portfolio_summary.compliant_assets ?? 0}
                </span>
                <span className="font-[var(--font-display)] text-xs uppercase tracking-[0.18em] text-[#72ff70]">
                  compliant assets in recent scan window
                </span>
              </div>
            </div>
            <div className="absolute bottom-4 right-0 hidden h-16 w-2/3 opacity-40 md:block">
              <svg className="h-full w-full" viewBox="0 0 400 60" fill="none">
                <path
                  d="M0 50 Q 50 45, 100 48 T 200 35 T 300 42 T 400 10"
                  stroke="#00FF41"
                  strokeWidth="2"
                />
              </svg>
            </div>
          </div>
          <div className="flex flex-col items-center justify-center rounded-xl border border-[#c31e00]/20 bg-[#1a1c20]/70 p-6 backdrop-blur-2xl">
            <h2 className="mb-1 font-[var(--font-display)] text-[10px] uppercase tracking-[0.2em] text-[#ffb4a5]">
              Active Threats
            </h2>
            <span className="font-[var(--font-display)] text-5xl font-bold tracking-tighter text-[#ffb4a5]">
              {overview?.portfolio_summary.vulnerable_assets ?? 0}
            </span>
          </div>
        </section>

        {overviewError ? (
          <div className="rounded-xl border border-status-failed/25 bg-status-failed/10 px-4 py-4 text-sm leading-6 text-status-failed">
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
          <div className="rounded-xl border border-white/5 bg-[#1a1c20]/70 px-4 py-4 text-sm leading-6 text-slate-400 backdrop-blur-2xl">
            Loading portfolio summary, recent scans, and priority findings...
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="space-y-6 lg:col-span-8">
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

            <ScanStatusCard
              scan={activeScan}
              isHydrated={isHydrated}
              pollingError={pollingError}
              onManualRefresh={handleManualRefresh}
              onClear={handleClearScan}
            />

            <RecentScansPanel
              scans={overview?.recent_scans ?? []}
            />
          </div>

          <div className="space-y-6 lg:col-span-4">
            <div className="grid grid-cols-2 gap-3">
              <MissionMetricCard label="Running" value={overview?.portfolio_summary.running_scans ?? 0} />
              <MissionMetricCard
                label="Vulnerable"
                value={overview?.portfolio_summary.vulnerable_assets ?? 0}
                danger
              />
              <MissionMetricCard
                label="Compliant"
                value={overview?.portfolio_summary.compliant_assets ?? 0}
                accent
              />
              <MissionMetricCard label="Completed" value={overview?.portfolio_summary.completed_scans ?? 0} />
              <MissionMetricCard label="Certificates" value={overview?.portfolio_summary.certificates_issued ?? 0} />
              <MissionMetricCard label="Remediation" value={overview?.portfolio_summary.remediation_bundles_generated ?? 0} />
            </div>

            <PriorityFindingsPanel findings={overview?.priority_findings ?? []} />

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

            <div className="border-t border-white/5 pt-4">
              <div className="mb-1 flex items-center justify-between">
                <span className="font-[var(--font-display)] text-[9px] uppercase tracking-[0.2em] text-slate-600">
                  SYSTEM_ENTITY_STATUS
                </span>
                <span className="h-2 w-2 rounded-full bg-[#00FF41]" />
              </div>
              <div className="font-mono text-[9px] leading-tight text-slate-700">
                ID: AE-992-K
                <br />
                ENTROPY: 0.00293
                <br />
                SYNC: GLOBAL_MAINFRAME
              </div>
            </div>
          </div>
        </div>
      </div>
    </MissionLayout>
  );
}

function MissionMetricCard({
  label,
  value,
  accent = false,
  danger = false,
}: Readonly<{
  label: string;
  value: number;
  accent?: boolean;
  danger?: boolean;
}>) {
  return (
    <div className="rounded-xl border border-white/5 bg-[#1a1c20]/70 p-4 backdrop-blur-2xl">
      <p
        className={`mb-1 font-[var(--font-display)] text-[9px] uppercase tracking-[0.18em] ${
          danger ? "text-[#ffb4a5]" : "text-slate-500"
        }`}
      >
        {label}
      </p>
      <p
        className={`font-[var(--font-display)] text-xl font-bold ${
          danger ? "text-[#ffb4a5]" : accent ? "text-[#00FF41]" : "text-[#e2e2e8]"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
