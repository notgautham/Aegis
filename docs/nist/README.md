# Phase 6 Intelligence Corpus

Place the approved local reference documents for the Phase 6 remediation pipeline in this directory.

## Purpose

The ingestion pipeline in [scripts/ingest_nist_docs.py](/c:/Gautham/VSCode%20projects/Aegis/scripts/ingest_nist_docs.py) reads only local files from `docs/nist/`.

This directory is intentionally local-only:
- no remote fetching is performed by the core pipeline
- missing corpus files should surface as explicit setup errors
- remediation outputs must stay reproducible and grounded in approved documents

## Supported File Types

The current ingestion pipeline supports:
- `.pdf`
- `.txt`
- `.md`

Housekeeping files such as `README.md`, `.gitkeep`, and similar non-source files are ignored by ingestion and validation.

## Validation Commands

After adding or updating the corpus, run:

```powershell
docker compose exec backend python scripts/ingest_nist_docs.py
docker compose exec backend python scripts/validate_ingested_corpus.py
```

## Notes

- Keep only approved, project-relevant source material here.
- Prefer stable filenames so ingestion behavior stays predictable across runs.
- If you replace documents, rerun ingestion so Qdrant reflects the updated corpus.
