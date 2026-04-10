# Aegis Setup Guide

This guide provides the instructions to deploy the Aegis platform.

## Architecture

Aegis is fully containerized. Running the stack brings up the following services:

- **aegis-backend:** FastAPI engine + OQS-OpenSSL (Port `8000`)
- **aegis-frontend:** React UI with Hot-Reloading (Port `3000`)
- **aegis-postgres:** PostgreSQL 15 + **Apache AGE** (Graph Database)
- **aegis-qdrant:** Vector Database for NIST intelligence
- **aegis-pgadmin:** Database management UI (Port `5050`)

## Prerequisites

- **Git**
- **Docker Desktop** (Required for all platforms)
- **API Keys:** You will need keys for **Groq** (LLM) and **Jina AI** (Embeddings) to enable the intelligence layer.

## 1. Environment Configuration

Clone the repository and initialize your environment:

```bash
git clone https://github.com/notgautham/Aegis.git
cd Aegis
cp .env.example .env
```

Edit `.env` and provide your real API keys for `GROQ_API_KEY` and `JINA_API_KEY`.

## 2. Launching the Stack

Start all services in detached mode:

```bash
docker compose up -d --build
```

**Note on Persistence:** Aegis uses Docker volumes for Postgres, Apache AGE, and Qdrant. Once the stack has been initialized and data has been ingested or scanned, it will persist across container restarts.

## 3. Database & Intelligence Initialization

Run these commands **once** to prepare the fresh environment:

### Relational Schema
```bash
docker compose exec backend alembic upgrade head
```

### Intelligence Corpus (Vector Ingestion)
The platform comes with NIST documents in `docs/nist`. To load them into the vector database:
```bash
docker compose exec backend python scripts/ingest_nist_docs.py
```

## 4. Verification

Access the UI at [http://localhost:3000](http://localhost:3000).

**Credentials:**
- Email: `demo@aegis.bank`
- Password: `aegis2026`

**Terminal Validation:**
To run a scan directly from your terminal and verify the engine logic:
```bash
docker compose exec backend python simulation/run.py --target sc.com --skip-enumeration
```

## Monitoring and Logs

- **Engine/Scanning Logs:** `docker compose logs -f backend`
- **Frontend/UI Logs:** `docker compose logs -f frontend`
- **Interactive Debugging:** Check the browser **Console** (F12) for real-time graph mapping data.

## Related Documentation

- [README.md](./README.md)
- [DATABASE.md](./DATABASE.md)
- [API.md](./API.md)
