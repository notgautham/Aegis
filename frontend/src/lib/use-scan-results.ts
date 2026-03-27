"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { getScanResults, type ScanResultsResponse } from "@/lib/api";
import { getErrorMessage, isAbortError } from "@/lib/api-helpers";
import { persistScanState } from "@/lib/scan-storage";
import { useResolvedScan } from "@/lib/use-resolved-scan";

interface UseScanResultsOptions {
  initialScanParam?: string | null;
}

interface UseScanResultsState {
  isHydrated: boolean;
  resolvedScanId: string | null;
  invalidQueryParam: boolean;
  isLoading: boolean;
  error: string | null;
  results: ScanResultsResponse | null;
  retry: () => Promise<void>;
}

export function useScanResults({
  initialScanParam,
}: UseScanResultsOptions): UseScanResultsState {
  const { isHydrated, resolvedScanId, invalidQueryParam } =
    useResolvedScan(initialScanParam);
  const [results, setResults] = useState<ScanResultsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const requestTokenRef = useRef(0);
  const currentControllerRef = useRef<AbortController | null>(null);

  const loadResults = useCallback(async () => {
    if (!resolvedScanId) {
      setResults(null);
      setError(null);
      setIsLoading(false);
      return;
    }

    currentControllerRef.current?.abort();
    const controller = new AbortController();
    currentControllerRef.current = controller;
    const requestToken = requestTokenRef.current + 1;
    requestTokenRef.current = requestToken;
    setIsLoading(true);
    setError(null);

    try {
      const response = await getScanResults(resolvedScanId, {
        signal: controller.signal,
      });
      if (requestTokenRef.current !== requestToken) {
        return;
      }

      setResults(response);
      persistScanState({ scanId: response.scan_id, target: response.target });
    } catch (error) {
      if (isAbortError(error) || requestTokenRef.current !== requestToken) {
        return;
      }

      setResults(null);
      setError(
        getErrorMessage(
          error,
          "Unable to load scan results right now. Check connectivity and retry."
        )
      );
    } finally {
      if (requestTokenRef.current === requestToken) {
        setIsLoading(false);
      }
    }
  }, [resolvedScanId]);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    if (!resolvedScanId) {
      currentControllerRef.current?.abort();
      setResults(null);
      setError(null);
      setIsLoading(false);
      return;
    }

    void loadResults();

    return () => {
      currentControllerRef.current?.abort();
    };
  }, [isHydrated, loadResults, resolvedScanId]);

  return {
    isHydrated,
    resolvedScanId,
    invalidQueryParam,
    isLoading,
    error,
    results,
    retry: loadResults,
  };
}
