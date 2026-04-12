"""
Integration tests for the Phase 7 certificate pipeline.
"""

from __future__ import annotations

from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

import pytest

from backend.cert import (
    CertificateRequest,
    CertificateSigner,
    get_extension_payload,
    load_certificate,
)
from backend.core.config import get_settings
from backend.models.enums import ComplianceTier
from backend.repositories.compliance_cert_repo import ComplianceCertificateRepository
from tests.unit._phase7_helpers import build_certificate_fixture, unavailable_oqs_capability


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
async def test_issue_and_persist_tier_one_certificate(tmp_path, monkeypatch, db_session) -> None:
    scan_job, asset, assessment, remediation_bundle = build_certificate_fixture(
        tier=ComplianceTier.FULLY_QUANTUM_SAFE,
        kex_algorithm="ML-KEM-768",
        auth_algorithm="ML-DSA-65",
        enc_algorithm="AES_256_GCM",
    )
    db_session.add(scan_job)
    db_session.add(asset)
    db_session.add(assessment)
    await db_session.flush()

    signer = CertificateSigner(runtime_dir=tmp_path)
    monkeypatch.setattr(signer, "_detect_oqs_capability", lambda: unavailable_oqs_capability())
    repository = ComplianceCertificateRepository(db_session)

    persisted = await signer.issue_and_persist(
        certificate_request=CertificateRequest(
            asset=asset,
            assessment=assessment,
            remediation_bundle=remediation_bundle,
        ),
        compliance_certificate_repository=repository,
    )
    stored = await repository.get_by_asset_id(asset.id)
    certificate = load_certificate(persisted.certificate_pem)

    assert len(stored) == 1
    assert persisted.tier is ComplianceTier.FULLY_QUANTUM_SAFE
    assert persisted.signing_algorithm == "ECDSA"
    assert certificate.subject.rfc4514_string() == f"CN={asset.hostname}"
    assert get_extension_payload(certificate, "pqc_status") == "READY"


@pytest.mark.asyncio
async def test_issue_and_persist_tier_three_certificate_with_remediation(
    tmp_path,
    monkeypatch,
    db_session,
) -> None:
    scan_job, asset, assessment, remediation_bundle = build_certificate_fixture()
    db_session.add(scan_job)
    db_session.add(asset)
    db_session.add(assessment)
    db_session.add(remediation_bundle)
    await db_session.flush()

    signer = CertificateSigner(runtime_dir=tmp_path)
    monkeypatch.setattr(signer, "_detect_oqs_capability", lambda: unavailable_oqs_capability())
    repository = ComplianceCertificateRepository(db_session)

    persisted = await signer.issue_and_persist(
        certificate_request=CertificateRequest(
            asset=asset,
            assessment=assessment,
            remediation_bundle=remediation_bundle,
        ),
        compliance_certificate_repository=repository,
    )
    stored = await repository.get_by_asset_id(asset.id)
    certificate = load_certificate(persisted.certificate_pem)

    assert len(stored) == 1
    assert persisted.remediation_bundle_id == remediation_bundle.id
    assert persisted.valid_until > persisted.valid_from
    assert certificate.not_valid_before_utc == persisted.valid_from
    assert certificate.not_valid_after_utc == persisted.valid_until
    assert get_extension_payload(certificate, "pqc_status") == "VULNERABLE"
    assert get_extension_payload(certificate, "remediation_bundle_id") == str(remediation_bundle.id)
