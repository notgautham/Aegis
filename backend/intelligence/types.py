"""
Shared dataclasses for the Phase 6 intelligence pipeline.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from backend.models.cbom_document import CbomDocument
from backend.models.crypto_assessment import CryptoAssessment
from backend.models.discovered_asset import DiscoveredAsset
from backend.models.enums import ComplianceTier


@dataclass(frozen=True, slots=True)
class RetrievedChunk:
    """One retrieved corpus chunk and its structured metadata."""

    chunk_id: str
    text: str
    score: float | None
    metadata: dict[str, Any]


@dataclass(frozen=True, slots=True)
class CorpusChunk:
    """One embedded chunk prepared for Qdrant ingestion."""

    chunk_id: str
    text: str
    metadata: dict[str, Any]


@dataclass(frozen=True, slots=True)
class RemediationInput:
    """Asset-centric input bundle consumed by the intelligence layer."""

    asset: DiscoveredAsset
    assessment: CryptoAssessment
    cbom_document: CbomDocument
    compliance_tier: ComplianceTier


@dataclass(frozen=True, slots=True)
class HndlTimelineEntry:
    """Per-algorithm HNDL projection."""

    algorithm: str
    logical_qubits: int
    projected_growth_rate: float
    break_year: int
    source: dict[str, Any]


@dataclass(frozen=True, slots=True)
class HndlTimelineResult:
    """Deterministic HNDL output for an asset."""

    entries: tuple[HndlTimelineEntry, ...]
    most_urgent_algorithm: str | None
    urgency: str
    citations: tuple[dict[str, Any], ...] = ()


@dataclass(frozen=True, slots=True)
class PatchArtifact:
    """Deterministic PQC patch output."""

    server_type: str
    hybrid_directive: str
    patch: str
    preserved_cipher: str | None
    prerequisite_notes: tuple[str, ...] = ()


@dataclass(frozen=True, slots=True)
class RoadmapResult:
    """Retrieved-context-grounded migration roadmap."""

    content: str
    citations: dict[str, Any]
    used_deterministic_fallback: bool = False


@dataclass(frozen=True, slots=True)
class IngestionSummary:
    """Structured result of a Qdrant ingestion run."""

    collection_name: str
    documents_ingested: int
    chunks_ingested: int
    vector_size: int


@dataclass(frozen=True, slots=True)
class RemediationArtifacts:
    """Combined Phase 6 artifacts before or after persistence."""

    hndl_timeline: dict[str, Any]
    patch_config: str
    migration_roadmap: str
    source_citations: dict[str, Any] = field(default_factory=dict)
