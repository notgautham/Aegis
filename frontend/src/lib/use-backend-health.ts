"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { checkHealth } from "@/lib/api";

export type HealthState = "checking" | "healthy" | "offline";

export function useBackendHealth(pollIntervalMs = 15000): HealthState {
  const [healthState, setHealthState] = useState<HealthState>("checking");
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  };

  const runHealthCheck = useCallback(async () => {
    try {
      await checkHealth();
      setHealthState("healthy");
    } catch {
      setHealthState("offline");
    } finally {
      clearTimer();
      timeoutRef.current = setTimeout(runHealthCheck, pollIntervalMs);
    }
  }, [pollIntervalMs]);

  useEffect(() => {
    void runHealthCheck();

    return () => {
      clearTimer();
    };
  }, [runHealthCheck]);

  return healthState;
}
