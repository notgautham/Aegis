<p align="center">
  <img src="./frontend/public/logo.jpeg" alt="Aegis" width="108" />
</p>

<h1 align="center">Aegis</h1>

<p align="center">
  Autonomous Quantum Cryptographic Intelligence Platform for Banking Infrastructure
</p>

## Overview

Aegis is a scan-centric platform for discovering internet-facing cryptographic assets and evaluating post-quantum readiness with deterministic scoring.

Primary outcomes:
1. Discover assets and cryptographic surfaces.
2. Assess TLS and certificate posture.
3. Compute deterministic quantum risk.
4. Generate CBOM and remediation artifacts.
5. Expose scan results through API and dashboard.

## Deterministic Scoring Model

Risk is deterministic and weighted:

Risk = 100 × (0.45 × V<sub>KEX</sub> + 0.35 × V<sub>SIG</sub> + 0.10 × V<sub>SYM</sub> + 0.10 × V<sub>TLS</sub>) + P<sub>cert</sub>

Certificate penalty:
- `+10` when certificate is expired (`days_remaining <= 0`)
- `+5` when certificate expires in `<= 30` days
- final score is capped at `100`

Score semantics:
- `risk_score` (backend): higher is worse
- `q_score` (frontend): higher is better
- relation: Q<sub>score</sub> = 100 - Risk

## Local Runtime Mode

This repository is configured for local deterministic mode by default.

Key points:
- No cloud API keys are required for setup or scan execution.
- Qdrant is used as local vector storage and can be preloaded from `docs/nist`.
- Root `.env` is intentionally tracked for reproducible local setup.
- `.env.example` remains as the template and optional cloud extension reference.

## Tech Stack

- Backend: FastAPI, SQLAlchemy async, Alembic, Python 3.11
- Frontend: React 18, TypeScript, Vite, Tailwind
- Data: PostgreSQL 15, Qdrant
- Infra: Docker Compose

## Quick Start

See [SETUP.md](SETUP.md) for full setup.

Short version:

```bash
docker compose up -d --build
```

Notes:
- Backend startup now runs Alembic migrations automatically.
- Qdrant corpus is expected to be preloaded for this repository runtime.

App URLs:
- Frontend: `http://localhost:3000`
- Backend: `http://localhost:8000`
- Swagger: `http://localhost:8000/docs`

## Repository Structure

- `backend/`: API, orchestrator, analysis, repositories, models
- `frontend/`: dashboard pages, contexts, adapters, scanner UX
- `documentations/`: API, database, context, and architecture references
- `docs/`: NIST corpus used by retrieval pipeline
- `migrations/`: Alembic migrations
- `tests/`: unit and integration tests

## Documentation Index

- [SETUP.md](SETUP.md)
- [documentations/API.md](documentations/API.md)
- [documentations/DATABASE.md](documentations/DATABASE.md)
- [documentations/CONTEXT.md](documentations/CONTEXT.md)

## Important Notes

- Do not modify product-intent narrative in `SOLUTION.md`.
- Deterministic scoring and compliance tiering must remain non-LLM logic.
