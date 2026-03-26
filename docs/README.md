# Phase 6 Intelligence Corpus

Place the approved local reference documents for the Phase 6 remediation pipeline in this directory.

## Purpose

The ingestion pipeline in [scripts/ingest_nist_docs.py](/c:/Gautham/VSCode%20projects/Aegis/scripts/ingest_nist_docs.py) reads only local files from `docs/nist/`.

This directory is intentionally local-only:
- no remote fetching is performed by the core pipeline
- missing corpus files should surface as explicit setup errors
- remediation outputs must stay reproducible and grounded in approved documents

## Expected Source Material

Add the project-approved source files here, such as:
- `fips203.pdf`
- `fips204.pdf`
- `fips205.pdf`
- `sp800-208.pdf`
- `ir8547.pdf`
- approved qubit roadmap references
- approved hybrid KEX guidance or drafts

## Supported File Types

The current ingestion pipeline supports:
- `.pdf`
- `.txt`
- `.md`

## After Adding Documents

Run the ingestion command inside Docker:

```powershell
docker compose exec backend python scripts/ingest_nist_docs.py
```

## Notes

- Keep only approved, project-relevant source material here.
- Prefer stable filenames so ingestion behavior stays predictable across runs.
- If you replace documents, rerun ingestion so Qdrant reflects the updated corpus.
