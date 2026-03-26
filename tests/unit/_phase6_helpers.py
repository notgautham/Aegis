"""
Shared helpers for Phase 6 tests.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime
from pathlib import Path

from backend.models.certificate_chain import CertificateChain
from backend.models.cbom_document import CbomDocument
from backend.models.crypto_assessment import CryptoAssessment
from backend.models.discovered_asset import DiscoveredAsset
from backend.models.enums import CertLevel, ComplianceTier, ServiceType
from backend.models.scan_job import ScanJob


def write_sample_corpus(base_dir: Path) -> Path:
    """Create a small deterministic local corpus for retrieval tests."""
    corpus_dir = base_dir / "nist"
    corpus_dir.mkdir(parents=True, exist_ok=True)
    (corpus_dir / "fips203.md").write_text(
        "# FIPS 203\n"
        "ML-KEM defines post-quantum key establishment guidance.\n"
        "## Hybrid Deployment\n"
        "Use X25519MLKEM768 to stage hybrid deployment while preserving AES-256-GCM.\n",
        encoding="utf-8",
    )
    (corpus_dir / "roadmap.txt").write_text(
        "Quantum Threat Reference\n"
        "RSA-2048 requires approximately 4000 logical qubits.\n"
        "ECDH-P256 requires approximately 2330 logical qubits.\n"
        "Prioritize migration plans for vulnerable internet-facing systems.\n",
        encoding="utf-8",
    )
    return corpus_dir


def build_remediation_fixture(
    *,
    hostname: str = "testssl.sh",
    server_software: str = "nginx",
    kex_algorithm: str = "ECDHE",
    auth_algorithm: str = "RSA",
    enc_algorithm: str = "AES_256_GCM",
    tier: ComplianceTier = ComplianceTier.QUANTUM_VULNERABLE,
) -> tuple[ScanJob, DiscoveredAsset, CryptoAssessment, CertificateChain, CbomDocument]:
    """Build realistic model instances for Phase 6 tests."""
    scan_job = ScanJob(
        id=uuid.uuid4(),
        target=hostname,
    )
    asset = DiscoveredAsset(
        id=uuid.uuid4(),
        scan_id=scan_job.id,
        hostname=hostname,
        ip_address="198.51.100.42",
        port=443,
        protocol="tcp",
        service_type=ServiceType.TLS,
        server_software=server_software,
    )
    assessment = CryptoAssessment(
        id=uuid.uuid4(),
        asset_id=asset.id,
        tls_version="1.2" if "ECDHE" in kex_algorithm else "1.3",
        cipher_suite="TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384"
        if "ECDHE" in kex_algorithm
        else "TLS_AES_256_GCM_SHA384",
        kex_algorithm=kex_algorithm,
        auth_algorithm=auth_algorithm,
        enc_algorithm=enc_algorithm,
        mac_algorithm="SHA384",
        kex_vulnerability=1.0 if "ECDHE" in kex_algorithm else 0.3,
        sig_vulnerability=1.0 if auth_algorithm == "RSA" else 0.0,
        sym_vulnerability=0.05,
        tls_vulnerability=0.4 if "ECDHE" in kex_algorithm else 0.0,
        risk_score=84.5 if tier is ComplianceTier.QUANTUM_VULNERABLE else 18.0,
        compliance_tier=tier,
    )
    certificate = CertificateChain(
        id=uuid.uuid4(),
        asset_id=asset.id,
        cert_level=CertLevel.LEAF,
        subject=f"CN={hostname}",
        issuer="CN=Aegis Test Root",
        public_key_algorithm="RSA" if auth_algorithm == "RSA" else "ML-DSA-65",
        key_size_bits=2048 if auth_algorithm == "RSA" else None,
        signature_algorithm="sha256WithRSAEncryption"
        if auth_algorithm == "RSA"
        else "ML-DSA-65",
        quantum_safe=auth_algorithm != "RSA",
        not_before=datetime(2026, 1, 1, tzinfo=UTC),
        not_after=datetime(2026, 6, 1, tzinfo=UTC),
    )
    cbom_document = CbomDocument(
        id=uuid.uuid4(),
        scan_id=scan_job.id,
        asset_id=asset.id,
        serial_number=f"urn:aegis:scan:20260326:{hostname}:443",
        cbom_json={
            "components": [
                {
                    "cryptoProperties": {
                        "certificateProperties": {
                            "subjectPublicKeySize": certificate.key_size_bits,
                        }
                    }
                }
            ]
        },
    )
    return scan_job, asset, assessment, certificate, cbom_document
