"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  getMissionControlOverview,
  type MissionControlOverviewResponse,
} from "@/lib/api";
import { getErrorMessage, isAbortError } from "@/lib/api-helpers";

interface UseMissionControlOverviewState {
  overview: MissionControlOverviewResponse | null;
  isLoading: boolean;
  error: string | null;
  retry: () => Promise<void>;
}

export function useMissionControlOverview(): UseMissionControlOverviewState {
  const [overview, setOverview] = useState<MissionControlOverviewResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const requestTokenRef = useRef(0);
  const controllerRef = useRef<AbortController | null>(null);

  const loadOverview = useCallback(async () => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    const token = requestTokenRef.current + 1;
    requestTokenRef.current = token;

    setIsLoading(true);
    setError(null);

    try {
      const response = await getMissionControlOverview({ signal: controller.signal });
      if (requestTokenRef.current !== token) {
        return;
      }
      setOverview(response);
    } catch (error) {
      if (isAbortError(error) || requestTokenRef.current !== token) {
        return;
      }
      setOverview(null);
      setError(
        getErrorMessage(
          error,
          "Mission Control could not load the latest portfolio overview."
        )
      );
    } finally {
      if (requestTokenRef.current === token) {
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    void loadOverview();

    return () => {
      controllerRef.current?.abort();
    };
  }, [loadOverview]);

  return {
    overview,
    isLoading,
    error,
    retry: loadOverview,
  };
}
