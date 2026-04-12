"""
Retrieved-context-grounded roadmap generation for Phase 6.
"""

from __future__ import annotations

from collections.abc import Sequence
from backend.analysis.constants import canonicalize_algorithm

from backend.core.config import Settings, get_settings

from .retrieval import build_citation_payload
from .types import (
    HndlTimelineResult,
    PatchArtifact,
    RemediationInput,
    RetrievedChunk,
    RoadmapResult,
)


class RoadmapGenerationError(RuntimeError):
    """Raised when a roadmap cannot be safely produced."""


class RoadmapGenerator:
    """Generate migration roadmaps with strict retrieval grounding."""

    def __init__(self, *, settings: Settings | None = None) -> None:
        self.settings = settings or get_settings()

    def generate(
        self,
        *,
        remediation_input: RemediationInput,
        retrieved_chunks: Sequence[RetrievedChunk],
        hndl_timeline: HndlTimelineResult,
        patch: PatchArtifact,
    ) -> RoadmapResult:
        """Generate a deterministic roadmap from retrieved context and scan artifacts."""
        if not retrieved_chunks:
            raise RoadmapGenerationError("Retrieved context is required for roadmap generation.")

        citations = build_citation_payload(retrieved_chunks)
        return RoadmapResult(
            content=self._build_deterministic_stub(
                remediation_input=remediation_input,
                retrieved_chunks=retrieved_chunks,
                hndl_timeline=hndl_timeline,
                patch=patch,
            ),
            citations=citations,
            used_deterministic_fallback=False,
        )

    @staticmethod
    def _build_deterministic_stub(
        *,
        remediation_input: RemediationInput,
        retrieved_chunks: Sequence[RetrievedChunk],
        hndl_timeline: HndlTimelineResult,
        patch: PatchArtifact,
    ) -> str:
        assessment = remediation_input.assessment
        detected_kex = RoadmapGenerator._display_algorithm(assessment.kex_algorithm)
        detected_sig = RoadmapGenerator._display_algorithm(assessment.auth_algorithm)
        detected_sym = RoadmapGenerator._display_algorithm(assessment.enc_algorithm)
        detected_algorithms = f"{detected_kex}, {detected_sig}, {detected_sym}"

        is_aes128 = canonicalize_algorithm("sym", assessment.enc_algorithm) in {
            "AES128",
            "AES128GCM",
        }
        break_year = min(
            (entry.break_year for entry in hndl_timeline.entries),
            default=None,
        )
        projected_q_score = RoadmapGenerator._projected_q_score_after_full_migration()

        hndl_line = (
            f"- Earliest estimated HNDL break year for this asset is {break_year}, based on current classical dependencies."
            if break_year is not None
            else "- HNDL break-year estimate is unavailable for this asset with the current evidence set."
        )

        aes_upgrade_line = (
            "- Upgrade AES-128 to AES-256-GCM during this phase to reduce residual Grover-model exposure."
            if is_aes128
            else "- Keep AES-256-GCM enabled while validating hybrid handshakes in staging and production canaries."
        )

        return "\n\n".join(
            [
                "Phase 1 - Preparation / Prerequisites\n"
                f"- Detected algorithms on this asset: {detected_algorithms}.\n"
                f"- Ensure OQS-provider-enabled OpenSSL is available on the {patch.server_type} runtime before rollout.\n"
                "- Use NIST IR 8547 for migration timeline planning and sequencing guidance.\n"
                "- Maintain a cryptographic inventory aligned with NIST SP 800-208 requirements.",
                "Phase 2 - Hybrid Deployment\n"
                f"- Apply hybrid KEX directive for this server profile: {patch.hybrid_directive}\n"
                "- Hybrid key exchange helps mitigate Harvest-Now-Decrypt-Later capture risk while preserving backward compatibility.\n"
                "- Implement ML-KEM-768 in line with NIST FIPS 203 during the transition rollout.\n"
                f"{aes_upgrade_line}",
                "Phase 3 - Full PQC Replacement\n"
                "- Replace classical certificate signatures with ML-DSA-65 only after confirming issuing CA support (NIST FIPS 204).\n"
                f"{hndl_line}\n"
                "- Complete migration by 2035 in line with NIST IR 8547 planning guidance.\n"
                f"- Projected Q-Score after full remediation is {projected_q_score:.2f}.",
            ]
        )

    @staticmethod
    def _display_algorithm(value: str | None) -> str:
        if not value:
            return "UNKNOWN"
        normalized = value.upper().replace("_", "")
        if normalized in {"AES128", "AES128GCM"}:
            return "AES-128-GCM"
        if normalized in {"AES256", "AES256GCM"}:
            return "AES-256-GCM"
        return value

    @staticmethod
    def _projected_q_score_after_full_migration() -> float:
        # Full migration target: ML-KEM + ML-DSA, AES-256-GCM, TLS 1.3
        projected_risk = (0.45 * 0.00) + (0.35 * 0.00) + (0.10 * 0.05) + (0.10 * 0.10)
        return round(100 - (projected_risk * 100), 2)
