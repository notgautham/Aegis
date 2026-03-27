# Aegis - Persistent Project Memory

## 1. Project Purpose
Aegis is an autonomous, continuous Cryptographic Intelligence Platform designed for the banking sector to combat the Harvest Now, Decrypt Later (HNDL) quantum threat vector. It discovers public-facing cryptographic assets, generates a CycloneDX 1.6 CBOM, scores quantum risk, evaluates NIST FIPS 203/204/205 compliance via a deterministic rules engine, generates Post-Quantum Cryptography (PQC) remediation patches via a RAG pipeline, and issues three-tier X.509 compliance certificates.

## 2. Current Development Phase
**Status: Phase 9 Complete and Stabilized - Phase 10 Starting**

Phase 9 (Frontend Foundation) has been implemented and then stabilized with richer scan observability. Frontend lint now passes locally, and the build completed successfully when run by the user during the Phase 9 session. Post-Phase-9 stabilization also fixed same-day CBOM rescan collisions by making CBOM serials deterministic per persisted asset, added bounded port scanning to prevent discovery hangs, and upgraded the live scan dashboard with stage telemetry, degraded-mode visibility, recent event feeds, and clearer operational summaries.

## 3. Current State of the System

### Completed
- `SOLUTION.md` — Product definition, threat models, business context. **Never modify.**
- `IMPLEMENTATION.md` — Authoritative technical specification.
- `TODO.md` — 10-phase roadmap. Phases 1-9 tasks are now marked `[x]`.
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
  - `frontend/src/app/layout.tsx` — Root layout with IBM Plex fonts and the Phase 9 command-center shell metadata
  - `frontend/src/app/page.tsx` — Phase 9 dashboard route entry for scan control and status polling
  - `frontend/src/components/` — Command-center shell, shadcn-style UI primitives, and scan workflow components
  - `frontend/src/lib/utils.ts` — shadcn/ui `cn()` utility
  - `frontend/src/lib/api.ts` — Typed Phase 8/10-ready API client for FastAPI backend contracts
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
  - A post-Phase-9 stabilization pass now installs `amass` in the backend Docker image from the official OWASP Amass release archive, downgrades missing-binary enumeration fallback to a warning instead of a traceback, and bounds `nmap` scans with `--host-timeout`, `--max-retries`, and `-n` to avoid discovery-stage hangs on public targets

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
  - `cyclonedx_mapper.py` — CycloneDX 1.6 asset mapper with deterministic scan-scoped serial generation (`urn:aegis:scan:{YYYYMMDD}:{hostname-or-ip}:{port}:{asset_uuid}`) so repeat scans can persist historical CBOMs without collisions
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
  - Post-Phase-9 stabilization fixed repeat-scan CBOM serial collisions by using deterministic scan-scoped serials with the persisted asset UUID suffix, so same-target same-day rescans now preserve history without violating database uniqueness

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

#### Phase 7 Deliverables
- **Certification Engine (`backend/cert/`):**
  - `signer.py` — `CertificateSigner` with deterministic compliance-tier recomputation, certificate request/response dataclasses, secure 128-bit serial generation, UTC validity handling, and repository-backed persistence
  - `signer.py` — Primary ML-DSA-65 / OQS OpenSSL issuance path with unique temp config generation, cleanup, issuer reuse, and explicit fallback error classification
  - `signer.py` — ECDSA P-384 fallback path using `cryptography` with the same subject, SAN, validity semantics, standard X.509 extensions, and custom Aegis OIDs
  - `signer.py` — Custom OID extension support for `PQC-STATUS`, `FIPS-COMPLIANT`, `BROKEN-ALGORITHMS`, and `REMEDIATION-BUNDLE-ID`
  - `backend/cert/__init__.py` — Stable Phase 7 exports for later pipeline/API integration
- **Config / Runtime:**
  - `backend/core/config.py` — Added issuer identity settings and `CERT_RUNTIME_DIR` for reusable issuer material
- **Testing:**
  - `tests/unit/_phase7_helpers.py` — Shared realistic fixtures for certificate issuance tests
  - `tests/unit/test_certificate_signer.py` — Tier validity, SAN typing, issuer reuse, mismatch detection, remediation requirements, and truncation behavior
  - `tests/unit/test_certificate_oid_encoding.py` — Numeric OID presence, UTF-8 payload decoding, and payload-size bound checks
  - `tests/integration/test_phase7_certificate_pipeline.py` — DB-backed certificate persistence coverage for Tier 1 and Tier 3 assets
  - `tests/infra/test_certificate_signing_runtime.py` — Runtime OpenSSL parseability check plus concurrent issuance safety
  - `tests/integration/test_phase3_to_phase7_pipeline.py` — End-to-end vulnerable TLS 1.2 flow from discovery-style input through CBOM, remediation, and final certificate issuance
- **Validation Status:**
  - Docker-based Phase 7 unit verification passed: `14 passed in 1.30s`
  - Docker-based Phase 7 integration verification passed: `2 passed in 1.58s`
  - Docker-based Phase 7 runtime verification passed: `2 passed in 1.13s`
  - Added cross-phase regression coverage with `tests/integration/test_phase3_to_phase7_pipeline.py`, which passed in Docker
  - Broad backend regression across Phases 1–7 passed in Docker: `85 passed, 1 warning in 6.14s`
  - The remaining live discovery caveat is operational only: Amass enumeration is currently skipped in Docker because the `amass` binary is not installed in the backend image

#### Phase 8 Deliverables
- **Pipeline Orchestrator (`backend/pipeline/`):**
  - `orchestrator.py` - Async scan coordinator that guards duplicate runs, transitions scan jobs through `pending -> running -> completed/failed`, derives scope from the submitted target, runs Discovery -> Analysis -> CBOM -> Rules -> optional Remediation -> Certification, and persists outputs with per-asset failure isolation.
  - `orchestrator.py` - Read-side assembly helpers for scan status, compiled scan results, and deterministic latest-artifact selection for CBOMs, certificates, and remediation bundles.
- **FastAPI API Surface (`backend/api/v1/`):**
  - `schemas.py` - Request/response schemas for scan creation, status polling, compiled results, CBOM retrieval, certificate retrieval, and remediation retrieval.
  - `endpoints/scans.py` - `POST /api/v1/scan`, `GET /api/v1/scan/{scan_id}`, and `GET /api/v1/scan/{scan_id}/results` with background task dispatch and progress derivation from persisted rows.
  - `endpoints/assets.py` - `GET /api/v1/assets/{asset_id}/cbom`, `GET /api/v1/assets/{asset_id}/certificate`, and `GET /api/v1/assets/{asset_id}/remediation` using deterministic latest-artifact selection.
  - `router.py` - Phase 8 route registration for the `Scans` and `Assets` API groups.
  - `backend/main.py` - App-state task registry initialization plus global JSON exception handlers for request validation, lookup failures, and unexpected server errors.
- **Testing:**
  - `tests/unit/test_pipeline_orchestrator.py` - Orchestrator coverage for happy path, duplicate-run guards, terminal timestamps, per-asset isolation, Tier 1 remediation skipping, and scan-level failure handling.
  - `tests/integration/test_phase8_api.py` - DB-backed API coverage for scan creation, scan status polling, compiled results, deterministic latest-artifact selection, and asset retrieval endpoints.
- **Validation Status:**
  - Docker-based Phase 8 orchestrator/API verification passed: `10 passed in 6.21s`
  - Broad backend regression after the CBOM rescan, Amass-handling, and bounded port-scan fixes now passes in Docker: `100 passed, 1 warning in 8.90s`
  - The orchestrator now handles missing-Amass fallback as an expected degraded mode while preserving root-target scanning
#### Phase 9 Deliverables
- **Frontend Foundation (`frontend/src/`):**
  - `app/layout.tsx` - Reworked the root shell around IBM Plex fonts and a darker command-center visual language instead of the placeholder Phase 1 landing presentation.
  - `app/page.tsx` - Now renders the real dashboard workspace at `/` rather than a static splash screen.
  - `app/globals.css` - Introduced the command-center color system, shell surfaces, utility classes, and typography foundation for the dashboard.
  - `components/dashboard-workspace.tsx` - Client-side scan orchestration UI with hydration-safe `localStorage`, submit deduplication, polling cleanup, stale-response guards, timestamp formatting, and retry/backoff handling.
  - `components/app-sidebar.tsx`, `components/app-header.tsx`, `components/new-scan-card.tsx`, `components/scan-status-card.tsx` - Structured Phase 9 shell, scan creation UX, and active scan status presentation.
  - `components/ui/` - Added lightweight shadcn-style button, card, input, badge, separator, and skeleton primitives owned directly in the repo.
  - `lib/api.ts` - Expanded into a typed client for health, scan creation, scan polling, compiled results, CBOM retrieval, certificate retrieval, and remediation retrieval.
  - `.eslintrc.json` - Added a non-interactive Next.js ESLint config so `npm run lint` works cleanly in the repo.
- **Validation Status:**
  - Frontend lint now passes locally: `npm.cmd run lint` -> clean
  - Frontend build completed successfully when run by the user in the frontend workspace during Phase 9
  - The final code adjustment after the first build attempt was limited to hook-dependency cleanup in `dashboard-workspace.tsx`; no backend contracts changed
  - A later Phase 9 stabilization pass added richer backend scan-status telemetry (`stage`, `stage_detail`, elapsed time, degraded-mode notices, recent runtime events, and summary metrics) and refreshed the dashboard visuals so scans explain what they are doing while they run
  - Verification after the observability upgrade passed with `npm.cmd run lint`, `12 passed` for focused orchestrator/API telemetry tests, and `101 passed, 1 warning` for the broad Docker backend regression
  - A follow-up Phase 9 stabilization fix corrected the OQS/OpenSSL CA serial-file formatting in `backend/cert/signer.py` by padding odd-length hexadecimal serials before invoking `openssl ca`; this removes a recoverable ML-DSA issuance error that previously caused some assets to fall back to ECDSA during otherwise successful scans
  - Focused certificate verification after the serial-format fix passed: `13 passed` across `tests/unit/test_certificate_signer.py` and `tests/infra/test_certificate_signing_runtime.py`

### Pending (Phase 10 and Beyond)
- Frontend dashboards and detailed result views
- Final frontend-to-backend end-to-end integration pass
- Continuous monitoring and scheduling features
- Post-Phase-9 stabilization fixes surfaced by live scans, including any remaining real-world persistence or orchestration edge cases

## 4. Key Technical Decisions (Immutable)
- **Tech Stack:** Python 3.11 (FastAPI, asyncio), Next.js 14, PostgreSQL 15.
- **Crypto Engine:** Must use `liboqs` (via `liboqs-python`) and OQS-patched OpenSSL built from source in Docker. Host OS OpenSSL will NOT work for PQC.
- **RAG Stack:** LangChain + Qdrant. **Strictly isolated** — generates HNDL timelines, patches, and roadmaps only. RAG must never alter risk scores, compliance tiers, or certificate content.
- **Security Logic:** The PQC Rules Engine is a non-AI, purely deterministic boolean evaluator. No exceptions.
- **AES-256:** Vulnerability value = 0.05, NOT 1.00. AES-256 is quantum-acceptable.
- **Dependency Flow:** Infrastructure → DB Models → Discovery → Analysis → CBOM → PQC Rules Engine → Certification (all assets) / RAG (Tier 2 / Tier 3 only) → Pipeline Orchestrator → API → Frontend.
- **IP address storage:** TEXT column (not PostgreSQL INET) for asyncpg compatibility.

## 5. Next Logical Task
Execute **Phase 10** from `TODO.md`:
1. Build the Risk Heatmap, CBOM Viewer, Certificate Viewer, and HNDL Timeline/Remediation views on top of the typed Phase 9 API client.
2. Add the dual-report layout so the same scan data can be consumed as both a CISO summary and an engineer-focused technical view.
3. Verify frontend-to-backend end-to-end integration against a safe public test target and close the remaining UX/data mismatches one by one.

**Operational note:** Verify the existing Alembic migration is applied in Docker before continuing frontend/report integration:
```bash
docker-compose up -d
docker-compose exec backend alembic upgrade head
```

**Phase 6 corpus note:** Keep the approved local source corpus under `docs/nist/` current, then validate ingestion status with:
```bash
docker compose exec backend python scripts/ingest_nist_docs.py
docker compose exec backend python scripts/validate_ingested_corpus.py
```

**Phase 9 verification note:** The frontend foundation is currently validated with:
```bash
cd frontend && npm run lint
cd frontend && npm run build
```

**Operational follow-up:** Rebuild the backend Docker image once after the latest stabilization changes so the running container includes the `amass` binary:
```bash
docker compose build backend
docker compose up -d backend
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
| `backend/discovery/` | Phase 3 discovery engine modules and typed discovery results. |
| `backend/analysis/` | Phase 4 cryptographic analysis engine modules and unit-tested parser/scoring logic. |
| `backend/compliance/` | Phase 5 deterministic PQC rules engine and reusable tier-application helper. |
| `backend/cbom/` | Phase 5 CycloneDX mapping, validation, persistence, and export helpers. |
| `backend/intelligence/` | Phase 6 retrieval, HNDL calculation, deterministic patch generation, roadmap generation, and remediation orchestration. |
| `backend/cert/` | Phase 7 certificate issuance, fallback signing, and X.509 custom extension helpers. |
| `backend/pipeline/` | Phase 8 scan orchestration, read-side assembly, and deterministic latest-artifact selection. |
| `backend/api/v1/endpoints/` | Phase 8 scan and asset API routes layered on top of the orchestrator/read service. |
| `frontend/src/app/` | Phase 9 dashboard route and global command-center shell. |
| `frontend/src/components/` | Phase 9 sidebar, header, scan form, polling UI, and UI primitives. |
| `frontend/src/lib/api.ts` | Typed frontend client for scan, result, artifact, and health API access. |
| `scripts/ingest_nist_docs.py` | Phase 6 local-only Qdrant ingestion entrypoint for the intelligence corpus. |
| `tests/integration/test_discovery_analysis_bridge.py` | Cross-phase validation of Discovery output flowing into Analysis logic. |
| `tests/integration/test_phase5_cbom_pipeline.py` | DB-backed validation of Phase 5 rules evaluation and CBOM persistence flow. |
| `tests/integration/test_phase6_remediation_pipeline.py` | DB-backed validation of Phase 6 retrieval, roadmap, and remediation persistence flow. |
| `tests/integration/test_phase7_certificate_pipeline.py` | DB-backed validation of Phase 7 certificate issuance and repository persistence flow. |
| `tests/unit/test_pipeline_orchestrator.py` | Phase 8 orchestrator coverage for lifecycle transitions, asset isolation, and duplicate-run safety. |
| `tests/integration/test_phase8_api.py` | Phase 8 API coverage for scan creation, polling, compiled results, and deterministic asset artifact retrieval. |
| `alembic.ini` | Alembic migration configuration. |
| `migrations/env.py` | Async Alembic environment with model auto-detection. |
| `docker/Dockerfile.oqs` | OQS-patched OpenSSL Docker build. |
| `docker-compose.yml` | Multi-service Docker Compose config. |
| `tests/infra/test_oqs.py` | OQS infrastructure verification tests. |

## 7. Setup Instructions
To start development:
1. **Frontend dev server:** `cd frontend && npm install && npm run dev`
2. **Frontend lint:** `cd frontend && npm run lint`
3. **Frontend build:** `cd frontend && npm run build`
4. **Docker:** `docker-compose build && docker-compose up -d`
5. **Apply migration:** `docker-compose exec backend alembic upgrade head`
6. **Discovery unit tests:** `docker compose exec backend python -m pytest tests/unit/test_aggregator.py -v`
7. **Analysis unit tests:** `docker compose exec backend python -m pytest tests/unit/test_cipher_parser.py tests/unit/test_handshake_metadata_resolver.py tests/unit/test_risk_scorer.py -v`
8. **OQS Test:** `docker compose exec backend pytest tests/infra/test_oqs.py -v`
9. **Cross-phase validation:** `docker compose exec backend python -m pytest tests/unit/test_cert_analyzer.py tests/unit/test_cert_extractor.py tests/integration/test_discovery_analysis_bridge.py -v`
10. **Phase 5 unit tests:** `docker compose exec backend python -m pytest tests/unit/test_rules_engine.py tests/unit/test_cyclonedx_mapper.py -v`
11. **Phase 5 integration tests:** `docker compose exec backend python -m pytest tests/integration/test_phase5_cbom_pipeline.py -v`
12. **Phase 6 unit tests:** `docker compose exec backend python -m pytest tests/unit/test_hndl_calculator.py tests/unit/test_patch_generator.py tests/unit/test_retrieval.py tests/unit/test_roadmap_generator.py tests/unit/test_rag_orchestrator.py -v`
13. **Phase 6 integration tests:** `docker compose exec backend python -m pytest tests/integration/test_ingest_nist_docs.py tests/integration/test_phase6_remediation_pipeline.py -v`
14. **Phase 7 unit tests:** `docker compose exec backend python -m pytest tests/unit/test_certificate_signer.py tests/unit/test_certificate_oid_encoding.py -v`
15. **Phase 7 integration tests:** `docker compose exec backend python -m pytest tests/integration/test_phase7_certificate_pipeline.py -v`
16. **Phase 7 runtime tests:** `docker compose exec backend python -m pytest tests/infra/test_certificate_signing_runtime.py -v`
17. **Phase 8 orchestrator/API tests:** `docker compose exec backend python -m pytest tests/unit/test_pipeline_orchestrator.py tests/integration/test_phase8_api.py -v`
18. **Broad backend regression:** `docker compose exec backend python -m pytest tests/unit tests/integration tests/infra/test_oqs.py tests/infra/test_certificate_signing_runtime.py -v`
19. **Live discovery validator:** `docker compose exec backend python tests/infra/validate_phase3_full.py`
20. **Health Check:** `curl http://localhost:8000/health`

