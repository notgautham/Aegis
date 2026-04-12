<p align="center">
  <img src="./frontend/public/logo.jpeg" alt="Aegis" width="108" />
</p>

<h1 align="center">Aegis</h1>

<p align="center">
  Autonomous Quantum Cryptographic Intelligence Platform for Banking Infrastructure
</p>

<p align="center">
  <img src="https://img.shields.io/badge/status-active-brightgreen?style=flat-square" alt="status" />
  <img src="https://img.shields.io/badge/backend-fastapi-009688?style=flat-square&logo=fastapi&logoColor=white" alt="backend" />
  <img src="https://img.shields.io/badge/frontend-react%20%2B%20vite-61DAFB?style=flat-square&logo=react&logoColor=111" alt="frontend" />
  <img src="https://img.shields.io/badge/database-postgresql%2015-336791?style=flat-square&logo=postgresql&logoColor=white" alt="postgres" />
  <img src="https://img.shields.io/badge/vector-qdrant-DC244C?style=flat-square" alt="qdrant" />
  <img src="https://img.shields.io/badge/crypto-oqs%20openssl-orange?style=flat-square" alt="oqs" />
</p>

## What This Repository Is

Aegis is a scan-centric platform that helps security teams discover internet-facing cryptographic assets, measure their post-quantum readiness, generate a CBOM, and produce deterministic remediation guidance.

It is designed around the Harvest Now, Decrypt Later (HNDL) risk: encrypted traffic captured today may be decrypted in the future once practical quantum attacks become feasible against classical key exchange and signatures.

## What It Does

1. Discovers in-scope assets (domain/IP/CIDR driven)
2. Probes TLS posture and parses cryptographic primitives
3. Computes deterministic quantum risk and compliance tiers
4. Builds CycloneDX CBOM artifacts
5. Generates remediation bundles and action plans
6. Surfaces posture, history, and trends in a multi-page dashboard

## Solution Flow

### 1) Discovery
- DNS enumeration and validation
- Host/IP/port collection
- TLS handshake probing and metadata extraction

### 2) Analysis
- Cipher decomposition into KEX/Auth/Enc/MAC
- Certificate chain extraction and leaf summary
- Deterministic vulnerability modeling and risk scoring

### 3) Intelligence and Artifacts
- CBOM generation (CycloneDX 1.6)
- Remediation bundles + structured remediation actions
- Compliance certificate generation
- Mission-control and per-scan read models for UI/API

## Core Formula

Quantum risk is deterministic and weighted:

`QuantumRiskScore = (0.45 x V_kex) + (0.35 x V_sig) + (0.10 x V_sym) + (0.10 x V_tls)`

Where:
- `V_kex` is key-exchange vulnerability
- `V_sig` is signature vulnerability
- `V_sym` is symmetric-cipher vulnerability
- `V_tls` is protocol-version vulnerability

## Score Semantics

- `risk_score` in backend: 0-100, higher is worse
- `q_score` in frontend: 0-100, higher is better
- relation: `q_score = 100 - risk_score`

## Deterministic Decisions

These are deterministic and never AI-authored:
- risk score
- compliance tier (`FULLY_QUANTUM_SAFE`, `PQC_TRANSITIONING`, `QUANTUM_VULNERABLE`)
- certificate tiering/issuance path
- structured remediation priority classification (`P1` to `P4`)

## AI in Aegis (Current Implementation)

### What AI currently does
- Generates migration roadmap narrative text from retrieved corpus context in the remediation pipeline.
- Uses retrieval-grounded context (Qdrant chunks + citations) and then returns human-readable roadmap prose.
- Falls back to deterministic stub roadmap text if provider calls fail.

### What AI currently does not do
- Does not calculate risk score.
- Does not assign compliance tier.
- Does not issue compliance certificates.
- Does not set remediation action priority logic (`P1/P2/P3`).

### Is your expected behavior happening today?
- Score explanation in plain English: partially, but currently template/deterministic in UI logic (not Groq-generated).
- Remediation patch generation: currently deterministic template generation (not Groq-generated).
- HNDL timeline narrative sentence generation: currently deterministic HNDL calculations and structured timeline entries.
- Executive summary generation: currently template/data-driven page composition (not Groq-generated).
- Migration roadmap generation: yes, this is where cloud LLM providers (including Groq when configured) are currently used.

### Which pages show AI-influenced content
- `/dashboard/remediation/roadmap`: displays migration roadmap content from remediation bundle (`migration_roadmap`) that may come from cloud LLM generation.
- `/dashboard/remediation/ai-patch`: may show roadmap/citation context, but patch block itself is deterministic from server templates.

### Which pages do not depend on Groq for security decisions
- `/dashboard/pqc/compliance`
- `/dashboard/rating/enterprise`
- `/dashboard/rating/per-asset`
- `/dashboard/scans/:scanId`
- `/dashboard/history`
- `/dashboard/discovery`

All above rely on deterministic backend assessments and persisted artifacts.

### Why Groq is used
- To produce readable remediation roadmap text from retrieved standards context.
- To improve operator readability and planning communication.
- Not used as the security decision engine.

## Tech Stack

- Backend: FastAPI, SQLAlchemy (async), Alembic, OQS OpenSSL
- Frontend: React 18, TypeScript, Vite, Tailwind, TanStack Query
- Data: PostgreSQL 15 (Apache AGE image), Qdrant
- Infra: Docker Compose

Runtime version policy:
- Python: 3.11 everywhere (container, CI, and local tooling)

## Repository Structure

- `backend/`: API, deterministic analysis pipeline, repositories, models
- `frontend/`: dashboard UI, adapters, route-level pages
- `docker/`: OQS-enabled build and init scripts
- `docs/`: local corpus and documentation index
- `migrations/`: Alembic migrations
- `simulation/`: local pipeline run utility
- `tests/`: unit, integration, and infrastructure tests

## Scanner UX

- Primary entry after login is `/scanner`.
- Scanner accepts one target per run.
- `Quick` / `Standard` / `Deep` / `PQC Focus` select analysis profile depth.
- `Full Port Scan` and `Subdomain Enumeration` are independent coverage toggles layered on top of the selected profile.
- After scan completion, dashboard pages consume the completed scan context.

## Repository and Setup

- Repository Name: `Aegis`
- Repository URL: `https://github.com/notgautham/Aegis`
- Setup and run instructions are intentionally maintained in [SETUP.md](SETUP.md)

## Documentation

- Setup guide: [SETUP.md](SETUP.md)
- API reference: [documentations/API.md](documentations/API.md)
- Database reference: [documentations/DATABASE.md](documentations/DATABASE.md)
- Operational context: [documentations/CONTEXT.md](documentations/CONTEXT.md)
- Corpus docs: [docs/README.md](docs/README.md)

## Notes

- Do not modify product-intent narrative in `SOLUTION.md`.
- For stable local dev with Docker frontend, dependencies are installed on container startup to keep `node_modules` in sync with `package.json`.
