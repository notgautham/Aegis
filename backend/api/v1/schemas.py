"""
Phase 8 API request and response schemas.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict

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


class ScanResultsResponse(BaseModel):
    """Compiled scan results payload."""

    scan_id: uuid.UUID
    target: str
    status: ScanStatus
    created_at: datetime | None
    completed_at: datetime | None
    progress: ProgressResponse
    assets: list[AssetResultResponse]


class ErrorEnvelope(BaseModel):
    """Consistent JSON error response body."""

    error: dict[str, Any]


class OrmModel(BaseModel):
    """Base schema config for ORM-compatible responses."""

    model_config = ConfigDict(from_attributes=True)
