"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { getScanHistory, type ScanHistoryResponse } from "@/lib/api";
import { getErrorMessage, isAbortError } from "@/lib/api-helpers";

interface UseScanHistoryOptions {
  target?: string | null;
  enabled?: boolean;
}

interface UseScanHistoryState {
  history: ScanHistoryResponse | null;
  isLoading: boolean;
  error: string | null;
  retry: () => Promise<void>;
}

export function useScanHistory({
  target = null,
  enabled = true,
}: UseScanHistoryOptions = {}): UseScanHistoryState {
  const [history, setHistory] = useState<ScanHistoryResponse | null>(null);
  const [isLoading, setIsLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);

  const requestTokenRef = useRef(0);
  const controllerRef = useRef<AbortController | null>(null);

  const loadHistory = useCallback(async () => {
    if (!enabled) {
      setHistory(null);
      setError(null);
      setIsLoading(false);
      return;
    }

    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    const token = requestTokenRef.current + 1;
    requestTokenRef.current = token;

    setIsLoading(true);
    setError(null);

    try {
      const response = await getScanHistory({
        signal: controller.signal,
        target,
      });
      if (requestTokenRef.current !== token) {
        return;
      }
      setHistory(response);
    } catch (error) {
      if (isAbortError(error) || requestTokenRef.current !== token) {
        return;
      }
      setHistory(null);
      setError(
        getErrorMessage(
          error,
          "Recent scan history could not be loaded right now."
        )
      );
    } finally {
      if (requestTokenRef.current === token) {
        setIsLoading(false);
      }
    }
  }, [enabled, target]);

  useEffect(() => {
    void loadHistory();

    return () => {
      controllerRef.current?.abort();
    };
  }, [loadHistory]);

  return {
    history,
    isLoading,
    error,
    retry: loadHistory,
  };
}
