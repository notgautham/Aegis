# Aegis - Persistent Project Memory

## 1. Project Purpose
Aegis is an autonomous, continuous Cryptographic Intelligence Platform designed for the banking sector to combat the Harvest Now, Decrypt Later (HNDL) quantum threat vector. It discovers public-facing cryptographic assets, generates a CycloneDX 1.6 CBOM, scores quantum risk, evaluates NIST FIPS 203/204/205 compliance via a deterministic rules engine, generates Post-Quantum Cryptography (PQC) remediation patches via a RAG pipeline, and issues three-tier X.509 compliance certificates.

## 2. Current Development Phase
**Status: Phase 2 Complete — Phase 3 Starting**

Phase 2 (Database Schema & ORM Setup) has been completed. The project is entering **Phase 3: Core Discovery Engine** as defined in `TODO.md`.

## 3. Current State of the System

### Completed
- `SOLUTION.md` — Product definition, threat models, business context. **Never modify.**
- `IMPLEMENTATION.md` — Authoritative technical specification.
- `TODO.md` — 10-phase roadmap. Phases 1–2 tasks marked `[x]`.
- `AGENTS.md`, `RULES.md`, `MEMORY.md` — Project governance documents.
- `.agents/skills/` — Reusable agent skills.

#### Phase 1 Deliverables
- **Backend scaffolding:**
  - `backend/main.py` — FastAPI app with CORS, lifespan, health check at `GET /health`
  - `backend/core/config.py` — Pydantic Settings (DATABASE_URL, QDRANT_URL, SECRET_KEY)
  - `backend/core/database.py` — SQLAlchemy async engine, session factory, `Base`, `get_db()` dependency
  - `backend/api/v1/router.py` — API v1 router stub
  - `pyproject.toml`, `requirements.txt`, `.env.example`
- **Frontend scaffolding:**
  - `frontend/` — Next.js 14 with TypeScript, Tailwind CSS, shadcn/ui (new-york style, zinc base)
  - `frontend/src/app/layout.tsx` — Root layout with Inter font and SEO metadata
  - `frontend/src/app/page.tsx` — Aegis landing page placeholder
  - `frontend/src/lib/utils.ts` — shadcn/ui `cn()` utility
  - `frontend/src/lib/api.ts` — Typed API client for FastAPI backend
- **Docker infrastructure:**
  - `docker/Dockerfile.oqs` — Multi-stage build (liboqs + oqs-provider from source)
  - `docker-compose.yml` — 3 services: backend (OQS), postgres:15-alpine, qdrant
- **Testing:**
  - `tests/infra/test_oqs.py` — 5 OQS verification tests (all passing)

#### Phase 2 Deliverables
- **SQLAlchemy Models (`backend/models/`):**
  - `enums.py` — `ScanStatus`, `ComplianceTier`, `CertLevel`, `ServiceType`
  - `scan_job.py` — `ScanJob` (UUID PK, target, status, timestamps)
  - `discovered_asset.py` — `DiscoveredAsset` (FK → scan_jobs, hostname, ip, port, protocol, service_type)
  - `crypto_assessment.py` — `CryptoAssessment` (FK → discovered_assets, 4 algorithms, 4 vulns, risk_score, compliance_tier)
  - `certificate_chain.py` — `CertificateChain` (FK → discovered_assets, cert_level, subject/issuer, key info, quantum_safe)
  - `cbom_document.py` — `CbomDocument` (FKs → scan_jobs + discovered_assets, serial_number, JSONB cbom_json)
  - `compliance_certificate.py` — `ComplianceCertificate` (FK → discovered_assets, tier, PEM, signing_algo, extensions JSONB, optional FK → remediation_bundles)
  - `remediation_bundle.py` — `RemediationBundle` (FK → discovered_assets, JSONB hndl_timeline, patch_config, migration_roadmap, JSONB source_citations)
- **Alembic Configuration:**
  - `alembic.ini` — Project-root Alembic config
  - `migrations/env.py` — Async Alembic env using `create_async_engine`
  - `migrations/script.py.mako` — Migration template
  - **Note:** Initial migration must be generated inside Docker: `docker-compose exec backend alembic revision --autogenerate -m "initial_schema"`
  - **Note:** Migration must be applied: `docker-compose exec backend alembic upgrade head`
- **Repository/DAO Layer (`backend/repositories/`):**
  - `base.py` — Generic `BaseRepository[T]` with `create()`, `get_by_id()`, `get_all()`, `update()`, `delete()`
  - `scan_job_repo.py` — `ScanJobRepository` with `get_by_status()`
  - `asset_repo.py` — `DiscoveredAssetRepository` with `get_by_scan_id()`
  - `crypto_assessment_repo.py` — `CryptoAssessmentRepository` with `get_by_asset_id()`
  - `certificate_chain_repo.py` — `CertificateChainRepository` with `get_by_asset_id()`
  - `cbom_repo.py` — `CbomDocumentRepository` with `get_by_scan_id()`, `get_by_asset_id()`
  - `compliance_cert_repo.py` — `ComplianceCertificateRepository` with `get_by_asset_id()`
  - `remediation_repo.py` — `RemediationBundleRepository` with `get_by_asset_id()`

### Pending (Phases 3–10)
- Discovery Engine (DNS, ports, TLS probing, asset aggregation)
- Cryptographic Analysis Engine (cipher parsing, cert analysis, risk scoring)
- PQC Rules Engine and CBOM generator
- Threat Intelligence RAG pipeline (LangChain + Qdrant)
- Certification Engine (ML-DSA-65 X.509 signing)
- Pipeline orchestrator and FastAPI REST API endpoints
- Next.js 14 frontend dashboard

## 4. Key Technical Decisions (Immutable)
- **Tech Stack:** Python 3.11 (FastAPI, asyncio), Next.js 14, PostgreSQL 15.
- **Crypto Engine:** Must use `liboqs` (via `liboqs-python`) and OQS-patched OpenSSL built from source in Docker. Host OS OpenSSL will NOT work for PQC.
- **RAG Stack:** LangChain + Qdrant. **Strictly isolated** — generates HNDL timelines, patches, and roadmaps only. RAG must never alter risk scores, compliance tiers, or certificate content.
- **Security Logic:** The PQC Rules Engine is a non-AI, purely deterministic boolean evaluator. No exceptions.
- **AES-256:** Vulnerability value = 0.05, NOT 1.00. AES-256 is quantum-acceptable.
- **Dependency Flow:** Infrastructure → DB Models → Discovery → Analysis → CBOM → PQC Rules Engine → Certification (all assets) / RAG (Tier 2 / Tier 3 only) → Pipeline Orchestrator → API → Frontend.
- **IP address storage:** TEXT column (not PostgreSQL INET) for asyncpg compatibility.

## 5. Next Logical Task
Execute **Phase 3** from `TODO.md`:
1. Create `backend/discovery/dns_enumerator.py` integrating Amass subprocess calls.
2. Create `backend/discovery/dns_validator.py` integrating DNSx.
3. Create `backend/discovery/port_scanner.py` integrating python-nmap.
4. Create `backend/discovery/tls_probe.py` using sslyze.
5. Create `backend/discovery/cert_extractor.py` for certificate chain extraction.
6. Implement asset deduplication and scope validation in `backend/discovery/aggregator.py`.

**But first:** Generate and apply the initial Alembic migration inside Docker:
```bash
docker-compose up -d
docker-compose exec backend alembic revision --autogenerate -m "initial_schema"
docker-compose exec backend alembic upgrade head
```

## 6. Directory of Key Files

| File | Role |
|------|------|
| `MEMORY.md` | **Read first.** Current project state and next steps. |
| `IMPLEMENTATION.md` | Authoritative technical spec. Consult before implementing any module. |
| `TODO.md` | Execution roadmap. Follow phase order. Mark tasks `[x]` when done. |
| `SOLUTION.md` | Product context and threat models. **Never modify.** |
| `RULES.md` | Operational constraints and guardrails for agents. |
| `AGENTS.md` | Agent workflow guidance and execution strategy. |
| `.agents/skills/` | Reusable patterns for frontend and component development. |
| `backend/main.py` | FastAPI application entry point. |
| `backend/core/config.py` | Application settings (Pydantic). |
| `backend/core/database.py` | SQLAlchemy async engine, session factory, Base. |
| `backend/models/` | All 7 SQLAlchemy ORM models + enums. |
| `backend/repositories/` | Generic + model-specific async CRUD repositories. |
| `alembic.ini` | Alembic migration configuration. |
| `migrations/env.py` | Async Alembic environment with model auto-detection. |
| `docker/Dockerfile.oqs` | OQS-patched OpenSSL Docker build. |
| `docker-compose.yml` | Multi-service Docker Compose config. |
| `tests/infra/test_oqs.py` | OQS infrastructure verification tests. |

## 7. Setup Instructions
To start development:
1. **Frontend:** `cd frontend && npm install && npm run dev`
2. **Docker:** `docker-compose build && docker-compose up -d`
3. **Generate migration:** `docker-compose exec backend alembic revision --autogenerate -m "initial_schema"`
4. **Apply migration:** `docker-compose exec backend alembic upgrade head`
5. **OQS Test:** `docker-compose exec backend pytest tests/infra/test_oqs.py -v`
6. **Health Check:** `curl http://localhost:8000/health`
