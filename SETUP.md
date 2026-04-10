# Aegis Setup Guide

This guide explains how to bring up Aegis on a new machine after cloning the repo.

It covers:

- required local tools
- environment variables
- Docker services
- PostgreSQL initialization
- Qdrant corpus ingestion
- frontend startup
- first-scan verification

## What Runs Where

Aegis is split into two main parts:

- backend services in Docker
  - FastAPI backend
  - PostgreSQL 15
  - Qdrant
  - pgAdmin
- frontend in Docker
  - Vite + React + TypeScript app

Default local ports:

- frontend: `http://localhost:3000`
- backend API: `http://localhost:8000`
- backend Swagger/OpenAPI docs: `http://localhost:8000/docs`
- PostgreSQL: `localhost:5432`
- Qdrant: `localhost:6333`
- pgAdmin: `http://localhost:5050`

## Prerequisites

Install these first:

- Git
- Docker Desktop (Works seamlessly across Windows, macOS, and Linux)

*Note for Windows users:* All commands below use standard `bash` syntax. We highly recommend running them in **Git Bash**, **WSL (Windows Subsystem for Linux)**, or **PowerShell** (with Docker Desktop installed and integrated).

You also need API keys for the cloud intelligence path:

- Jina AI for embeddings
- Groq for the primary LLM
- optional fallback keys:
  - OpenRouter
  - Cohere

## 1. Clone the Repository

```bash
git clone https://github.com/notgautham/Aegis.git
cd Aegis
```

## 2. Create `.env`

Copy [`.env.example`](./.env.example) to `.env`.

```bash
Copy-Item .env.example .env
```

At minimum, set real values for:

- `GROQ_API_KEY`
- `JINA_API_KEY`

Important environment variables:

```ini
DATABASE_URL=postgresql+asyncpg://aegis:aegis@postgres:5432/aegis
QDRANT_URL=http://qdrant:6333
QDRANT_COLLECTION_NAME=aegis_nist_docs
DOCS_SOURCE_DIR=docs/nist

SECRET_KEY=change-me-in-production
PROJECT_NAME=Aegis
API_V1_STR=/api/v1
SKIP_ENUMERATION=true

EMBEDDING_PROVIDER_MODE=cloud
LLM_PROVIDER_MODE=cloud
RAG_TOP_K=5
LLM_TIMEOUT_SECONDS=20.0
EMBEDDING_TIMEOUT_SECONDS=20.0

GROQ_BASE_URL=https://api.groq.com/openai/v1
GROQ_API_KEY=REPLACE_WITH_REAL_GROQ_API_KEY
GROQ_MODEL=qwen/qwen3-32b

JINA_BASE_URL=https://api.jina.ai/v1
JINA_API_KEY=REPLACE_WITH_REAL_JINA_API_KEY
JINA_EMBEDDING_MODEL=jina-embeddings-v3

OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
OPENROUTER_API_KEY=
OPENROUTER_MODEL=google/gemma-3-27b-it
OPENROUTER_EMBEDDING_MODEL=text-embedding-3-small

COHERE_BASE_URL=https://api.cohere.com/v2
COHERE_API_KEY=
COHERE_EMBEDDING_MODEL=embed-english-v3.0

CERT_ISSUER_COMMON_NAME=Aegis Compliance CA
CERT_ISSUER_ORGANIZATION=Aegis
CERT_ISSUER_ORG_UNIT=Quantum Compliance
CERT_RUNTIME_DIR=.aegis-runtime/certs
```

Notes:

- `EMBEDDING_PROVIDER_MODE` and `LLM_PROVIDER_MODE` should remain `cloud` for the current setup.
- Without a valid embedding key, Qdrant ingestion and remediation retrieval will not work.
- Without a valid LLM key, remediation roadmap and patch generation will be degraded or fail.

## 3. Start Docker Services

From the project root:

```bash
docker compose up -d --build
```

This starts:

- `aegis-backend`
- `aegis-postgres`
- `aegis-qdrant`
- `aegis-pgadmin`

Check status:

```bash
docker compose ps
```

## 4. Verify the PQC Runtime

The backend image uses the OQS-patched OpenSSL build.

Verify the provider is present:

```bash
docker exec aegis-backend openssl-oqs list -providers
```

You should see `oqsprovider` in the output.

## 5. Initialize PostgreSQL

Apply Alembic migrations:

```bash
docker compose exec backend alembic upgrade head
```

Check migration state if needed:

```bash
docker compose exec backend alembic current
```

Important note:

- the repo's Alembic history currently contains the initial migration, while the live application code expects additional later tables and columns documented in [DATABASE.md](./DATABASE.md)
- if you are bringing up a completely fresh database, verify that the runtime schema matches the current ORM models

## 6. Ingest the Qdrant Corpus

Aegis does not ingest the remediation corpus on every scan.

Instead:

- source files live under [docs/nist](./docs/nist)
- you ingest them into Qdrant once during setup
- scans then query the stored vectors in Qdrant

Run ingestion:

```bash
docker compose exec backend python scripts/ingest_nist_docs.py
```

Validate the corpus and collection:

```bash
docker compose exec backend python scripts/validate_ingested_corpus.py
```

What this does:

- reads supported files from `docs/nist`
- generates embeddings using the configured cloud embedding provider
- recreates the `aegis_nist_docs` collection
- writes all document chunks into Qdrant

You should rerun ingestion when:

- setting up on a new machine
- changing the files in `docs/nist`
- changing the embedding model
- rebuilding the collection from scratch

## 7. Verify the Backend

Health check:

```bash
curl http://localhost:8000/health
```

Expected response:

```json
{"status":"ok"}
```

You can also open:

- Swagger UI: `http://localhost:8000/docs`

## 8. Sign In

The current frontend auth is still a prototype local gate, not real backend auth.

Current demo login behavior:

- email must contain `aegis` or `pnb`
- password must be `aegis2026`

Example:

- email: `demo@aegis.bank`
- password: `aegis2026`

## 9. Run a First Scan

You can start a scan from the UI or directly against the API.

Example API call:

```bash
curl -X POST http://localhost:8000/api/v1/scan \
  -H "Content-Type: application/json" \
  -d '{"target":"testssl.sh"}'
```

Poll status:

```bash
curl http://localhost:8000/api/v1/scan/<scan-id>
```

Fetch compiled results after completion:

```bash
curl http://localhost:8000/api/v1/scan/<scan-id>/results
```

## 10. Optional Validation Queries

Inspect tables in Postgres:

```bash
docker compose exec postgres psql -U aegis -d aegis -c "\dt"
```

Inspect recent scans:

```bash
docker compose exec postgres psql -U aegis -d aegis -c "select id, target, status, created_at, completed_at from scan_jobs order by created_at desc limit 20;"
```

Check Qdrant collection status:

```bash
docker compose exec backend python scripts/validate_ingested_corpus.py
```

## pgAdmin

Open:

- `http://localhost:5050`

Default login from [docker-compose.yml](./docker-compose.yml):

- email: `admin@aegis.com`
- password: `admin`

## Common Operational Commands

Restart backend after changing backend code or `.env`:

```bash
docker compose restart backend
```

View recent backend logs:

```bash
docker compose logs backend --tail=200
```

Rebuild backend image:

```bash
docker compose up -d --build backend
```

Re-run corpus ingestion:

```bash
docker compose exec backend python scripts/ingest_nist_docs.py
```

## Troubleshooting

### `curl http://localhost:8000/health` hangs or fails

Check:

- `docker compose ps`
- `docker compose logs backend --tail=200`
- whether the backend has valid cloud-provider keys in `.env`

### Remediation features are empty or failing

Check:

- Qdrant is running
- corpus ingestion completed successfully
- embedding keys are valid
- the collection vector size matches the active embedding model

### `npm ci` fails with `EPERM` on `esbuild.exe`

That usually means `node_modules/@esbuild/win32-x64/esbuild.exe` is locked by:

- a running Vite dev server
- another Node process
- VS Code or antivirus

Stop frontend processes, then rerun `npm ci`.

### Frontend opens but data looks stale

Check:

- the backend is reachable at `localhost:8000`
- the selected scan is a real UUID-backed scan
- the latest scan completed successfully

## Related Files

- [README.md](./README.md)
- [DATABASE.md](./DATABASE.md)
- [API.md](./API.md)
- [docs/nist/README.md](./docs/nist/README.md)
