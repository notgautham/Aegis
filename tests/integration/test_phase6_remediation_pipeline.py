"""
Integration tests for the Phase 6 remediation pipeline.
"""

from __future__ import annotations

import pytest
from qdrant_client import QdrantClient
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from backend.core.config import Settings, get_settings
from backend.intelligence.rag_orchestrator import RagOrchestrator
from backend.intelligence.retrieval import RetrievalService, create_embedding_provider
from backend.intelligence.types import RemediationInput
from backend.models.enums import ComplianceTier
from backend.repositories.remediation_repo import RemediationBundleRepository
from tests.unit._phase6_helpers import build_remediation_fixture, write_sample_corpus


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
async def test_vulnerable_and_transitioning_assets_persist_remediation_bundles(
    tmp_path,
    db_session,
) -> None:
    service = RetrievalService(
        client=QdrantClient(":memory:"),
        collection_name="phase6_pipeline_docs",
        embedding_provider=create_embedding_provider(Settings()),
        default_top_k=5,
    )
    service.ingest_source_directory(write_sample_corpus(tmp_path))
    orchestrator = RagOrchestrator(retrieval_service=service)
    repository = RemediationBundleRepository(db_session)

    cases = [
        (
            ComplianceTier.QUANTUM_VULNERABLE,
            dict(
                hostname="testssl.sh",
                server_software="nginx",
                kex_algorithm="ECDHE",
                auth_algorithm="RSA",
            ),
            "ssl_ecdh_curve X25519MLKEM768:X25519;",
        ),
        (
            ComplianceTier.PQC_TRANSITIONING,
            dict(
                hostname="hybrid.testssl.sh",
                server_software="apache",
                kex_algorithm="X25519_MLKEM768",
                auth_algorithm="ML-DSA-65",
            ),
            "SSLOpenSSLConfCmd Curves X25519MLKEM768:X25519",
        ),
    ]

    for tier, overrides, expected_patch_line in cases:
        scan_job, asset, assessment, certificate, cbom_document = build_remediation_fixture(
            tier=tier,
            hostname=overrides["hostname"],
            server_software=overrides["server_software"],
            kex_algorithm=overrides["kex_algorithm"],
            auth_algorithm=overrides["auth_algorithm"],
        )
        db_session.add(scan_job)
        db_session.add(asset)
        db_session.add(assessment)
        db_session.add(certificate)
        db_session.add(cbom_document)
        await db_session.flush()

        remediation_input = RemediationInput(
            asset=asset,
            assessment=assessment,
            cbom_document=cbom_document,
            compliance_tier=tier,
        )
        bundle = await orchestrator.generate_and_persist(
            remediation_input=remediation_input,
            remediation_repository=repository,
            certificates=[certificate],
        )

        assert bundle is not None
        assert expected_patch_line in bundle.patch_config
        assert bundle.hndl_timeline["entries"]
        assert "Preparation / Prerequisites" in bundle.migration_roadmap
        assert bundle.source_citations["documents"]


@pytest.mark.asyncio
async def test_pipeline_uses_deterministic_roadmap_stub_when_llm_is_unavailable(
    tmp_path,
    db_session,
) -> None:
    service = RetrievalService(
        client=QdrantClient(":memory:"),
        collection_name="phase6_stub_docs",
        embedding_provider=create_embedding_provider(Settings()),
        default_top_k=5,
    )
    service.ingest_source_directory(write_sample_corpus(tmp_path))
    repository = RemediationBundleRepository(db_session)
    orchestrator = RagOrchestrator(retrieval_service=service)

    scan_job, asset, assessment, certificate, cbom_document = build_remediation_fixture()
    db_session.add(scan_job)
    db_session.add(asset)
    db_session.add(assessment)
    db_session.add(certificate)
    db_session.add(cbom_document)
    await db_session.flush()

    bundle = await orchestrator.generate_and_persist(
        remediation_input=RemediationInput(
            asset=asset,
            assessment=assessment,
            cbom_document=cbom_document,
            compliance_tier=ComplianceTier.QUANTUM_VULNERABLE,
        ),
        remediation_repository=repository,
        certificates=[certificate],
    )

    assert bundle is not None
    assert "Hybrid Deployment" in bundle.migration_roadmap
