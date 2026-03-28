export const ACTIVE_SCAN_STORAGE_KEY = "aegis.active-scan";

export interface PersistedScanState {
  scanId: string;
  target: string;
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function normalizeScanId(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  return UUID_PATTERN.test(trimmed) ? trimmed : null;
}

export const normalizeUuid = normalizeScanId;

export function loadPersistedScanState(): PersistedScanState | null {
  if (typeof window === "undefined") {
    return null;
  }

  const rawValue = window.localStorage.getItem(ACTIVE_SCAN_STORAGE_KEY);
  if (!rawValue) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawValue) as PersistedScanState;
    if (!normalizeScanId(parsed?.scanId) || !parsed?.target?.trim()) {
      window.localStorage.removeItem(ACTIVE_SCAN_STORAGE_KEY);
      return null;
    }

    return {
      scanId: parsed.scanId.trim(),
      target: parsed.target.trim(),
    };
  } catch {
    window.localStorage.removeItem(ACTIVE_SCAN_STORAGE_KEY);
    return null;
  }
}

export function persistScanState(scan: PersistedScanState | null) {
  if (typeof window === "undefined") {
    return;
  }

  if (!scan) {
    window.localStorage.removeItem(ACTIVE_SCAN_STORAGE_KEY);
    return;
  }

  window.localStorage.setItem(
    ACTIVE_SCAN_STORAGE_KEY,
    JSON.stringify({
      scanId: scan.scanId.trim(),
      target: scan.target.trim(),
    })
  );
}

export function buildScanHref(pathname: string, scanId: string | null): string {
  if (!scanId) {
    return pathname;
  }

  return `${pathname}?scan=${scanId}`;
}

export function buildAssetHref(
  assetId: string,
  scanId: string | null,
  tab?: string | null
): string {
  const search = new URLSearchParams();
  if (scanId) {
    search.set("scan", scanId);
  }
  if (tab) {
    search.set("tab", tab);
  }
  const query = search.toString();
  return `/assets/${assetId}${query ? `?${query}` : ""}`;
}
