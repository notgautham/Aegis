# Aegis - Persistent Project Memory

## 1. Project Purpose
Aegis is an autonomous, continuous Cryptographic Intelligence Platform designed for the banking sector to combat the Harvest Now, Decrypt Later (HNDL) quantum threat vector. It discovers public-facing cryptographic assets, generates a CycloneDX 1.6 CBOM, scores quantum risk, evaluates NIST FIPS 203/204/205 compliance via a deterministic rules engine, generates Post-Quantum Cryptography (PQC) remediation patches via a RAG pipeline, and issues three-tier X.509 compliance certificates.

## 2. Current Development Phase
**Status: Phase 3 Complete — Phase 4 Starting**

Phase 3 (Core Discovery Engine) has been completed. The project is entering **Phase 4: Cryptographic Analysis Engine** as defined in `TODO.md`.

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

#### Phase 3 Deliverables
- **Discovery Engine (`backend/discovery/`):**
  - `types.py` — Shared typed discovery results used across enumeration, validation, probing, aggregation, and optional inspectors
  - `dns_enumerator.py` — `AmassEnumerator` async wrapper for passive Amass enumeration scoped to the target domain
  - `dns_validator.py` — `DNSxValidator` with DNSx JSON parsing and a socket-based fallback when DNSx is unavailable
  - `port_scanner.py` — `PortScanner` wrapper over `python-nmap` for TCP 443/8443/4443 and UDP 500/4500/1194
  - `tls_probe.py` — `TLSProbe` with sslyze integration and pyOpenSSL fallback for negotiated cipher and certificate chain extraction
  - `cert_extractor.py` — `CertificateExtractor` using `cryptography` to derive leaf/intermediate/root certificate metadata
  - `aggregator.py` — Deterministic scope parsing, in-scope validation, hostname/IP correlation, and asset deduplication
  - `api_inspector.py` — Optional accessible API inspection for JWT `alg` extraction and mTLS hints
  - `vpn_probe.py` — Optional partial VPN detection for IKEv2/OpenVPN candidate services
- **Testing:**
  - `tests/unit/test_aggregator.py` — Unit tests for scope validation, deduplication, shared-IP virtual hosts, and network-target asset retention
  - `tests/infra/validate_phase3.py` — Live smoke test for DNS validation, port scanning, TLS probing, certificate extraction, and aggregation against a safe public target
  - `tests/infra/validate_phase3_full.py` — Aggregated Phase 3 validator that reports PASS / FAIL / SKIP for deterministic and live discovery checks
- **Validation Status:**
  - Deterministic Phase 3 validation is passing
  - Docker-based live validation now passes for DNS validation, port scanning, TLS probing, certificate extraction, and end-to-end aggregation using `tests/infra/validate_phase3_full.py`
  - `dns_enumerator.py` was adjusted for installed Amass CLI compatibility by removing the unsupported `-noalts` flag
  - `tls_probe.py` was hardened with a more resilient pyOpenSSL handshake loop and a stdlib SSL fallback path while preserving the `TLSProbeResult` contract for later phases
  - The only remaining live validation issue is Amass passive enumeration timing out against the public test target even with increased timeout; this is being treated as deferred external-tool/runtime tuning rather than a Phase 3 logic blocker

### Pending (Phases 4–10)
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
Execute **Phase 4** from `TODO.md`:
1. Create `backend/analysis/cipher_parser.py` for TLS 1.2 cipher decomposition.
2. Create `backend/analysis/handshake_metadata_resolver.py` for TLS 1.3 key exchange and authentication metadata extraction.
3. Implement `backend/analysis/constants.py` with `VULNERABILITY_MAP` and `TLS_VULNERABILITY_MAP`.
4. Add unit tests for TLS 1.2 parsing, TLS 1.3 handshake metadata resolution, and risk scoring.
5. Create `backend/analysis/cert_analyzer.py`.
6. Create `backend/analysis/risk_scorer.py`.

**Operational note:** Verify the existing Alembic migration is applied in Docker before wiring later phases:
```bash
docker-compose up -d
docker-compose exec backend alembic upgrade head
```

**Validation note:** Before Phase 8 orchestration/API integration, run the Phase 3 live validators inside Docker so the discovery toolchain is fully verified in its intended runtime:
```bash
python tests/infra/validate_phase3_full.py --offline
docker compose exec backend python tests/infra/validate_phase3_full.py
```

**Known deferred item:** Amass passive enumeration can still time out against slow public targets during validation. Revisit this before broader production-style discovery validation or Phase 8 end-to-end orchestration hardening.

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
| `backend/discovery/` | Phase 3 discovery engine modules and typed discovery results. |
| `alembic.ini` | Alembic migration configuration. |
| `migrations/env.py` | Async Alembic environment with model auto-detection. |
| `docker/Dockerfile.oqs` | OQS-patched OpenSSL Docker build. |
| `docker-compose.yml` | Multi-service Docker Compose config. |
| `tests/infra/test_oqs.py` | OQS infrastructure verification tests. |

## 7. Setup Instructions
To start development:
1. **Frontend:** `cd frontend && npm install && npm run dev`
2. **Docker:** `docker-compose build && docker-compose up -d`
3. **Apply migration:** `docker-compose exec backend alembic upgrade head`
4. **Discovery unit tests:** `python -m pytest tests/unit/test_aggregator.py -v`
5. **OQS Test:** `docker-compose exec backend pytest tests/infra/test_oqs.py -v`
6. **Health Check:** `curl http://localhost:8000/health`
