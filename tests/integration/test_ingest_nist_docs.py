"""
Integration tests for local Phase 6 corpus ingestion.
"""

from __future__ import annotations

from pathlib import Path

from qdrant_client import QdrantClient

from backend.core.config import Settings
from backend.intelligence.retrieval import RetrievalService, create_embedding_provider
from scripts import ingest_nist_docs
from tests.unit._phase6_helpers import write_sample_corpus


def test_ingest_sample_corpus_into_qdrant(tmp_path: Path) -> None:
    corpus_dir = write_sample_corpus(tmp_path)
    service = RetrievalService(
        client=QdrantClient(":memory:"),
        collection_name="phase6_ingest_docs",
        embedding_provider=create_embedding_provider(Settings()),
        default_top_k=5,
    )

    summary = service.ingest_source_directory(corpus_dir, recreate_collection=True)
    results = service.search("rsa logical qubits")

    assert summary.documents_ingested >= 2
    assert summary.chunks_ingested >= 2
    assert results
    assert results[0].metadata["path"].endswith((".txt", ".md"))


def test_ingest_script_uses_local_corpus_and_returns_summary(
    tmp_path: Path,
    monkeypatch,
) -> None:
    corpus_dir = write_sample_corpus(tmp_path)
    in_memory_client = QdrantClient(":memory:")
    settings = Settings(QDRANT_COLLECTION_NAME="phase6_script_docs")

    monkeypatch.setattr(ingest_nist_docs, "QdrantClient", lambda *args, **kwargs: in_memory_client)
    monkeypatch.setattr(ingest_nist_docs, "get_settings", lambda: settings)

    summary = ingest_nist_docs.ingest_documents(source_dir=corpus_dir)

    assert summary.collection_name == "phase6_script_docs"
    assert summary.documents_ingested >= 2
