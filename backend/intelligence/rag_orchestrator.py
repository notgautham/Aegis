"""
Phase 6 orchestration for retrieval-grounded remediation generation.
"""

from __future__ import annotations

from collections.abc import Sequence
from typing import Any

from backend.models.certificate_chain import CertificateChain
from backend.models.enums import ComplianceTier
from backend.repositories.remediation_repo import RemediationBundleRepository

from .hndl_calculator import HndlCalculator
from .patch_generator import PatchGenerator
from .roadmap_generator import RoadmapGenerator
from .retrieval import RetrievalService, build_citation_payload
from .types import RemediationArtifacts, RemediationInput, RetrievedChunk


class RagOrchestrationError(RuntimeError):
    """Raised when the intelligence pipeline cannot produce grounded output."""


class RagOrchestrator:
    """Coordinate Phase 6 retrieval, deterministic logic, and persistence."""

    def __init__(
        self,
        *,
        retrieval_service: RetrievalService,
        hndl_calculator: HndlCalculator | None = None,
        patch_generator: PatchGenerator | None = None,
        roadmap_generator: RoadmapGenerator | None = None,
    ) -> None:
        self.retrieval_service = retrieval_service
        self.hndl_calculator = hndl_calculator or HndlCalculator()
        self.patch_generator = patch_generator or PatchGenerator()
        self.roadmap_generator = roadmap_generator or RoadmapGenerator()

    async def generate_and_persist(
        self,
        *,
        remediation_input: RemediationInput,
        remediation_repository: RemediationBundleRepository,
        certificates: Sequence[CertificateChain] = (),
        top_k: int | None = None,
    ):
        """Generate and persist remediation artifacts for Tier 2/Tier 3 assets."""
        if remediation_input.compliance_tier is ComplianceTier.FULLY_QUANTUM_SAFE:
            return None

        query = self._build_query(remediation_input)
        retrieved_chunks = self.retrieval_service.search(query, top_k=top_k)
        if not retrieved_chunks:
            raise RagOrchestrationError("No retrieval context was found for remediation generation.")

        hndl_timeline = self.hndl_calculator.calculate(
            assessment=remediation_input.assessment,
            cbom_document=remediation_input.cbom_document,
            certificates=certificates,
        )
        patch = self.patch_generator.generate(
            server_software=remediation_input.asset.server_software,
            enc_algorithm=remediation_input.assessment.enc_algorithm,
        )
        roadmap = self.roadmap_generator.generate(
            remediation_input=remediation_input,
            retrieved_chunks=retrieved_chunks,
            hndl_timeline=hndl_timeline,
            patch=patch,
        )
        artifacts = self._serialize_artifacts(
            retrieved_chunks=retrieved_chunks,
            hndl_timeline=hndl_timeline,
            patch=patch,
            roadmap=roadmap,
        )
        return await remediation_repository.create(
            asset_id=remediation_input.asset.id,
            hndl_timeline=artifacts.hndl_timeline,
            patch_config=artifacts.patch_config,
            migration_roadmap=artifacts.migration_roadmap,
            source_citations=artifacts.source_citations,
        )

    @staticmethod
    def _build_query(remediation_input: RemediationInput) -> str:
        return " ".join(
            part
            for part in [
                remediation_input.asset.server_software or "generic server",
                remediation_input.assessment.kex_algorithm or "",
                remediation_input.assessment.auth_algorithm or "",
                remediation_input.assessment.enc_algorithm or "",
                remediation_input.compliance_tier.value,
                "post quantum cryptography migration remediation guidance",
            ]
            if part
        )

    def _serialize_artifacts(
        self,
        *,
        retrieved_chunks: Sequence[RetrievedChunk],
        hndl_timeline,
        patch,
        roadmap,
    ) -> RemediationArtifacts:
        citations = build_citation_payload(retrieved_chunks)
        hndl_entries = [
            {
                "algorithm": entry.algorithm,
                "logicalQubits": entry.logical_qubits,
                "projectedGrowthRate": entry.projected_growth_rate,
                "breakYear": entry.break_year,
                "source": entry.source,
            }
            for entry in hndl_timeline.entries
        ]
        return RemediationArtifacts(
            hndl_timeline={
                "urgency": hndl_timeline.urgency,
                "mostUrgentAlgorithm": hndl_timeline.most_urgent_algorithm,
                "entries": hndl_entries,
            },
            patch_config=patch.patch,
            migration_roadmap=roadmap.content,
            source_citations=self._merge_citations(
                citations,
                tuple(hndl_timeline.citations),
            ),
        )

    @staticmethod
    def _merge_citations(
        retrieval_citations: dict[str, Any],
        hndl_citations: tuple[dict[str, Any], ...],
    ) -> dict[str, Any]:
        documents = list(retrieval_citations.get("documents", []))
        seen = {
            (
                document.get("title"),
                document.get("section"),
                document.get("page"),
                document.get("path"),
            )
            for document in documents
        }
        for citation in hndl_citations:
            normalized = {
                "title": citation.get("title"),
                "section": citation.get("section"),
                "page": citation.get("page"),
                "path": citation.get("path"),
                "excerpt": citation.get("excerpt"),
            }
            key = (
                normalized.get("title"),
                normalized.get("section"),
                normalized.get("page"),
                normalized.get("path"),
            )
            if key not in seen:
                seen.add(key)
                documents.append(normalized)
        return {"documents": documents}
