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
- **Python 3.11** (for local host-side tooling and tests; container already uses Python 3.11)
- **API Keys (Optional):** Groq/Jina/OpenRouter/Cohere keys are optional in local mode. The project works in deterministic local/offline mode without cloud keys.

## 1. Environment Configuration

Clone the repository and initialize your environment:

```bash
git clone https://github.com/notgautham/Aegis.git
cd Aegis
cp .env.example .env
```

Edit `.env` if needed. By default, local mode is enabled and cloud keys are commented out.

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

Alternative simulation modes:
```bash
docker compose exec backend python simulation/run.py --target sc.com --full-port-scan
docker compose exec backend python simulation/run.py --target sc.com --format json
```

Score note:
- `risk_score` is the deterministic backend risk value (higher is worse)
- `q_score` is the dashboard readiness score (higher is better)
- relation: `q_score = 100 - risk_score`

Dashboard scan mode note:
- The Quantum Readiness Scanner prompt accepts a **single target** URL/domain per run.
- The post-login default landing page is `/scanner`.
- Pressing Enter in the scanner input immediately starts the scan.
- The prompt includes a **Full Port Scan** toggle.
- Disabled: bounded fast scan.
- Enabled: bounded scan first, then full TCP sweep (1-65535).
- The prompt includes a **Subdomain Enumeration** toggle:
	- Enabled: full Amass-driven enumeration.
	- Disabled: root + `www` hostname path only.
- If Amass is unavailable in the runtime, enumeration automatically falls back to Certificate Transparency (`crt.sh`) discovery and deterministic hostname expansion.
- During active queue scans, live logs retain extended history for long-running troubleshooting.
- Discovery graph view auto-fits the current scan network so larger topologies remain visible.
- Discovery graph supports zoom controls for dense multi-asset scopes.
- Scan history and all-time discovery timelines are intentionally bounded/on-demand to keep dashboard navigation responsive for large scans.
- Profiles (`Quick`, `Standard`, `Deep`, `PQC Focus`) define strategy depth and are separate from the two coverage toggles above.

## Monitoring and Logs

- **Engine/Scanning Logs:** `docker compose logs -f backend`
- **Frontend/UI Logs:** `docker compose logs -f frontend`
- **Interactive Debugging:** Check the browser **Console** (F12) for real-time graph mapping data.

## Related Documentation

- [README.md](./README.md)
- [documentations/DATABASE.md](./documentations/DATABASE.md)
- [documentations/API.md](./documentations/API.md)
- [documentations/CONTEXT.md](./documentations/CONTEXT.md)
