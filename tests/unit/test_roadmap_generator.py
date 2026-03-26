"""
Unit tests for retrieved-context-grounded roadmap generation.
"""

from __future__ import annotations

import httpx
import pytest

from backend.core.config import Settings
from backend.intelligence.patch_generator import PatchGenerator
from backend.intelligence.roadmap_generator import (
    RoadmapGenerationError,
    RoadmapGenerator,
)
from backend.intelligence.types import RemediationInput, RetrievedChunk
from backend.models.enums import ComplianceTier
from tests.unit._phase6_helpers import build_remediation_fixture
from backend.intelligence.hndl_calculator import HndlCalculator


def test_generation_requires_retrieval_context() -> None:
    _, asset, assessment, _, cbom_document = build_remediation_fixture()
    remediation_input = RemediationInput(
        asset=asset,
        assessment=assessment,
        cbom_document=cbom_document,
        compliance_tier=ComplianceTier.QUANTUM_VULNERABLE,
    )

    with pytest.raises(RoadmapGenerationError, match="Retrieved context is required"):
        RoadmapGenerator(settings=Settings()).generate(
            remediation_input=remediation_input,
            retrieved_chunks=(),
            hndl_timeline=HndlCalculator(current_year=2026).calculate(assessment=assessment),
            patch=PatchGenerator().generate(
                server_software=asset.server_software,
                enc_algorithm=assessment.enc_algorithm,
            ),
        )


def test_deterministic_fallback_mode_works_without_cloud_llm() -> None:
    _, asset, assessment, _, cbom_document = build_remediation_fixture()
    remediation_input = RemediationInput(
        asset=asset,
        assessment=assessment,
        cbom_document=cbom_document,
        compliance_tier=ComplianceTier.QUANTUM_VULNERABLE,
    )
    retrieved_chunks = (
        RetrievedChunk(
            chunk_id="chunk-1",
            text="Use X25519MLKEM768 during hybrid deployment.",
            score=0.9,
            metadata={
                "title": "FIPS 203",
                "section": "Hybrid Deployment",
                "path": "docs/nist/fips203.md",
            },
        ),
    )

    result = RoadmapGenerator(
        settings=Settings(LLM_PROVIDER_MODE="deterministic")
    ).generate(
        remediation_input=remediation_input,
        retrieved_chunks=retrieved_chunks,
        hndl_timeline=HndlCalculator(current_year=2026).calculate(assessment=assessment),
        patch=PatchGenerator().generate(
            server_software=asset.server_software,
            enc_algorithm=assessment.enc_algorithm,
        ),
    )

    assert result.used_deterministic_fallback is True
    assert "Preparation / Prerequisites" in result.content
    assert result.citations["documents"][0]["title"] == "FIPS 203"


def test_provider_timeout_falls_back_to_deterministic_stub() -> None:
    class TimeoutRoadmapGenerator(RoadmapGenerator):
        def _generate_with_provider(self, **kwargs) -> str:
            raise httpx.TimeoutException("simulated timeout")

    _, asset, assessment, _, cbom_document = build_remediation_fixture()
    remediation_input = RemediationInput(
        asset=asset,
        assessment=assessment,
        cbom_document=cbom_document,
        compliance_tier=ComplianceTier.QUANTUM_VULNERABLE,
    )
    retrieved_chunks = (
        RetrievedChunk(
            chunk_id="chunk-1",
            text="Preserve AES-256-GCM while migrating.",
            score=0.8,
            metadata={"title": "Roadmap", "path": "docs/nist/roadmap.txt"},
        ),
    )

    result = TimeoutRoadmapGenerator(
        settings=Settings(
            LLM_PROVIDER_MODE="cloud",
            OPENROUTER_API_KEY="test-key",
        )
    ).generate(
        remediation_input=remediation_input,
        retrieved_chunks=retrieved_chunks,
        hndl_timeline=HndlCalculator(current_year=2026).calculate(assessment=assessment),
        patch=PatchGenerator().generate(
            server_software=asset.server_software,
            enc_algorithm=assessment.enc_algorithm,
        ),
    )

    assert result.used_deterministic_fallback is True
    assert "Full PQC Replacement" in result.content
