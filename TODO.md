# Aegis - AI Engineering Roadmap (TODO)

This document translates the system architecture defined in `SOLUTION.md` and `IMPLEMENTATION.md` into a strictly chronological engineering roadmap. It is designed for AI coding agents to execute in small, atomic, and deterministic implementation steps.

## Phase 1: Project Scaffolding & Infrastructure
- [x] Initialize Python backend project structure (create `backend/` directory, `pyproject.toml`, `requirements.txt` with all dependencies from `IMPLEMENTATION.md` Section 4).
- [x] Initialize Next.js 14 frontend project structure (create `frontend/` directory, configure Tailwind CSS and `shadcn/ui`).
- [x] Create `docker/Dockerfile.oqs` to compile OpenSSL 3.x with the OQS provider from source.
- [x] Create `docker-compose.yml` defining services: `backend`, `postgres`, `qdrant`.
- [x] Implement a basic health check script (`tests/infra/test_oqs.py`) to verify the OQS-patched OpenSSL container runs correctly via `oqs-python`.

## Phase 2: Database Schema & ORM Setup
- [x] Setup SQLAlchemy async engine and base declarative models in `backend/models/`.
- [x] Implement `ScanJob` SQLAlchemy model and generate Alembic migration.
- [x] Implement `DiscoveredAsset` SQLAlchemy model and generate Alembic migration.
- [x] Implement `CryptoAssessment` SQLAlchemy model and generate Alembic migration.
- [x] Implement `CertificateChain` SQLAlchemy model and generate Alembic migration.
- [x] Implement `CbomDocument` SQLAlchemy model (with JSONB `cbom_json`) and generate Alembic migration.
- [x] Implement `ComplianceCertificate` SQLAlchemy model and generate Alembic migration.
- [x] Implement `RemediationBundle` SQLAlchemy model and generate Alembic migration.
- [x] Create repository/DAO classes for core CRUD operations on all models.

## Phase 3: Core Discovery Engine
- [x] Create `backend/discovery/dns_enumerator.py` integrating `Amass` subprocess calls for subdomain enumeration and certificate transparency log queries.
- [x] Create `backend/discovery/dns_validator.py` integrating `DNSx` for DNS resolution and validation.
- [x] Create `backend/discovery/port_scanner.py` integrating `python-nmap` (TCP 443/8443/4443 and UDP 500/4500/1194).
- [x] Create `backend/discovery/tls_probe.py` using `sslyze` to perform TLS ClientHello with full cipher offering, extracting server cipher preference and full certificate chain.
- [x] Create `backend/discovery/cert_extractor.py` to retrieve leaf, intermediate, and root certificates with metadata from the TLS probe results.
- [x] Implement asset deduplication and scope validation logic in `backend/discovery/aggregator.py`.
- [x] Write unit tests for asset deduplication and scope validation.
- [x] (Optional) Create `backend/discovery/api_inspector.py` — JWT Authorization header `alg` field extraction for accessible API endpoints.
- [x] (Optional) Create `backend/discovery/vpn_probe.py` — IKEv2 SA_INIT and OpenVPN detection (partial analysis only).

## Phase 4: Cryptographic Analysis Engine
- [x] Create `backend/analysis/cipher_parser.py` with regex logic to split **TLS 1.2** cipher strings (format: `TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384`) into `kex` / `auth` / `enc` / `mac` components.
- [x] Create `backend/analysis/handshake_metadata_resolver.py` to handle **TLS 1.3** extraction — kex and auth are not present in TLS 1.3 cipher strings and must be derived from sslyze handshake/session metadata.
- [x] Implement the `VULNERABILITY_MAP` and `TLS_VULNERABILITY_MAP` lookup table structures in `backend/analysis/constants.py`.
- [x] Write unit tests for `cipher_parser.py` covering TLS 1.2, hybrid PQC, and edge-case cipher strings.
- [x] Write unit tests for `handshake_metadata_resolver.py` covering TLS 1.3 handshake metadata extraction.
- [x] Create `backend/analysis/cert_analyzer.py` to extract leaf, intermediate, and root certificate metrics and set `quantumSafe` boolean.
- [x] Create `backend/analysis/risk_scorer.py` implementing the formula `Score = 100 × ((0.45 × V_kex) + (0.35 × V_sig) + (0.10 × V_sym) + (0.10 × V_tls))` with component-level breakdown.
- [x] Write unit tests validating risk score outputs against the documented example (ECDHE + RSA-2048 + AES-256-GCM + TLS 1.2 → 84.5 on a 0–100 scale).

## Phase 5: PQC Rules Engine & CBOM Generation
- [x] Create `backend/compliance/rules_engine.py` with deterministic PASS/HYBRID/FAIL logic for KEX, SIG, and SYM dimensions.
- [x] Implement the 3-tier aggregation logic (`FULLY_QUANTUM_SAFE`, `PQC_TRANSITIONING`, `QUANTUM_VULNERABLE`) in `rules_engine.py`.
- [x] Write unit tests ensuring the compliance rules engine truth table is correct and deterministic for all combinations.
- [x] Create `backend/cbom/cyclonedx_mapper.py` to map the crypto assessment payload to the CycloneDX 1.6 JSON schema with `cryptoProperties` and `quantumRiskSummary`.
- [x] Implement deterministic scan-scoped CBOM serial number scheme (`urn:aegis:scan:{date}:{hostname-or-ip}:{port}:{asset_uuid}`).
- [x] Implement CBOM persistence (storing the mapped CycloneDX JSONB into the `CbomDocument` repository).
- [x] Implement CBOM JSON export endpoint logic.
- [x] Implement CBOM PDF export logic (using `weasyprint` or `reportlab`).

## Phase 6: Threat Intelligence (RAG) & Remediation
- [x] Implement script `scripts/ingest_nist_docs.py` to chunk and embed NIST reference PDFs (FIPS 203, 204, 205, SP 800-208, IR 8547, IBM/Google qubit roadmaps, IETF hybrid KEX drafts) into Qdrant.
- [x] Set up LangChain **in-process** within the FastAPI backend (not a separate Docker service) for HNDL timeline, patch generation, and migration roadmap workflows in `backend/intelligence/rag_orchestrator.py`.
- [x] Create `backend/intelligence/hndl_calculator.py` implementing `BreakYear = CurrentYear + (RequiredLogicalQubits / ProjectedQubitGrowthRate)` with the `QUBIT_REQUIREMENTS` constants.
- [x] Create `backend/intelligence/patch_generator.py` with templates for nginx (`ssl_ecdh_curve X25519MLKEM768:X25519`) and Apache (`SSLOpenSSLConfCmd Curves X25519MLKEM768:X25519`) PQC directives, preserving AES-256-GCM as-is.
- [x] Integrate generated HNDL timelines, patches, and migration roadmaps into the `RemediationBundle` persistence layer with source citations.

## Phase 7: Certification Engine
- [x] Create `backend/cert/signer.py` wrapping the `liboqs` / OQS OpenSSL subprocess for generating ML-DSA-65 signed X.509 certificates.
- [x] Implement fallback ECDSA signing logic using Python's `cryptography` library in `signer.py`.
- [x] Implement custom OID extension injection (`PQC-STATUS`, `FIPS-COMPLIANT`, `BROKEN-ALGORITHMS`, `Remediation-Bundle-ID`) based on compliance tier.
- [x] Implement three-tier certificate issuance logic: Tier 1 → 90-day, Tier 2 → 30-day, Tier 3 → 7-day validity.
- [x] Write unit tests verifying generated certificates parse correctly and contain the required OID extensions.
- [x] Persist generated certificates into the `ComplianceCertificate` repository.

## Phase 8: Pipeline Orchestrator & API
- [x] Create `backend/pipeline/orchestrator.py` - the async orchestrator that chains Discovery -> Analysis -> CBOM -> PQC Rules Engine -> Certification (all assets) and RAG (Tier 2 / Tier 3 only, triggered only after Rules classification), then writes all results to PostgreSQL.
- [x] Initialize FastAPI app with CORS middleware and global exception handlers in `backend/main.py`.
- [x] Implement `POST /api/v1/scan` endpoint to accept targets, trigger the async pipeline orchestrator, and return `scan_id`.
- [x] Implement `GET /api/v1/scan/{scan_id}` endpoint for scan status and progress polling.
- [x] Implement `GET /api/v1/scan/{scan_id}/results` endpoint to return compiled assessment data.
- [x] Implement `GET /api/v1/assets/{asset_id}/cbom` endpoint for CBOM JSON download.
- [x] Implement `GET /api/v1/assets/{asset_id}/certificate` endpoint for X.509 certificate JSON retrieval.
- [x] Implement `GET /api/v1/assets/{asset_id}/remediation` endpoint for patch, HNDL timeline, and migration roadmap retrieval.

## Phase 9: Frontend Foundation
- [x] Setup Next.js page layout and navigation shell (Sidebar, Header) using `shadcn-ui`.
- [x] Create API client utilities in `frontend/lib/api.ts` to connect to the FastAPI backend.
- [x] Implement the "New Scan" form component (Target IP/Domain/CIDR input, trigger button).
- [x] Implement scan polling UI with progress counters, stage telemetry, degraded-mode notices, and a resilient command-center presentation for the async backend pipeline.

## Phase 10: Frontend Dashboards & Integration
- [x] Build the "Risk Heatmap" component using `Recharts` to display aggregate quantum risk scores across all scanned assets.
- [x] Implement the CBOM Viewer component (expandable JSON tree focusing on `cryptoProperties` and `quantumRiskSummary`).
- [x] Implement the Certificate Viewer component (displaying tier badge, validity window, signing algorithm, and embedded OID extensions).
- [x] Implement the HNDL Timeline & Remediation view (displaying HNDL break year, patch snippets, migration roadmap, and NIST source citations).
- [x] Create the Dual Report Layout (tabs for "CISO Summary" executive view and "Engineer Details" technical view).
- [ ] Verify frontend-to-backend end-to-end integration by scanning a public test target (e.g., `testssl.sh`).

## Final Prototype UX & Jury Positioning
- [x] Add read-only Mission Control overview and lightweight scan history endpoints on top of the existing scan-centric backend.
- [x] Add frontend-local saved targets and recent launch context without introducing a backend target model.
- [x] Redesign `/` into a banking-grade Mission Control surface with posture overview, structured scan workflow, recent scans, priority findings, and deterministic quick actions.
- [x] Add a lightweight `/history` timeline route for recent scan activity.
- [x] Upgrade the risk heatmap, asset workbench, and reporting routes with stronger banking context, prioritization cues, and evidence export affordances.

## Continuous Monitoring & Scheduling
- [ ] Implement scheduled scans using APScheduler / cron
- [ ] Allow users to configure scan frequency per target
- [ ] Store historical scan results for comparison
- [ ] Implement diffing between scans (risk score + tier changes)
- [ ] Trigger alerts when:
      - risk score increases
      - certification tier drops

