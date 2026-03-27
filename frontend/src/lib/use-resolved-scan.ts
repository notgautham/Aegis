"use client";

import { useEffect, useMemo, useState } from "react";

import {
  loadPersistedScanState,
  normalizeScanId,
  type PersistedScanState,
} from "@/lib/scan-storage";

interface ResolvedScanState {
  isHydrated: boolean;
  resolvedScanId: string | null;
  rememberedScan: PersistedScanState | null;
  invalidQueryParam: boolean;
}

export function useResolvedScan(initialScanParam?: string | null): ResolvedScanState {
  const [isHydrated, setIsHydrated] = useState(false);
  const [rememberedScan, setRememberedScan] = useState<PersistedScanState | null>(null);

  const normalizedQueryScanId = useMemo(
    () => normalizeScanId(initialScanParam),
    [initialScanParam]
  );

  const invalidQueryParam = Boolean(
    initialScanParam?.trim() && normalizedQueryScanId === null
  );

  useEffect(() => {
    setIsHydrated(true);
    setRememberedScan(loadPersistedScanState());
  }, []);

  const resolvedScanId = normalizedQueryScanId ?? rememberedScan?.scanId ?? null;

  return {
    isHydrated,
    resolvedScanId,
    rememberedScan,
    invalidQueryParam,
  };
}
