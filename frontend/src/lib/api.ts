const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export type ScanStatus = "pending" | "running" | "completed" | "failed";
export type ComplianceTier =
  | "FULLY_QUANTUM_SAFE"
  | "PQC_TRANSITIONING"
  | "QUANTUM_VULNERABLE";
export type ServiceType = "tls" | "vpn" | "api";

export interface ProgressResponse {
  assets_discovered: number;
  assessments_created: number;
  cboms_created: number;
  remediations_created: number;
  certificates_created: number;
}

export interface ScanRuntimeEventResponse {
  timestamp: string;
  kind: string;
  message: string;
  stage: string | null;
}

export interface ScanSummaryResponse {
  total_assets: number;
  tls_assets: number;
  non_tls_assets: number;
  fully_quantum_safe_assets: number;
  transitioning_assets: number;
  vulnerable_assets: number;
  highest_risk_score: number | null;
}

export interface RecentScanSummaryResponse {
  vulnerable_assets: number;
  transitioning_assets: number;
  fully_quantum_safe_assets: number;
  highest_risk_score: number | null;
}

export interface ScanAcceptedResponse {
  scan_id: string;
  target: string;
  status: ScanStatus;
  created_at: string | null;
}

export interface ScanStatusResponse extends ScanAcceptedResponse {
  completed_at: string | null;
  progress: ProgressResponse | null;
  summary: ScanSummaryResponse | null;
  stage: string | null;
  stage_detail: string | null;
  stage_started_at: string | null;
  elapsed_seconds: number | null;
  events: ScanRuntimeEventResponse[];
  degraded_modes: string[];
}

export interface AssessmentResponse {
  id: string;
  tls_version: string | null;
  cipher_suite: string | null;
  kex_algorithm: string | null;
  auth_algorithm: string | null;
  enc_algorithm: string | null;
  mac_algorithm: string | null;
  risk_score: number | null;
  compliance_tier: ComplianceTier | null;
  kex_vulnerability: number | null;
  sig_vulnerability: number | null;
  sym_vulnerability: number | null;
  tls_vulnerability: number | null;
}

export interface CbomResponse {
  id: string;
  serial_number: string;
  created_at: string | null;
  cbom_json: Record<string, unknown>;
}

export interface CertificateResponse {
  id: string;
  tier: ComplianceTier;
  signing_algorithm: string;
  valid_from: string;
  valid_until: string;
  extensions_json: Record<string, unknown> | null;
  remediation_bundle_id: string | null;
  certificate_pem: string | null;
}

export interface RemediationResponse {
  id: string;
  created_at: string | null;
  hndl_timeline: Record<string, unknown> | null;
  patch_config: string | null;
  migration_roadmap: string | null;
  source_citations: Record<string, unknown> | null;
}

export interface AssetResultResponse {
  asset_id: string;
  hostname: string | null;
  ip_address: string | null;
  port: number;
  protocol: string;
  service_type: ServiceType | null;
  server_software: string | null;
  assessment: AssessmentResponse | null;
  cbom: CbomResponse | null;
  remediation: RemediationResponse | null;
  certificate: CertificateResponse | null;
}

export interface ScanResultsResponse {
  scan_id: string;
  target: string;
  status: ScanStatus;
  created_at: string | null;
  completed_at: string | null;
  progress: ProgressResponse | null;
  summary: ScanSummaryResponse | null;
  stage: string | null;
  stage_detail: string | null;
  stage_started_at: string | null;
  elapsed_seconds: number | null;
  events: ScanRuntimeEventResponse[];
  degraded_modes: string[];
  assets: AssetResultResponse[];
}

export interface MissionControlPortfolioSummaryResponse {
  completed_scans: number;
  running_scans: number;
  failed_scans: number;
  vulnerable_assets: number;
  transitioning_assets: number;
  compliant_assets: number;
  certificates_issued: number;
  remediation_bundles_generated: number;
  degraded_scan_count: number;
}

export interface MissionControlRecentScanResponse {
  scan_id: string;
  target: string;
  status: ScanStatus;
  created_at: string | null;
  completed_at: string | null;
  summary: RecentScanSummaryResponse;
  progress: ProgressResponse;
  degraded_mode_count: number;
}

export interface MissionControlPriorityFindingResponse {
  scan_id: string;
  asset_id: string;
  target: string;
  asset_label: string;
  port: number;
  service_type: ServiceType | null;
  tier: ComplianceTier | null;
  risk_score: number | null;
}

export interface MissionControlSystemHealthResponse {
  backend_status: string;
  degraded_runtime_notice_count: number;
}

export interface MissionControlOverviewResponse {
  portfolio_summary: MissionControlPortfolioSummaryResponse;
  recent_scans: MissionControlRecentScanResponse[];
  priority_findings: MissionControlPriorityFindingResponse[];
  system_health: MissionControlSystemHealthResponse;
}

export interface ScanHistoryItemResponse {
  scan_id: string;
  target: string;
  status: ScanStatus;
  created_at: string | null;
  completed_at: string | null;
  summary: RecentScanSummaryResponse;
  progress: ProgressResponse;
  degraded_mode_count: number;
}

export interface ScanHistoryResponse {
  items: ScanHistoryItemResponse[];
}

interface ErrorEnvelope {
  error?: {
    type?: string;
    message?: string;
  };
  detail?: string;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly type?: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function apiFetch<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  const response = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
    ...options,
  });

  if (!response.ok) {
    const error = (await response.json().catch(() => ({}))) as ErrorEnvelope;
    throw new ApiError(
      error.error?.message ||
        error.detail ||
        `API request failed: ${response.status} ${response.statusText}`,
      response.status,
      error.error?.type
    );
  }

  return response.json();
}

export async function checkHealth(): Promise<{ status: string }> {
  return apiFetch("/health");
}

export async function createScan(target: string): Promise<ScanAcceptedResponse> {
  return apiFetch("/api/v1/scan", {
    method: "POST",
    body: JSON.stringify({ target }),
  });
}

export async function getScanStatus(
  scanId: string,
  options?: RequestInit
): Promise<ScanStatusResponse> {
  return apiFetch(`/api/v1/scan/${scanId}`, options);
}

export async function getScanResults(
  scanId: string,
  options?: RequestInit
): Promise<ScanResultsResponse> {
  return apiFetch(`/api/v1/scan/${scanId}/results`, options);
}

export async function getAssetCbom(
  assetId: string,
  options?: RequestInit
): Promise<CbomResponse> {
  return apiFetch(`/api/v1/assets/${assetId}/cbom`, options);
}

export async function getAssetCertificate(
  assetId: string,
  options?: RequestInit
): Promise<CertificateResponse> {
  return apiFetch(`/api/v1/assets/${assetId}/certificate`, options);
}

export async function getAssetRemediation(
  assetId: string,
  options?: RequestInit
): Promise<RemediationResponse> {
  return apiFetch(`/api/v1/assets/${assetId}/remediation`, options);
}

export async function getMissionControlOverview(
  options?: RequestInit & {
    recentLimit?: number;
    priorityLimit?: number;
  }
): Promise<MissionControlOverviewResponse> {
  const search = new URLSearchParams();
  if (typeof options?.recentLimit === "number") {
    search.set("recent_limit", String(options.recentLimit));
  }
  if (typeof options?.priorityLimit === "number") {
    search.set("priority_limit", String(options.priorityLimit));
  }
  const query = search.toString();
  return apiFetch(
    `/api/v1/mission-control/overview${query ? `?${query}` : ""}`,
    options
  );
}

export async function getScanHistory(
  options?: RequestInit & {
    limit?: number;
    target?: string | null;
  }
): Promise<ScanHistoryResponse> {
  const search = new URLSearchParams();
  if (typeof options?.limit === "number") {
    search.set("limit", String(options.limit));
  }
  if (options?.target?.trim()) {
    search.set("target", options.target.trim());
  }
  const query = search.toString();
  return apiFetch(`/api/v1/scan/history${query ? `?${query}` : ""}`, options);
}
