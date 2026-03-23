# Aegis - AI Engineering Roadmap (TODO)

This document translates the system architecture defined in `SOLUTION.md` and `IMPLEMENTATION.md` into a strictly chronological engineering roadmap. It is designed for AI coding agents to execute in small, atomic, and deterministic implementation steps.

## Phase 1: Project Scaffolding & Infrastructure
- [ ] Initialize Python backend project structure (create `backend/` directory, `pyproject.toml`, `requirements.txt` with all dependencies from `IMPLEMENTATION.md` Section 4).
- [ ] Initialize Next.js 14 frontend project structure (create `frontend/` directory, configure Tailwind CSS and `shadcn/ui`).
- [ ] Create `docker/Dockerfile.oqs` to compile OpenSSL 3.x with the OQS provider from source.
- [ ] Create `docker-compose.yml` defining services: `backend`, `postgres`, `qdrant`, `dify`.
- [ ] Implement a basic health check script (`tests/infra/test_oqs.py`) to verify the OQS-patched OpenSSL container runs correctly via `oqs-python`.

## Phase 2: Database Schema & ORM Setup
- [ ] Setup SQLAlchemy async engine and base declarative models in `backend/database/`.
- [ ] Implement `ScanJob` SQLAlchemy model and generate Alembic migration.
- [ ] Implement `DiscoveredAsset` SQLAlchemy model and generate Alembic migration.
- [ ] Implement `CryptoAssessment` SQLAlchemy model and generate Alembic migration.
- [ ] Implement `CertificateChain` SQLAlchemy model and generate Alembic migration.
- [ ] Implement `CbomDocument` SQLAlchemy model (with JSONB `cbom_json`) and generate Alembic migration.
- [ ] Implement `ComplianceCertificate` SQLAlchemy model and generate Alembic migration.
- [ ] Implement `RemediationBundle` SQLAlchemy model and generate Alembic migration.
- [ ] Create repository/DAO classes for core CRUD operations on all models.

## Phase 3: Core Discovery Engine
- [ ] Create `backend/discovery/dns_enumerator.py` integrating `Amass` subprocess calls for subdomain enumeration and certificate transparency log queries.
- [ ] Create `backend/discovery/dns_validator.py` integrating `DNSx` for DNS resolution and validation.
- [ ] Create `backend/discovery/port_scanner.py` integrating `python-nmap` (TCP 443/8443/4443 and UDP 500/4500/1194).
- [ ] Create `backend/discovery/tls_probe.py` using `sslyze` to perform TLS ClientHello with full cipher offering, extracting server cipher preference and full certificate chain.
- [ ] Create `backend/discovery/cert_extractor.py` to retrieve leaf, intermediate, and root certificates with metadata from the TLS probe results.
- [ ] Implement asset deduplication and scope validation logic in `backend/discovery/aggregator.py`.
- [ ] Write unit tests for asset deduplication and scope validation.
- [ ] (Optional) Create `backend/discovery/api_inspector.py` — JWT Authorization header `alg` field extraction for accessible API endpoints.
- [ ] (Optional) Create `backend/discovery/vpn_probe.py` — IKEv2 SA_INIT and OpenVPN detection (partial analysis only).

## Phase 4: Cryptographic Analysis Engine
- [ ] Create `backend/analysis/cipher_parser.py` with regex logic to split TLS 1.2 and 1.3 cipher strings into `kex` / `auth` / `enc` / `mac` components.
- [ ] Implement the `VULNERABILITY_MAP` lookup table structure in `backend/analysis/constants.py`.
- [ ] Write unit tests for `cipher_parser.py` covering TLS 1.2, TLS 1.3, hybrid PQC, and edge-case cipher strings.
- [ ] Create `backend/analysis/cert_analyzer.py` to extract leaf, intermediate, and root certificate metrics and set `quantumSafe` boolean.
- [ ] Create `backend/analysis/risk_scorer.py` implementing the formula `(0.45 × V_kex) + (0.35 × V_sig) + (0.10 × V_sym) + (0.10 × V_tls)` with component-level breakdown.
- [ ] Write unit tests validating risk score outputs against the documented example (ECDHE + RSA-2048 + AES-256-GCM + TLS 1.2 → 84.5).

## Phase 5: PQC Rules Engine & CBOM Generation
- [ ] Create `backend/compliance/rules_engine.py` with deterministic PASS/HYBRID/FAIL logic for KEX, SIG, and SYM dimensions.
- [ ] Implement the 3-tier aggregation logic (`FULLY_QUANTUM_SAFE`, `PQC_TRANSITIONING`, `QUANTUM_VULNERABLE`) in `rules_engine.py`.
- [ ] Write unit tests ensuring the compliance rules engine truth table is correct and deterministic for all combinations.
- [ ] Create `backend/cbom/cyclonedx_mapper.py` to map the crypto assessment payload to the CycloneDX 1.6 JSON schema with `cryptoProperties` and `quantumRiskSummary`.
- [ ] Implement deterministic CBOM serial number scheme (`urn:uuid:aegis-scan-{date}-{hostname}`).
- [ ] Implement CBOM persistence (storing the mapped CycloneDX JSONB into the `CbomDocument` repository).
- [ ] Implement CBOM JSON export endpoint logic.
- [ ] Implement CBOM PDF export logic (using `weasyprint` or `reportlab`).

## Phase 6: Threat Intelligence (RAG) & Remediation
- [ ] Implement script `scripts/ingest_nist_docs.py` to chunk and embed NIST reference PDFs (FIPS 203, 204, 205, SP 800-208, IR 8547, IBM/Google qubit roadmaps, IETF hybrid KEX drafts) into Qdrant.
- [ ] Set up basic API client in `backend/intelligence/dify_client.py` to communicate with Dify workflow endpoints.
- [ ] Create `backend/intelligence/hndl_calculator.py` implementing `BreakYear = CurrentYear + (RequiredLogicalQubits / ProjectedQubitGrowthRate)` with the `QUBIT_REQUIREMENTS` constants.
- [ ] Create `backend/intelligence/patch_generator.py` with templates for nginx (`ssl_ecdh_curve X25519MLKEM768`) and Apache (`SSLOpenSSLConfCmd Curves X25519MLKEM768`) PQC directives, preserving AES-256-GCM as-is.
- [ ] Integrate generated HNDL timelines, patches, and migration roadmaps into the `RemediationBundle` persistence layer with source citations.

## Phase 7: Certification Engine
- [ ] Create `backend/cert/signer.py` wrapping the `liboqs` / OQS OpenSSL subprocess for generating ML-DSA-65 signed X.509 certificates.
- [ ] Implement fallback ECDSA signing logic using Python's `cryptography` library in `signer.py`.
- [ ] Implement custom OID extension injection (`PQC-STATUS`, `FIPS-COMPLIANT`, `BROKEN-ALGORITHMS`, `Remediation-Bundle-ID`) based on compliance tier.
- [ ] Implement three-tier certificate issuance logic: Tier 1 → 90-day, Tier 2 → 30-day, Tier 3 → 7-day validity.
- [ ] Write unit tests verifying generated certificates parse correctly and contain the required OID extensions.
- [ ] Persist generated certificates into the `ComplianceCertificate` repository.

## Phase 8: Pipeline Orchestrator & API
- [ ] Create `backend/pipeline/orchestrator.py` — the async orchestrator that chains Discovery → Analysis → CBOM → Rules → (RAG + Cert in parallel) and writes all results to PostgreSQL.
- [ ] Initialize FastAPI app with CORS middleware and global exception handlers in `backend/main.py`.
- [ ] Implement `POST /api/v1/scan` endpoint to accept targets, trigger the async pipeline orchestrator, and return `scan_id`.
- [ ] Implement `GET /api/v1/scan/{scan_id}` endpoint for scan status and progress polling.
- [ ] Implement `GET /api/v1/scan/{scan_id}/results` endpoint to return compiled assessment data.
- [ ] Implement `GET /api/v1/assets/{asset_id}/cbom` endpoint for CBOM JSON download.
- [ ] Implement `GET /api/v1/assets/{asset_id}/certificate` endpoint for X.509 PEM download.
- [ ] Implement `GET /api/v1/assets/{asset_id}/remediation` endpoint for patch, HNDL timeline, and migration roadmap retrieval.

## Phase 9: Frontend Foundation
- [ ] Setup Next.js page layout and navigation shell (Sidebar, Header) using `shadcn-ui`.
- [ ] Create API client utilities in `frontend/lib/api.ts` to connect to the FastAPI backend.
- [ ] Implement the "New Scan" form component (Target IP/Domain/CIDR input, trigger button).
- [ ] Implement scan polling UI with a progress indicator for the async backend pipeline.

## Phase 10: Frontend Dashboards & Integration
- [ ] Build the "Risk Heatmap" component using `Recharts` to display aggregate quantum risk scores across all scanned assets.
- [ ] Implement the CBOM Viewer component (expandable JSON tree focusing on `cryptoProperties` and `quantumRiskSummary`).
- [ ] Implement the Certificate Viewer component (displaying tier badge, validity window, signing algorithm, and embedded OID extensions).
- [ ] Implement the HNDL Timeline & Remediation view (displaying HNDL break year, patch snippets, migration roadmap, and NIST source citations).
- [ ] Create the Dual Report Layout (tabs for "CISO Summary" executive view and "Engineer Details" technical view).
- [ ] Verify frontend-to-backend end-to-end integration by scanning a public test target (e.g., `testssl.sh`).
