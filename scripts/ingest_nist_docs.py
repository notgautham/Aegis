"""
Local NIST/reference document ingestion for Phase 6.
"""

from __future__ import annotations

import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from qdrant_client import QdrantClient

from backend.core.config import get_settings
from backend.intelligence.retrieval import RetrievalService, create_embedding_provider
from backend.intelligence.types import IngestionSummary


def ingest_documents(*, source_dir: Path | None = None) -> IngestionSummary:
    """Ingest the configured local corpus directory into Qdrant."""
    settings = get_settings()
    resolved_source_dir = source_dir or Path(settings.DOCS_SOURCE_DIR)
    client = QdrantClient(url=settings.QDRANT_URL)
    service = RetrievalService(
        client=client,
        collection_name=settings.QDRANT_COLLECTION_NAME,
        embedding_provider=create_embedding_provider(settings),
        default_top_k=settings.RAG_TOP_K,
    )
    return service.ingest_source_directory(resolved_source_dir, recreate_collection=True)


def main() -> None:
    summary = ingest_documents()
    print(
        "Ingested "
        f"{summary.documents_ingested} documents and {summary.chunks_ingested} chunks "
        f"into {summary.collection_name} (vector size {summary.vector_size})."
    )


if __name__ == "__main__":
    main()
