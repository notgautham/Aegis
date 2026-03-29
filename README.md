# Aegis

Quantum-readiness assessment and remediation command platform for banking infrastructure.

> Discover public cryptographic surfaces, generate CBOM evidence, classify post-quantum readiness, produce remediation guidance, and issue compliance certificates from one scan-centric workflow.

## Overview

Aegis is built for the **Harvest Now, Decrypt Later (HNDL)** problem. It helps security teams identify which internet-facing banking assets still rely on classical cryptography that becomes unsafe in a post-quantum future, then turns that assessment into operator-ready evidence:

- discovery of public-facing cryptographic assets
- deterministic quantum-risk scoring
- CycloneDX 1.6 Cryptographic Bill of Materials (CBOM) generation
- NIST-aligned PQC readiness classification
- remediation bundle generation with HNDL timeline context
- compliance certificate issuance
- operator, engineer, and executive reporting surfaces

The platform is intentionally **scan-centric**:
- a scan is the primary unit of execution and truth
- results, reports, artifacts, and workbenches all resolve from a specific scan
- saved targets are only a lightweight frontend usability layer

## Why Aegis

Banks increasingly expose APIs, gateways, VPN endpoints, and web services to the public internet. Those surfaces often still rely on:

- RSA
- ECDH
- ECDSA
- legacy TLS configurations

Those algorithms are vulnerable to quantum attacks driven by Shor's algorithm. Aegis exists to answer the questions teams actually need answered:

- what cryptographic assets are exposed?
- how risky are they?
- which ones should be fixed first?
- what remediation path is appropriate?
- can we produce evidence that an asset is quantum ready?

## What The Product Does

### Discovery
- enumerates public-facing assets from a target domain, IP, or CIDR
- validates DNS
- scans relevant ports
- probes TLS posture
- extracts certificate chain details

### Analysis
- parses TLS metadata and certificate posture
- computes a deterministic quantum-risk score
- evaluates readiness against a deterministic PQC compliance engine

### Evidence
- generates CycloneDX 1.6 CBOM documents
- stores compiled scan results and artifact references
- issues compliance certificates with custom PQC-related extensions

### Remediation
- computes HNDL timeline context
- generates migration guidance and patch configuration
- links remediation artifacts directly to risky assets

### Presentation
- Mission Control dashboard for scan launch and portfolio posture
- Risk Heatmap for scan-wide prioritization
- Asset Inventory for scan-scoped asset review
- Asset Workbench for deep technical investigation
- Reports page with engineer and executive views
- History page for recent scan timeline review

## Core Principles

- **Deterministic security logic:** PQC classification and scoring are not delegated to an LLM.
- **Ground-truth rendering:** frontend routes render backend-provided state and artifacts rather than inventing metrics.
- **Scan-centric architecture:** target convenience exists, but the system remains scan-first.
- **Evidence-first output:** CBOM, certificates, remediation bundles, and reports are first-class deliverables.

## Tech Stack

### Backend
- Python 3.11
- FastAPI
- SQLAlchemy async ORM
- PostgreSQL 15
- Qdrant

### Discovery and crypto
- sslyze
- pyOpenSSL / cryptography
- liboqs / OQS-enabled OpenSSL
- Amass
- DNSx
- python-nmap

### Frontend
- Next.js 14
- TypeScript
- Tailwind CSS
- local shadcn-style UI primitives

### Infrastructure
- Docker Desktop
- Docker Compose

## System Architecture

The high-level pipeline is:

1. **Scan request**
2. **Discovery**
3. **Cryptographic analysis**
4. **CBOM generation**
5. **PQC classification**
6. **Remediation bundle generation when needed**
7. **Compliance certificate issuance**
8. **Compiled results exposed through API and UI**

Primary backend layers:

- `backend/discovery/`
- `backend/analysis/`
- `backend/compliance/`
- `backend/cbom/`
- `backend/intelligence/`
- `backend/cert/`
- `backend/pipeline/`
- `backend/api/v1/`

Primary frontend routes:

- `/` — Mission Control
- `/risk-heatmap` — scan-wide prioritization
- `/assets` — scan-scoped inventory
- `/assets/[assetId]` — forensic workbench
- `/reports` — engineer and executive report views
- `/history` — recent scan timeline

## Current Prototype Highlights

The current prototype includes:

- Mission Control redesign with saved targets, recent scans, and portfolio overview
- structured scan workflow panel with scan profiles
- real scan telemetry and degraded-mode visibility
- scan-bound risk heatmap route
- scan-bound asset inventory route
- forensic asset workbench with CBOM, certificate, and remediation views
- polished report route with executive and engineer views
- lightweight scan history route
- read-only Mission Control and history backend endpoints

## Repository Structure

```text
Aegis/
├─ backend/
│  ├─ api/
│  ├─ analysis/
│  ├─ cbom/
│  ├─ cert/
│  ├─ compliance/
│  ├─ core/
│  ├─ discovery/
│  ├─ intelligence/
│  ├─ models/
│  ├─ pipeline/
│  └─ repositories/
├─ frontend/
│  ├─ src/app/
│  ├─ src/components/
│  └─ src/lib/
├─ docker/
├─ migrations/
├─ scripts/
├─ tests/
├─ AGENTS.md
├─ IMPLEMENTATION.md
├─ MEMORY.md
├─ RULES.md
├─ SOLUTION.md
└─ TODO.md
```

## Setup On A New System

You do **not** need PostgreSQL installed locally. Aegis runs PostgreSQL in Docker.

### Prerequisites

- Git
- Docker Desktop
- Node.js and `npm`

### 1. Clone the repo

```powershell
git clone <your-repo-url>
cd Aegis
```

### 2. Create the environment file

```powershell
copy .env.example .env
```

Update values if needed for your machine or API provider configuration.

### 3. Build and start the backend stack

This starts:
- backend
- postgres
- qdrant

```powershell
docker compose build
docker compose up -d
```

### 4. Apply the database migration

```powershell
docker compose exec backend alembic upgrade head
```

### 5. Verify backend health

```powershell
curl http://localhost:8000/health
```

### 6. Start the frontend

```powershell
cd frontend
npm install
npm run dev
```

### 7. Open the app

- Frontend: `http://localhost:3000`
- Backend API: `http://localhost:8000`

## Quick Start

If you want the shortest path from clone to running UI:

```powershell
git clone <your-repo-url>
cd Aegis
copy .env.example .env
docker compose build
docker compose up -d
docker compose exec backend alembic upgrade head
cd frontend
npm install
npm run dev
```

## Development Commands

### Frontend

```powershell
cd frontend
npm run dev
npm run lint
npx tsc --noEmit
```

### Backend and infrastructure

```powershell
docker compose up -d
docker compose ps
docker compose logs backend
docker compose exec backend alembic upgrade head
```

### Useful tests

```powershell
docker compose exec backend python -m pytest tests/integration/test_phase8_api.py -q
docker compose exec backend python -m pytest tests/unit/test_pipeline_orchestrator.py -q
docker compose exec backend python -m pytest tests/infra/test_certificate_signing_runtime.py -q
```

## API Surface

Key endpoints:

- `GET /health`
- `POST /api/v1/scan`
- `GET /api/v1/scan/{scan_id}`
- `GET /api/v1/scan/{scan_id}/results`
- `GET /api/v1/assets/{asset_id}/cbom`
- `GET /api/v1/assets/{asset_id}/certificate`
- `GET /api/v1/assets/{asset_id}/remediation`
- `GET /api/v1/mission-control/overview`
- `GET /api/v1/scan/history`

## Demo Flow

For a clean product demo:

1. open Mission Control
2. launch a scan against a safe public target
3. review posture and priority findings
4. open the Risk Heatmap
5. drill into a risky asset in the Asset Workbench
6. review remediation and certificate evidence
7. open the Reports page
8. show the executive summary
9. show the History page to reinforce that the product behaves like a real operational console

## Important Notes

### PostgreSQL

Local PostgreSQL installation is **not required**.

The project uses the `postgres` container defined in `docker-compose.yml`. If Docker Desktop is running, that is enough for the database layer.

### OQS / PQC runtime

Aegis depends on an OQS-enabled crypto environment for the PQC certificate path. The Docker setup is the intended runtime and should be treated as the canonical environment.

### Ground-truth rule

The frontend should not invent:
- risk scores
- compliance tiers
- scan counts
- artifact totals

Those come from backend responses and compiled scan results.

## Documentation

For deeper project details:

- [MEMORY.md](./MEMORY.md) — current state and next logical task
- [TODO.md](./TODO.md) — engineering roadmap and checklist
- [IMPLEMENTATION.md](./IMPLEMENTATION.md) — technical architecture and data model
- [SOLUTION.md](./SOLUTION.md) — product framing and problem context
- [RULES.md](./RULES.md) — implementation guardrails
- [AGENTS.md](./AGENTS.md) — agent workflow instructions

## Status

The project is currently in a **final prototype / demo validation** stage:

- core backend pipeline implemented
- API layer implemented
- final-prototype frontend routes implemented
- Mission Control, Heatmap, Assets, Workbench, Reports, and History available
- remaining work is mainly demo validation, polish, and future continuous-monitoring features

## Future Direction

Likely next steps after prototype validation:

- scheduled scans
- scan diffing and historical comparisons
- alerts on posture regressions
- continuous monitoring workflows

---

**Aegis**  
Quantum-readiness assessment and remediation for banking-grade internet-facing infrastructure.
