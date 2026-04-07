"""
Phase 8 API request and response schemas.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field

from backend.models.enums import ComplianceTier, ScanStatus, ServiceType


class ScanCreateRequest(BaseModel):
    """Request body for starting a scan."""

    target: str


class ProgressResponse(BaseModel):
    """Derived scan progress counters."""

    assets_discovered: int
    assessments_created: int
    cboms_created: int
    remediations_created: int
    certificates_created: int


class ScanRuntimeEventResponse(BaseModel):
    """Recent runtime telemetry event for a scan."""

    timestamp: datetime
    kind: str
    message: str
    stage: str | None = None


class ScanSummaryResponse(BaseModel):
    """Derived high-level summary for one scan."""

    total_assets: int
    tls_assets: int
    non_tls_assets: int
    fully_quantum_safe_assets: int
    transitioning_assets: int
    vulnerable_assets: int
    highest_risk_score: float | None


class RecentScanSummaryResponse(BaseModel):
    """Compact posture counts for recent scan cards and timeline items."""

    vulnerable_assets: int
    transitioning_assets: int
    fully_quantum_safe_assets: int
    highest_risk_score: float | None


class ScanAcceptedResponse(BaseModel):
    """Accepted scan creation response."""

    scan_id: uuid.UUID
    target: str
    status: ScanStatus
    created_at: datetime | None


class ScanStatusResponse(ScanAcceptedResponse):
    """Polling response for scan status."""

    completed_at: datetime | None
    progress: ProgressResponse
    summary: ScanSummaryResponse
    stage: str | None = None
    stage_detail: str | None = None
    stage_started_at: datetime | None = None
    elapsed_seconds: float | None = None
    events: list[ScanRuntimeEventResponse] = Field(default_factory=list)
    degraded_modes: list[str] = Field(default_factory=list)


class AssessmentResponse(BaseModel):
    """Assessment summary for scan results."""

    id: uuid.UUID
    tls_version: str | None
    cipher_suite: str | None
    kex_algorithm: str | None
    auth_algorithm: str | None
    enc_algorithm: str | None
    mac_algorithm: str | None
    risk_score: float | None
    compliance_tier: ComplianceTier | None
    kex_vulnerability: float | None
    sig_vulnerability: float | None
    sym_vulnerability: float | None
    tls_vulnerability: float | None


class CbomResponse(BaseModel):
    """CBOM retrieval payload."""

    id: uuid.UUID
    serial_number: str
    created_at: datetime | None
    cbom_json: dict[str, Any]


class CertificateResponse(BaseModel):
    """Certificate retrieval payload."""

    id: uuid.UUID
    tier: ComplianceTier
    signing_algorithm: str
    valid_from: datetime
    valid_until: datetime
    extensions_json: dict[str, Any] | None
    remediation_bundle_id: uuid.UUID | None
    certificate_pem: str | None = None


class RemediationResponse(BaseModel):
    """Remediation retrieval payload."""

    id: uuid.UUID
    created_at: datetime | None
    hndl_timeline: dict[str, Any] | None
    patch_config: str | None
    migration_roadmap: str | None
    source_citations: dict[str, Any] | None


class LeafCertificateResponse(BaseModel):
    """Leaf certificate summary included in compiled asset results."""

    subject_cn: str | None
    issuer: str | None
    public_key_algorithm: str | None
    key_size_bits: int | None
    signature_algorithm: str | None
    quantum_safe: bool | None
    not_before: datetime | None
    not_after: datetime | None
    days_remaining: int | None


class RemediationActionResponse(BaseModel):
    """Structured remediation action included in compiled asset results."""

    priority: str
    finding: str
    action: str
    effort: str
    status: str
    category: str | None
    nist_reference: str | None


class AssetResultResponse(BaseModel):
    """Compiled per-asset scan result."""

    asset_id: uuid.UUID
    hostname: str | None
    ip_address: str | None
    port: int
    protocol: str
    service_type: ServiceType | None
    server_software: str | None
    assessment: AssessmentResponse | None
    cbom: CbomResponse | None
    remediation: RemediationResponse | None
    certificate: CertificateResponse | None
    leaf_certificate: LeafCertificateResponse | None = None
    remediation_actions: list[RemediationActionResponse] = Field(default_factory=list)


class ScanResultsResponse(BaseModel):
    """Compiled scan results payload."""

    scan_id: uuid.UUID
    target: str
    status: ScanStatus
    created_at: datetime | None
    completed_at: datetime | None
    progress: ProgressResponse
    summary: ScanSummaryResponse
    stage: str | None = None
    stage_detail: str | None = None
    stage_started_at: datetime | None = None
    elapsed_seconds: float | None = None
    events: list[ScanRuntimeEventResponse] = Field(default_factory=list)
    degraded_modes: list[str] = Field(default_factory=list)
    assets: list[AssetResultResponse]


class MissionControlPortfolioSummaryResponse(BaseModel):
    """Portfolio-level summary derived from recent persisted scans."""

    completed_scans: int
    running_scans: int
    failed_scans: int
    vulnerable_assets: int
    transitioning_assets: int
    compliant_assets: int
    certificates_issued: int
    remediation_bundles_generated: int
    degraded_scan_count: int


class MissionControlRecentScanResponse(BaseModel):
    """Compact recent scan card for Mission Control."""

    scan_id: uuid.UUID
    target: str
    status: ScanStatus
    created_at: datetime | None
    completed_at: datetime | None
    summary: RecentScanSummaryResponse
    progress: ProgressResponse
    degraded_mode_count: int = 0


class MissionControlPriorityFindingResponse(BaseModel):
    """Priority finding surfaced across recent completed scans."""

    scan_id: uuid.UUID
    asset_id: uuid.UUID
    target: str
    asset_label: str
    port: int
    service_type: ServiceType | None
    tier: ComplianceTier | None
    risk_score: float | None


class MissionControlSystemHealthResponse(BaseModel):
    """Backend/system strip data for Mission Control."""

    backend_status: str
    degraded_runtime_notice_count: int = 0


class MissionControlOverviewResponse(BaseModel):
    """Mission Control home-page aggregate payload."""

    portfolio_summary: MissionControlPortfolioSummaryResponse
    recent_scans: list[MissionControlRecentScanResponse] = Field(default_factory=list)
    priority_findings: list[MissionControlPriorityFindingResponse] = Field(default_factory=list)
    system_health: MissionControlSystemHealthResponse


class ScanHistoryItemResponse(BaseModel):
    """Compact timeline item for recent scan history."""

    scan_id: uuid.UUID
    target: str
    status: ScanStatus
    created_at: datetime | None
    completed_at: datetime | None
    summary: RecentScanSummaryResponse
    progress: ProgressResponse
    degraded_mode_count: int = 0


class ScanHistoryResponse(BaseModel):
    """Recent scan timeline payload."""

    items: list[ScanHistoryItemResponse] = Field(default_factory=list)


class ErrorEnvelope(BaseModel):
    """Consistent JSON error response body."""

    error: dict[str, Any]


class OrmModel(BaseModel):
    """Base schema config for ORM-compatible responses."""

    model_config = ConfigDict(from_attributes=True)
