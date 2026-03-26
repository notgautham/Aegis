"""
Unit tests for Phase 6 orchestration and persistence payload assembly.
"""

from __future__ import annotations

from types import SimpleNamespace

import pytest

from backend.intelligence.rag_orchestrator import RagOrchestrator
from backend.intelligence.retrieval import RetrievalService, create_embedding_provider
from backend.intelligence.types import RemediationInput
from backend.models.enums import ComplianceTier
from backend.core.config import Settings
from qdrant_client import QdrantClient
from tests.unit._phase6_helpers import build_remediation_fixture, write_sample_corpus


class _FakeRemediationRepository:
    def __init__(self) -> None:
        self.created_payload: dict | None = None

    async def create(self, **kwargs):
        self.created_payload = kwargs
        return SimpleNamespace(**kwargs)


@pytest.mark.asyncio
async def test_tier1_short_circuits_without_persistence(tmp_path) -> None:
    _, asset, assessment, certificate, cbom_document = build_remediation_fixture(
        tier=ComplianceTier.FULLY_QUANTUM_SAFE,
        kex_algorithm="MLKEM768",
        auth_algorithm="ML-DSA-65",
    )
    remediation_input = RemediationInput(
        asset=asset,
        assessment=assessment,
        cbom_document=cbom_document,
        compliance_tier=ComplianceTier.FULLY_QUANTUM_SAFE,
    )
    service = RetrievalService(
        client=QdrantClient(":memory:"),
        collection_name="phase6_orchestrator_tier1",
        embedding_provider=create_embedding_provider(Settings()),
        default_top_k=5,
    )
    service.ingest_source_directory(write_sample_corpus(tmp_path))

    repository = _FakeRemediationRepository()
    result = await RagOrchestrator(retrieval_service=service).generate_and_persist(
        remediation_input=remediation_input,
        remediation_repository=repository,
        certificates=[certificate],
    )

    assert result is None
    assert repository.created_payload is None


@pytest.mark.asyncio
async def test_tier2_and_tier3_generate_expected_persistence_payloads(tmp_path) -> None:
    service = RetrievalService(
        client=QdrantClient(":memory:"),
        collection_name="phase6_orchestrator_docs",
        embedding_provider=create_embedding_provider(Settings()),
        default_top_k=5,
    )
    service.ingest_source_directory(write_sample_corpus(tmp_path))
    orchestrator = RagOrchestrator(retrieval_service=service)

    cases = [
        (
            ComplianceTier.QUANTUM_VULNERABLE,
            dict(server_software="nginx", kex_algorithm="ECDHE", auth_algorithm="RSA"),
            "ssl_ecdh_curve X25519MLKEM768:X25519;",
        ),
        (
            ComplianceTier.PQC_TRANSITIONING,
            dict(
                server_software="apache",
                kex_algorithm="X25519_MLKEM768",
                auth_algorithm="ML-DSA-65",
            ),
            "SSLOpenSSLConfCmd Curves X25519MLKEM768:X25519",
        ),
    ]

    for tier, overrides, expected_patch_line in cases:
        _, asset, assessment, certificate, cbom_document = build_remediation_fixture(
            tier=tier,
            server_software=overrides["server_software"],
            kex_algorithm=overrides["kex_algorithm"],
            auth_algorithm=overrides["auth_algorithm"],
        )
        remediation_input = RemediationInput(
            asset=asset,
            assessment=assessment,
            cbom_document=cbom_document,
            compliance_tier=tier,
        )
        repository = _FakeRemediationRepository()

        result = await orchestrator.generate_and_persist(
            remediation_input=remediation_input,
            remediation_repository=repository,
            certificates=[certificate],
        )

        assert expected_patch_line in result.patch_config
        assert "Preparation / Prerequisites" in result.migration_roadmap
        assert result.hndl_timeline["urgency"] in {"HIGH", "LOW"}
        assert repository.created_payload is not None
        assert repository.created_payload["source_citations"]["documents"]
