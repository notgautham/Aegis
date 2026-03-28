export type ScanProfile =
  | "quick_tls_check"
  | "full_quantum_readiness"
  | "certificate_remediation_pass"
  | "executive_reporting_run";

export type EnvironmentTag = "prod" | "staging" | "external";
export type BusinessCriticality = "critical" | "high" | "medium";
export type PriorityTag = "urgent" | "standard" | "watch";

export interface SavedTarget {
  id: string;
  label: string;
  target: string;
  environment_tag: EnvironmentTag | null;
  business_criticality: BusinessCriticality | null;
  last_used_at: string | null;
}

export interface RecentLaunchContext {
  scan_id: string;
  target: string;
  target_label: string | null;
  scan_profile: ScanProfile;
  scan_notes: string | null;
  environment_tag: EnvironmentTag | null;
  priority_tag: PriorityTag | null;
  launched_at: string;
}

const SAVED_TARGETS_STORAGE_KEY = "aegis.saved-targets";
const RECENT_LAUNCHES_STORAGE_KEY = "aegis.recent-launches";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function canUseStorage() {
  return typeof window !== "undefined";
}

function safeParse<T>(rawValue: string | null): T | null {
  if (!rawValue) {
    return null;
  }

  try {
    return JSON.parse(rawValue) as T;
  } catch {
    return null;
  }
}

function isUuid(value: string | null | undefined): value is string {
  return Boolean(value && UUID_PATTERN.test(value.trim()));
}

function normalizeString(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function validateSavedTarget(value: unknown): SavedTarget | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as Partial<SavedTarget>;
  if (!candidate.id?.trim() || !candidate.label?.trim() || !candidate.target?.trim()) {
    return null;
  }

  return {
    id: candidate.id.trim(),
    label: candidate.label.trim(),
    target: candidate.target.trim(),
    environment_tag: candidate.environment_tag ?? null,
    business_criticality: candidate.business_criticality ?? null,
    last_used_at: normalizeString(candidate.last_used_at),
  };
}

function validateRecentLaunch(value: unknown): RecentLaunchContext | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as Partial<RecentLaunchContext>;
  if (!isUuid(candidate.scan_id) || !candidate.target?.trim() || !candidate.launched_at?.trim()) {
    return null;
  }

  return {
    scan_id: candidate.scan_id.trim(),
    target: candidate.target.trim(),
    target_label: normalizeString(candidate.target_label),
    scan_profile: candidate.scan_profile ?? "full_quantum_readiness",
    scan_notes: normalizeString(candidate.scan_notes),
    environment_tag: candidate.environment_tag ?? null,
    priority_tag: candidate.priority_tag ?? null,
    launched_at: candidate.launched_at.trim(),
  };
}

export function loadSavedTargets(): SavedTarget[] {
  if (!canUseStorage()) {
    return [];
  }

  const parsed = safeParse<unknown[]>(window.localStorage.getItem(SAVED_TARGETS_STORAGE_KEY));
  if (!Array.isArray(parsed)) {
    return [];
  }

  return parsed
    .map(validateSavedTarget)
    .filter((target): target is SavedTarget => target !== null)
    .sort((left, right) => left.label.localeCompare(right.label));
}

export function persistSavedTargets(targets: SavedTarget[]) {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.setItem(SAVED_TARGETS_STORAGE_KEY, JSON.stringify(targets));
}

export function upsertSavedTarget(target: SavedTarget) {
  const existing = loadSavedTargets();
  const next = existing.filter((item) => item.id !== target.id);
  next.push(target);
  persistSavedTargets(next);
}

export function removeSavedTarget(targetId: string) {
  const next = loadSavedTargets().filter((item) => item.id !== targetId);
  persistSavedTargets(next);
}

export function markSavedTargetUsed(targetId: string) {
  const now = new Date().toISOString();
  const next = loadSavedTargets().map((item) =>
    item.id === targetId ? { ...item, last_used_at: now } : item
  );
  persistSavedTargets(next);
}

export function buildSavedTarget(
  partial: Omit<SavedTarget, "id" | "last_used_at"> & {
    id?: string;
    last_used_at?: string | null;
  }
): SavedTarget {
  return {
    id: partial.id ?? crypto.randomUUID(),
    label: partial.label.trim(),
    target: partial.target.trim(),
    environment_tag: partial.environment_tag ?? null,
    business_criticality: partial.business_criticality ?? null,
    last_used_at: normalizeString(partial.last_used_at) ?? null,
  };
}

export function loadRecentLaunches(limit = 6): RecentLaunchContext[] {
  if (!canUseStorage()) {
    return [];
  }

  const parsed = safeParse<unknown[]>(window.localStorage.getItem(RECENT_LAUNCHES_STORAGE_KEY));
  if (!Array.isArray(parsed)) {
    return [];
  }

  return parsed
    .map(validateRecentLaunch)
    .filter((item): item is RecentLaunchContext => item !== null)
    .sort((left, right) => right.launched_at.localeCompare(left.launched_at))
    .slice(0, limit);
}

export function recordRecentLaunch(context: RecentLaunchContext) {
  if (!canUseStorage()) {
    return;
  }

  const existing = loadRecentLaunches(12).filter(
    (item) => item.scan_id !== context.scan_id
  );
  existing.unshift(context);
  window.localStorage.setItem(
    RECENT_LAUNCHES_STORAGE_KEY,
    JSON.stringify(existing.slice(0, 12))
  );
}
