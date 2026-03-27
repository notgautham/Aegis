"""
Shared helpers for Phase 7 certificate tests.
"""

from __future__ import annotations

import uuid
from types import SimpleNamespace

from backend.models.crypto_assessment import CryptoAssessment
from backend.models.discovered_asset import DiscoveredAsset
from backend.models.enums import ComplianceTier, ServiceType
from backend.models.remediation_bundle import RemediationBundle
from backend.models.scan_job import ScanJob
from tests.unit._phase6_helpers import build_remediation_fixture


def build_certificate_fixture(
    *,
    tier: ComplianceTier = ComplianceTier.QUANTUM_VULNERABLE,
    hostname: str | None = "testssl.sh",
    ip_address: str = "198.51.100.42",
    server_software: str = "nginx",
    kex_algorithm: str = "ECDHE",
    auth_algorithm: str = "RSA",
    enc_algorithm: str = "AES_256_GCM",
) -> tuple[ScanJob, DiscoveredAsset, CryptoAssessment, RemediationBundle | None]:
    """Create realistic Phase 7 model fixtures."""
    scan_job, asset, assessment, _, _ = build_remediation_fixture(
        tier=tier,
        hostname=hostname or ip_address,
        server_software=server_software,
        kex_algorithm=kex_algorithm,
        auth_algorithm=auth_algorithm,
        enc_algorithm=enc_algorithm,
    )
    asset.hostname = hostname
    asset.ip_address = ip_address
    asset.service_type = ServiceType.TLS

    remediation_bundle = None
    if tier is ComplianceTier.QUANTUM_VULNERABLE:
        remediation_bundle = RemediationBundle(
            id=uuid.uuid4(),
            asset_id=asset.id,
            hndl_timeline={"urgency": "CRITICAL"},
            patch_config="# remediation patch",
            migration_roadmap="Preparation / Prerequisites",
            source_citations={"documents": []},
        )
    return scan_job, asset, assessment, remediation_bundle


def unavailable_oqs_capability() -> SimpleNamespace:
    """Return a capability object that forces ECDSA fallback in tests."""
    return SimpleNamespace(available=False, reason="test fallback")
