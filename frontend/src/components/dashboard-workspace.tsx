"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { AppHeader } from "@/components/app-header";
import { MissionLayout } from "@/components/mission-layout";
import { NewScanCard } from "@/components/new-scan-card";
import { ScanStatusCard } from "@/components/scan-status-card";
import {
  ApiError,
  createScan,
  getScanStatus,
  type ScanStatusResponse,
} from "@/lib/api";
import { persistScanState, loadPersistedScanState } from "@/lib/scan-storage";
import { useBackendHealth } from "@/lib/use-backend-health";

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

  const pollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeScanIdRef = useRef<string | null>(null);
  const latestRequestTokenRef = useRef(0);
  const backoffRef = useRef(BASE_POLL_INTERVAL_MS);
  const healthState = useBackendHealth();

  const activeTarget = activeScan?.target ?? null;
  const activeStatus = activeScan?.status ?? null;
  const isPolling = pollingState === "polling" || pollingState === "retrying";

  const canPoll =
    activeScan?.scan_id &&
    (activeScan.status === "pending" || activeScan.status === "running");

  const clearPollTimer = () => {
    if (pollTimeoutRef.current) {
      clearTimeout(pollTimeoutRef.current);
      pollTimeoutRef.current = null;
    }
  };

  const refreshScan = useCallback(async (
    scanId: string,
    options?: { preserveRetryState?: boolean }
  ) => {
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
      backoffRef.current = Math.min(
        backoffRef.current * 2,
        MAX_POLL_INTERVAL_MS
      );
      pollTimeoutRef.current = setTimeout(() => {
        void refreshScan(scanId, { preserveRetryState: true });
      }, backoffRef.current);
    }
  }, []);

  useEffect(() => {
    setIsHydrated(true);
    activeScanIdRef.current = null;

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
  }, [refreshScan]);

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

  const handleSubmit = async () => {
    const normalized = inputValue.trim();
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
  };

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

  return (
    <MissionLayout
      activeSection="scan-control"
      contextScanId={activeScan?.scan_id ?? null}
      header={
        <AppHeader
          healthState={healthState}
          activeTarget={activeTarget}
          activeStatus={shellStatus}
          activeStage={activeScan?.stage ?? null}
          elapsedSeconds={activeScan?.elapsed_seconds ?? null}
          summary={activeScan?.summary ?? null}
          degradedModeCount={activeScan?.degraded_modes.length ?? 0}
          eyebrow="Mission Control"
          title="Scan orchestration dashboard"
          description="Live command surface for discovery, compliance posture, remediation generation, and certificate issuance across one trustworthy scan."
          telemetryNote="The command center keeps one active scan honest while the richer Phase 10 surfaces branch out into dedicated routes."
        />
      }
    >
      <div className="grid gap-5 xl:grid-cols-[1.05fr_1.25fr]">
        <NewScanCard
          value={inputValue}
          onValueChange={setInputValue}
          onSubmit={handleSubmit}
          isSubmitting={isSubmitting}
          error={formError}
        />
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
    </MissionLayout>
  );
}
