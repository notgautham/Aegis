// ========== AEGIS API Client ==========

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';

function authHeaders(): HeadersInit {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${localStorage.getItem('aegis-token') ?? ''}`,
  };
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: authHeaders(),
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    throw new Error(`API ${method} ${path} failed: ${res.status} ${res.statusText}`);
  }
  if (res.status === 204) {
    return undefined as T;
  }
  return res.json() as Promise<T>;
}

// ========== Response Interfaces ==========

export interface HndlTimeline {
  entries: Array<{
    breakYear: number;
    algorithm: string;
    logicalQubits: number;
    projectedGrowthRate: number;
  }>;
  urgency: string;
  mostUrgentAlgorithm: string | null;
}

export interface AssessmentResponse {
  tls_version: string;
  cipher_suite: string;
  kex_algorithm: string;
  risk_score: number; // 0–100
  score_explanation?: {
    formula?: string;
    derivation?: string;
    base_risk_score?: number;
    final_risk_score?: number;
    q_score?: number;
    weighted_components?: {
      kex?: number;
      sig?: number;
      sym?: number;
      tls?: number;
    };
    penalties?: {
      certificate?: number;
      certificate_reason?: string;
    };
    inputs?: {
      weights?: {
        kex?: number;
        sig?: number;
        sym?: number;
        tls?: number;
      };
      vulnerabilities?: {
        kex?: number;
        sig?: number;
        sym?: number;
        tls?: number;
      };
      algorithms?: {
        kex?: string;
        sig?: string;
        sym?: string;
        tls?: string;
      };
    };
    kex_explanation?: string;
    sig_explanation?: string;
    sym_explanation?: string;
    tls_explanation?: string;
    overall_explanation?: string;
  } | null;
  compliance_tier: string;
  kex_vulnerability: number;
  sig_vulnerability: number;
  sym_vulnerability: number;
  tls_vulnerability: number;
}

export interface RemediationResponse {
  hndl_timeline: HndlTimeline | null;
  patch_config?: string | null;
  migration_roadmap?: string | null;
  source_citations?: {
    documents?: Array<{
      title?: string | null;
      path?: string | null;
      section?: string | null;
    }>;
  } | null;
  [key: string]: unknown;
}

export interface CbomResponse {
  [key: string]: unknown;
}

export interface CertificateResponse {
  subject_cn: string;
  subject_alt_names: string[];
  issuer: string;
  certificate_authority: string;
  signature_algorithm: string;
  key_type: string;
  key_size: number;
  valid_from: string;
  valid_until: string;
  days_remaining: number;
  sha256_fingerprint: string;
}

export interface ComplianceCertificateResponse {
  id: string;
  tier: string;
  signing_algorithm: string;
  valid_from: string;
  valid_until: string;
  extensions_json?: Record<string, unknown> | null;
  remediation_bundle_id?: string | null;
  certificate_pem?: string | null;
}

export interface LeafCertificate {
  subject_cn: string | null;
  issuer: string | null;
  public_key_algorithm: string | null;
  key_size_bits: number | null;
  signature_algorithm: string | null;
  quantum_safe: boolean | null;
  not_before: string | null;
  not_after: string | null;
  days_remaining: number | null;
}

export interface RemediationActionItem {
  priority: string;
  finding: string;
  action: string;
  effort: string | null;
  status: string | null;
  category: string | null;
  nist_reference: string | null;
}

export interface AssetFingerprintHistoryEntry {
  scan_id: string | null;
  q_score: number | null;
  scanned_at: string | null;
}

export interface AssetFingerprintResponse {
  canonical_key: string;
  appearance_count: number;
  latest_q_score: number | null;
  latest_compliance_tier: string | null;
  first_seen_at: string;
  last_seen_at: string;
  first_seen_scan_id: string | null;
  last_seen_scan_id: string | null;
  q_score_history: AssetFingerprintHistoryEntry[];
}

export interface DNSRecordResponse {
  hostname: string;
  resolved_ips: string[];
  cnames: string[];
  discovery_source: string;
  is_in_scope: boolean;
  discovered_at: string | null;
}

export interface AssetResultResponse {
  asset_id: string;
  hostname: string | null;
  ip_address: string | null;
  port: number;
  service_type: 'tls' | 'vpn' | 'api';
  server_software: string | null;
  open_ports: Array<Record<string, unknown>> | null;
  asset_metadata: Record<string, unknown> | null;
  is_shadow_it: boolean;
  discovery_source: string | null;
  assessment: AssessmentResponse | null;
  remediation: RemediationResponse | null;
  cbom: CbomResponse | null;
  certificate: CertificateResponse | null;
  compliance_certificate?: ComplianceCertificateResponse | null;
  leaf_certificate: LeafCertificate | null;
  remediation_actions: RemediationActionItem[];
  asset_fingerprint: AssetFingerprintResponse | null;
}

export interface ScanProgress {
  assets_discovered: number;
  [key: string]: unknown;
}

export interface ScanRuntimeEvent {
  timestamp: string;
  kind: string;
  message: string;
  stage: string | null;
}

export interface ScanSummary {
  total_assets: number;
  tls_assets: number;
  non_tls_assets: number;
  vulnerable_assets: number;
  transitioning_assets: number;
  fully_quantum_safe_assets: number;
  critical_assets: number;
  unknown_assets: number;
  average_q_score: number | null;
  highest_risk_score: number | null;
}

export interface ScanResultsResponse {
  scan_id: string;
  target: string;
  status: string;
  created_at: string;
  completed_at: string | null;
  progress: ScanProgress;
  summary: ScanSummary;
  dns_records: DNSRecordResponse[];
  assets: AssetResultResponse[];
}

export interface ScanStatusResponse {
  scan_id: string;
  target: string;
  status: string;
  created_at: string;
  completed_at: string | null;
  progress: ScanProgress;
  summary: ScanSummary;
  stage: string | null;
  stage_detail: string | null;
  stage_started_at: string | null;
  elapsed_seconds: number | null;
  estimated_total_seconds: number | null;
  estimated_remaining_seconds: number | null;
  estimated_remaining_lower_seconds: number | null;
  estimated_remaining_upper_seconds: number | null;
  eta_confidence: string | null;
  events: ScanRuntimeEvent[];
  degraded_modes: string[];
}

export interface ScanHistoryItem {
  scan_id: string;
  target: string;
  status: string;
  created_at: string;
  completed_at: string | null;
  progress: ScanProgress;
  summary: ScanSummary;
  scan_profile?: string | null;
  initiated_by?: string | null;
  degraded_mode_count?: number;
}

export interface ScanHistoryResponse {
  items: ScanHistoryItem[];
}

export interface MissionControlResponse {
  [key: string]: unknown;
}

export interface MissionControlActivityItem {
  timestamp: string;
  kind: string;
  message: string;
  stage: string | null;
  scan_id: string;
  target: string;
  status: string;
  route: string | null;
}

export interface MissionControlActivityResponse {
  items: MissionControlActivityItem[];
}

export interface MissionControlGraphNode {
  id: string;
  label: string;
  status: string;
  x: number;
  y: number;
  r: number;
}

export interface MissionControlGraphResponse {
  nodes: MissionControlGraphNode[];
  edges: Array<[string, string]>;
}

// ========== API Object ==========

export const api = {
  createScan: (
    target: string,
    options?: { scan_profile?: string; initiated_by?: string },
  ) =>
    request<{ scan_id: string }>('POST', '/api/v1/scan', {
      target,
      scan_profile: options?.scan_profile ?? null,
      initiated_by: options?.initiated_by ?? null,
    }),

  getScanStatus: (scanId: string) =>
    request<ScanStatusResponse>('GET', `/api/v1/scan/${scanId}`),

  getScanResults: (scanId: string) =>
    request<ScanResultsResponse>('GET', `/api/v1/scan/${scanId}/results`),

  getScanHistory: (params?: { limit?: number; target?: string }) => {
    const search = new URLSearchParams();
    if (params?.limit !== undefined) search.set('limit', String(params.limit));
    if (params?.target) search.set('target', params.target);
    const suffix = search.toString() ? `?${search.toString()}` : '';
    return request<ScanHistoryResponse>('GET', `/api/v1/scan/history${suffix}`);
  },

  deleteScan: (scanId: string) =>
    request<void>('DELETE', `/api/v1/scan/${scanId}`),

  getAssetCbom: (assetId: string) =>
    request<CbomResponse>('GET', `/api/v1/assets/${assetId}/cbom`),

  getAssetRemediation: (assetId: string) =>
    request<RemediationResponse>('GET', `/api/v1/assets/${assetId}/remediation`),

  getAssetCertificate: (assetId: string) =>
    request<ComplianceCertificateResponse>('GET', `/api/v1/assets/${assetId}/certificate`),

  getMissionControl: () =>
    request<MissionControlResponse>('GET', '/api/v1/mission-control/overview'),

  getMissionControlActivity: (limit = 25) =>
    request<MissionControlActivityResponse>('GET', `/api/v1/mission-control/activity?limit=${limit}`),

  getMissionControlGraph: (params?: { scanId?: string; limit?: number }) => {
    const search = new URLSearchParams();
    if (params?.scanId) search.set('scan_id', params.scanId);
    if (params?.limit !== undefined) search.set('limit', String(params.limit));
    const suffix = search.toString() ? `?${search.toString()}` : '';
    return request<MissionControlGraphResponse>('GET', `/api/v1/mission-control/graph${suffix}`);
  },
};
