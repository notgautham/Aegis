"""
Validate the local Phase 6 corpus and the ingested Qdrant collection.
"""

from __future__ import annotations

import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from qdrant_client import QdrantClient

from backend.core.config import get_settings

SUPPORTED_SUFFIXES = {".pdf", ".txt", ".md"}
IGNORED_FILENAMES = {"readme.md", ".gitkeep", ".ds_store"}


def main() -> None:
    settings = get_settings()
    source_dir = Path(settings.DOCS_SOURCE_DIR)
    files = sorted(path for path in source_dir.glob("*") if path.is_file())
    supported_files = [
        path
        for path in files
        if path.suffix.lower() in SUPPORTED_SUFFIXES and path.name.lower() not in IGNORED_FILENAMES
    ]

    print(f"Corpus directory: {source_dir}")
    print(f"Total files    : {len(files)}")
    print(f"Supported files: {len(supported_files)}")
    for path in supported_files:
        print(f" - {path.name}")

    client = QdrantClient(url=settings.QDRANT_URL)
    collection_name = settings.QDRANT_COLLECTION_NAME
    exists = client.collection_exists(collection_name)
    print(f"Collection     : {collection_name}")
    print(f"Exists         : {exists}")

    if exists:
        info = client.get_collection(collection_name)
        print(f"Status         : {info.status}")
        print(f"Points         : {info.points_count}")
        print(f"Indexed vectors: {info.indexed_vectors_count}")
        vector_size = info.config.params.vectors.size
        print(f"Vector size    : {vector_size}")


if __name__ == "__main__":
    main()
