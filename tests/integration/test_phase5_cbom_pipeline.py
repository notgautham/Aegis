"""
Integration tests for Phase 5 rules engine and CBOM pipeline.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

import pytest

from backend.cbom.cyclonedx_mapper import AssetCbomBundle, CycloneDxMapper
from backend.compliance.rules_engine import ComplianceInput, RulesEngine
from backend.core.config import get_settings
from backend.models.certificate_chain import CertificateChain
from backend.models.crypto_assessment import CryptoAssessment
from backend.models.discovered_asset import DiscoveredAsset
from backend.models.enums import CertLevel, ComplianceTier, ScanStatus, ServiceType
from backend.models.scan_job import ScanJob
from backend.repositories.cbom_repo import CbomDocumentRepository
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine


@pytest.fixture
async def db_session():
    engine = create_async_engine(get_settings().DATABASE_URL, echo=False, future=True)
    session_factory = async_sessionmaker(engine, expire_on_commit=False)
    async with session_factory() as session:
        transaction = await session.begin()
        try:
            yield session
        finally:
            await transaction.rollback()
    await engine.dispose()


@pytest.mark.asyncio
async def test_documented_vulnerable_case_persists_cbom_and_updates_tier(db_session) -> None:
    mapper = CycloneDxMapper()
    bundle = await _create_bundle(
        db_session,
        hostname="testssl.sh",
        kex_algorithm="ECDHE",
        auth_algorithm="RSA",
        enc_algorithm="AES_256_GCM",
        risk_score=84.5,
    )

    persisted = await mapper.persist_cbom(
        bundle=bundle,
        cbom_repository=CbomDocumentRepository(db_session),
        timestamp=datetime(2026, 3, 26, tzinfo=UTC),
    )

    assert persisted.serial_number == "urn:aegis:scan:20260326:testssl.sh:443"
    assert persisted.cbom_json["quantumRiskSummary"]["tier"] == "QUANTUM_VULNERABLE"
    assert persisted.cbom_json["quantumRiskSummary"]["overallScore"] == 84.5
    assert bundle.assessment.compliance_tier is ComplianceTier.QUANTUM_VULNERABLE


@pytest.mark.asyncio
async def test_hybrid_case_persists_cbom_and_updates_tier(db_session) -> None:
    mapper = CycloneDxMapper()
    bundle = await _create_bundle(
        db_session,
        hostname="hybrid.example.com",
        kex_algorithm="X25519_MLKEM768",
        auth_algorithm="ML-DSA-65",
        enc_algorithm="AES_256_GCM",
        risk_score=14.0,
    )

    persisted = await mapper.persist_cbom(
        bundle=bundle,
        cbom_repository=CbomDocumentRepository(db_session),
        timestamp=datetime(2026, 3, 26, tzinfo=UTC),
    )

    assert persisted.cbom_json["quantumRiskSummary"]["tier"] == "PQC_TRANSITIONING"
    assert persisted.cbom_json["quantumRiskSummary"]["priorityActions"] == [
        "migrate-key-exchange"
    ]
    assert bundle.assessment.compliance_tier is ComplianceTier.PQC_TRANSITIONING


async def _create_bundle(
    session,
    *,
    hostname: str,
    kex_algorithm: str,
    auth_algorithm: str,
    enc_algorithm: str,
    risk_score: float,
) -> AssetCbomBundle:
    scan_job = ScanJob(
        id=uuid.uuid4(),
        target=hostname,
        status=ScanStatus.RUNNING,
    )
    session.add(scan_job)
    await session.flush()

    asset = DiscoveredAsset(
        id=uuid.uuid4(),
        scan_id=scan_job.id,
        hostname=hostname,
        ip_address="198.51.100.42",
        port=443,
        protocol="tcp",
        service_type=ServiceType.TLS,
        server_software="nginx",
    )
    session.add(asset)
    await session.flush()

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
        risk_score=risk_score,
    )
    session.add(assessment)

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
    session.add(certificate)
    await session.flush()

    evaluation = RulesEngine().evaluate(
        ComplianceInput(
            kex_algorithm=kex_algorithm,
            auth_algorithm=auth_algorithm,
            enc_algorithm=enc_algorithm,
            risk_score=risk_score,
        )
    )
    return AssetCbomBundle(
        asset=asset,
        assessment=assessment,
        certificates=[certificate],
        compliance=evaluation,
    )
