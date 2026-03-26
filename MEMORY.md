# Aegis - Persistent Project Memory

## 1. Project Purpose
Aegis is an autonomous, continuous Cryptographic Intelligence Platform designed for the banking sector to combat the Harvest Now, Decrypt Later (HNDL) quantum threat vector. It discovers public-facing cryptographic assets, generates a CycloneDX 1.6 CBOM, scores quantum risk, evaluates NIST FIPS 203/204/205 compliance via a deterministic rules engine, generates Post-Quantum Cryptography (PQC) remediation patches via a RAG pipeline, and issues three-tier X.509 compliance certificates.

## 2. Current Development Phase
**Status: Phase 6 Complete — Phase 7 Starting**

Phase 6 (Threat Intelligence (RAG) & Remediation) has been completed. The project is entering **Phase 7: Certification Engine** as defined in `TODO.md`.

## 3. Current State of the System

### Completed
- `SOLUTION.md` — Product definition, threat models, business context. **Never modify.**
- `IMPLEMENTATION.md` — Authoritative technical specification.
- `TODO.md` — 10-phase roadmap. Phases 1–6 tasks marked `[x]`.
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

#### Phase 4 Deliverables
- **Cryptographic Analysis Engine (`backend/analysis/`):**
  - `constants.py` — Deterministic `VULNERABILITY_MAP`, `TLS_VULNERABILITY_MAP`, and `WEIGHTS` tables plus canonicalization helpers for normalized algorithm lookup
  - `cipher_parser.py` — TLS 1.2 cipher decomposition into `kex` / `auth` / `enc` / `mac` components with deterministic vulnerability lookups
  - `handshake_metadata_resolver.py` — TLS 1.3 handshake/session metadata extraction for key exchange and authentication algorithms
  - `cert_analyzer.py` — Certificate metric normalization and `quantum_safe` classification for leaf/intermediate/root certs
  - `risk_scorer.py` — Deterministic weighted risk score calculation and component-level breakdown using the documented formula
- **Testing:**
  - `tests/unit/test_cipher_parser.py` — Unit tests covering standard TLS 1.2 parsing, hybrid PQC cipher parsing, and malformed/TLS 1.3 rejection
  - `tests/unit/test_handshake_metadata_resolver.py` — Unit tests covering nested TLS 1.3 handshake metadata extraction, certificate metadata fallback, and TLS version rejection
  - `tests/unit/test_risk_scorer.py` — Unit test validating the documented `84.5` example for ECDHE + RSA + AES-256-GCM + TLS 1.2
  - `tests/unit/test_cert_analyzer.py` — Unit tests covering extracted-certificate normalization, dictionary-based inputs, and conservative `quantum_safe` recomputation
  - `tests/unit/test_cert_extractor.py` — Unit tests covering PEM chain parsing, certificate level inference, and extracted metadata normalization
  - `tests/integration/test_discovery_analysis_bridge.py` — Cross-phase bridge tests validating Discovery → Analysis handoff for both TLS 1.2 and TLS 1.3 style inputs
- **Validation Status:**
  - Docker-based unit verification passed for all Phase 4 tests: `10 passed in 1.30s`
  - Additional Docker validation now passes for certificate analysis, certificate extraction, and cross-phase bridge coverage: `6 passed in 1.97s`
  - Combined discovery/analysis validation now passes for `tests/unit` plus the Discovery → Analysis bridge test: `22 passed in 4.27s`
  - Coverage for the checked discovery/analysis suite increased to `67%` overall, with `backend/analysis/cert_analyzer.py` and `backend/discovery/cert_extractor.py` both at `100%`
  - TLS 1.2 parsing and TLS 1.3 metadata resolution remain intentionally separated, matching the architecture and future pipeline expectations
  - Risk scoring remains aligned with the immutable formula and AES-256 treatment defined in `IMPLEMENTATION.md` and `RULES.md`

#### Phase 5 Deliverables
- **PQC Rules Engine (`backend/compliance/`):**
  - `rules_engine.py` — Deterministic PASS/HYBRID/FAIL and OK/WARN/FAIL evaluation across KEX, SIG, and SYM dimensions with tier aggregation into `FULLY_QUANTUM_SAFE`, `PQC_TRANSITIONING`, and `QUANTUM_VULNERABLE`
  - `rules_engine.py` — Stable `ComplianceInput`, `DimensionEvaluation`, `ComplianceEvaluation`, and `apply_compliance_tier()` interfaces for later orchestrator reuse
- **CBOM Generation (`backend/cbom/`):**
  - `cyclonedx_mapper.py` — CycloneDX 1.6 asset mapper with deterministic serial generation (`urn:aegis:scan:{YYYYMMDD}:{hostname-or-ip}:{port}`)
  - `cyclonedx_mapper.py` — Local `jsonschema` validation before persistence
  - `cyclonedx_mapper.py` — JSON export and ReportLab PDF export helpers
  - `cyclonedx_mapper.py` — Repository-backed persistence helper that stores `CbomDocument` JSONB and updates `CryptoAssessment.compliance_tier` in the same session
- **Testing:**
  - `tests/unit/test_rules_engine.py` — Truth-table coverage for PASS/HYBRID/FAIL and OK/WARN/FAIL combinations, including conservative unknown-algorithm handling
  - `tests/unit/test_cyclonedx_mapper.py` — Coverage for deterministic serials, CBOM shape, schema validation, certificate fallback behavior, JSON export, and PDF export
  - `tests/integration/test_phase5_cbom_pipeline.py` — DB-backed Phase 5 flow tests validating rules evaluation, CBOM mapping, persistence, and compliance tier updates for vulnerable and hybrid cases
- **Validation Status:**
  - Docker-based Phase 5 unit verification passed: `16 passed in 1.79s`
  - Docker-based Phase 5 integration verification passed: `2 passed in 2.18s`
  - Combined coverage for `backend/compliance` and `backend/cbom` reached `99%` with `38 passed in 4.30s`
  - The running backend container required a one-time `jsonschema` install for validation because it predated the `requirements.txt` update; future rebuilds will include it automatically

#### Phase 6 Deliverables
- **Threat Intelligence / Remediation (`backend/intelligence/`):**
  - `types.py` — Shared typed contracts for retrieval chunks, HNDL results, roadmap results, ingestion summaries, and remediation payloads
  - `retrieval.py` — Local-corpus ingestion, preprocessing, chunking, deterministic local embeddings, OpenRouter-compatible cloud embedding client, Qdrant upsert/search, structured citations, and LangChain document conversion helpers
  - `hndl_calculator.py` — Deterministic HNDL timeline calculator with bounded output, growth-rate clamp, urgency classification, and algorithm mapping for RSA/ECDH-style exposure
  - `patch_generator.py` — Deterministic mapping-based patch generation for nginx, Apache, and generic OpenSSL fallback while preserving AES-256-GCM
  - `roadmap_generator.py` — Retrieval-grounded roadmap generation with strict context enforcement and deterministic fallback when cloud LLM calls are disabled, fail, or time out
  - `rag_orchestrator.py` — Coordination-only Phase 6 orchestration that retrieves context, computes HNDL, generates patches/roadmaps, and persists `RemediationBundle` records for Tier 2 / Tier 3 assets
- **Scripts / Config:**
  - `scripts/ingest_nist_docs.py` — Local-only corpus ingestion entrypoint for `docs/nist/`
  - `backend/core/config.py` — Added Qdrant collection, docs source, provider mode, OpenRouter, retrieval `top_k`, and timeout settings
  - `.env.example` — Added Phase 6 intelligence configuration examples
- **Testing:**
  - `tests/unit/test_hndl_calculator.py` — Documented break-year cases, growth-rate clamp, capped outputs, and urgency classification
  - `tests/unit/test_patch_generator.py` — nginx/Apache/generic patch generation and AES-256-GCM preservation
  - `tests/unit/test_retrieval.py` — Local embedding fallback, configurable `top_k`, chunk metadata, and explicit corpus setup failures
  - `tests/unit/test_roadmap_generator.py` — Strict retrieval requirements, deterministic roadmap fallback, and provider timeout fallback
  - `tests/unit/test_rag_orchestrator.py` — Tier 1 short-circuit plus Tier 2 / Tier 3 orchestration payload verification
  - `tests/integration/test_ingest_nist_docs.py` — Sample corpus ingestion into Qdrant and script-level ingestion verification
  - `tests/integration/test_phase6_remediation_pipeline.py` — DB-backed remediation persistence for vulnerable and transitioning assets plus deterministic roadmap stub validation
- **Validation Status:**
  - Docker-based Phase 6 unit verification passed: `17 passed in 2.56s`
  - Docker-based Phase 6 integration verification passed: `4 passed in 2.55s`
  - Combined coverage for `backend.intelligence` reached `86%` with `55 passed in 7.04s`
  - The retrieval layer is compatible with the installed `qdrant-client` version in Docker via `query_points`
  - `docs/nist/` is now populated with the approved local corpus and has been ingested into Qdrant successfully
  - `scripts/validate_ingested_corpus.py` now reports corpus file counts and live Qdrant collection stats for repeatable verification
  - Ingestion and corpus validation now ignore housekeeping files such as `README.md` and `.gitkeep`

### Pending (Phases 7–10)
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
Execute **Phase 7** from `TODO.md`:
1. Create `backend/cert/signer.py` wrapping the liboqs / OQS OpenSSL subprocess for ML-DSA-65 X.509 signing.
2. Implement the ECDSA fallback signing path using Python `cryptography`.
3. Add custom OID extension injection based on compliance tier and remediation linkage.
4. Implement three-tier certificate issuance windows (90 / 30 / 7 days).
5. Persist generated certificates into the `ComplianceCertificate` repository and add verification tests.

**Operational note:** Verify the existing Alembic migration is applied in Docker before wiring later phases:
```bash
docker-compose up -d
docker-compose exec backend alembic upgrade head
```

**Phase 6 setup note:** The intelligence layer ingests local source material only. Populate `docs/nist/` with the approved reference corpus before running:
```bash
docker compose exec backend python scripts/ingest_nist_docs.py
docker compose exec backend python scripts/validate_ingested_corpus.py
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
| `backend/analysis/` | Phase 4 cryptographic analysis engine modules and unit-tested parser/scoring logic. |
| `backend/compliance/` | Phase 5 deterministic PQC rules engine and reusable tier-application helper. |
| `backend/cbom/` | Phase 5 CycloneDX mapping, validation, persistence, and export helpers. |
| `backend/intelligence/` | Phase 6 retrieval, HNDL calculation, deterministic patch generation, roadmap generation, and remediation orchestration. |
| `scripts/ingest_nist_docs.py` | Phase 6 local-only Qdrant ingestion entrypoint for the intelligence corpus. |
| `tests/integration/test_discovery_analysis_bridge.py` | Cross-phase validation of Discovery output flowing into Analysis logic. |
| `tests/integration/test_phase5_cbom_pipeline.py` | DB-backed validation of Phase 5 rules evaluation and CBOM persistence flow. |
| `tests/integration/test_phase6_remediation_pipeline.py` | DB-backed validation of Phase 6 retrieval, roadmap, and remediation persistence flow. |
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
4. **Discovery unit tests:** `docker compose exec backend python -m pytest tests/unit/test_aggregator.py -v`
5. **Analysis unit tests:** `docker compose exec backend python -m pytest tests/unit/test_cipher_parser.py tests/unit/test_handshake_metadata_resolver.py tests/unit/test_risk_scorer.py -v`
6. **OQS Test:** `docker compose exec backend pytest tests/infra/test_oqs.py -v`
7. **Cross-phase validation:** `docker compose exec backend python -m pytest tests/unit/test_cert_analyzer.py tests/unit/test_cert_extractor.py tests/integration/test_discovery_analysis_bridge.py -v`
8. **Phase 5 unit tests:** `docker compose exec backend python -m pytest tests/unit/test_rules_engine.py tests/unit/test_cyclonedx_mapper.py -v`
9. **Phase 5 integration tests:** `docker compose exec backend python -m pytest tests/integration/test_phase5_cbom_pipeline.py -v`
10. **Phase 5 coverage sweep:** `docker compose exec backend python -m pytest tests/unit tests/integration/test_phase5_cbom_pipeline.py --cov=backend.compliance --cov=backend.cbom --cov-report=term-missing -v`
11. **Phase 6 unit tests:** `docker compose exec backend python -m pytest tests/unit/test_hndl_calculator.py tests/unit/test_patch_generator.py tests/unit/test_retrieval.py tests/unit/test_roadmap_generator.py tests/unit/test_rag_orchestrator.py -v`
12. **Phase 6 integration tests:** `docker compose exec backend python -m pytest tests/integration/test_ingest_nist_docs.py tests/integration/test_phase6_remediation_pipeline.py -v`
13. **Phase 6 coverage sweep:** `docker compose exec backend python -m pytest tests/unit tests/integration/test_phase6_remediation_pipeline.py --cov=backend.intelligence --cov-report=term-missing -v`
14. **Coverage sweep:** `docker compose exec backend python -m pytest tests/unit tests/integration/test_discovery_analysis_bridge.py --cov=backend.analysis --cov=backend.discovery --cov-report=term-missing -v`
15. **Health Check:** `curl http://localhost:8000/health`
