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
  compliance_tier: string;
  kex_vulnerability: number;
  sig_vulnerability: number;
  sym_vulnerability: number;
  tls_vulnerability: number;
}

export interface RemediationResponse {
  hndl_timeline: HndlTimeline | null;
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
  leaf_certificate: LeafCertificate | null;
  remediation_actions: RemediationActionItem[];
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
  vulnerable_assets: number;
  transitioning_assets: number;
  fully_quantum_safe_assets: number;
  highest_risk_score: number;
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
}

export interface ScanHistoryResponse {
  items: ScanHistoryItem[];
}

export interface MissionControlResponse {
  [key: string]: unknown;
}

// ========== API Object ==========

export const api = {
  createScan: (target: string) =>
    request<{ scan_id: string }>('POST', '/api/v1/scan', { target }),

  getScanStatus: (scanId: string) =>
    request<ScanStatusResponse>('GET', `/api/v1/scan/${scanId}`),

  getScanResults: (scanId: string) =>
    request<ScanResultsResponse>('GET', `/api/v1/scan/${scanId}/results`),

  getScanHistory: () =>
    request<ScanHistoryResponse>('GET', '/api/v1/scan/history'),

  getAssetCbom: (assetId: string) =>
    request<CbomResponse>('GET', `/api/v1/assets/${assetId}/cbom`),

  getAssetRemediation: (assetId: string) =>
    request<RemediationResponse>('GET', `/api/v1/assets/${assetId}/remediation`),

  getAssetCertificate: (assetId: string) =>
    request<CertificateResponse>('GET', `/api/v1/assets/${assetId}/certificate`),

  getMissionControl: () =>
    request<MissionControlResponse>('GET', '/api/v1/mission-control/overview'),
};
