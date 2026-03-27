# Aegis — Quantum Cryptographic Intelligence Platform: Implementation Plan

---

## 1. Project Overview

**Aegis** is a continuous, autonomous Cryptographic Intelligence Platform designed for the banking sector. It solves a critical and time-sensitive problem: banks' public-facing infrastructure (APIs, web servers, VPN endpoints) uses classical cryptography (RSA, ECDH, ECDSA) that will be completely broken by quantum computers via Shor's algorithm. Adversaries are already intercepting and archiving encrypted traffic today — the **Harvest Now, Decrypt Later (HNDL)** attack — waiting for a Cryptanalytically Relevant Quantum Computer (CRQC), estimated within 8–12 years.

Banks currently have **no automated tooling** to:
- Discover which public assets use quantum-vulnerable cryptography
- Produce a structured Cryptographic Bill of Materials (CBOM)
- Compute evidence-based timelines for when each asset becomes decryptable
- Generate deployment-ready Post-Quantum Cryptography (PQC) configuration patches

Aegis fills this gap by discovering, inventorying, evaluating, scoring, remediating, and certifying every public-facing cryptographic surface.

---

## 2. System Architecture

### 2.1 Layer Overview

The system is organized into **7 logical layers** plus a containerization layer:

| Layer | Name | Purpose |
|-------|------|---------|
| Input | Input Layer | Accepts scan requests via Next.js dashboard, REST API, or scheduler |
| L1 | Discovery Engine | Enumerates public-facing cryptographic surfaces (DNS, ports, TLS probes) |
| L2 | Cryptographic Analysis Engine | Decomposes cipher suites, analyzes cert chains, computes risk scores, classifies PQC status |
| L3 | CBOM Generation | Maps data to CycloneDX 1.6 CBOM, stores in PostgreSQL |
| L4 | Threat Intelligence RAG | Generates HNDL timelines, server-specific patches via LangChain + Qdrant |
| L5 | Certification Engine | Issues signed X.509 compliance certificates in three tiers |
| Output | Output Layer | Dashboard, dual reports (CISO + Engineer), certificate viewer |
| Infra | Container Layer | Docker + Compose with OQS-patched OpenSSL compiled from source |

### 2.2 Data Flow

```
Analyst → Next.js UI → POST /scan → FastAPI Backend → Discovery Engine (async)
  → DNS enumeration + Port scan + TLS ClientHello
  → Crypto Analyzer (cipher parsing + cert chain extraction)
  → CBOM Generator (CycloneDX 1.6 JSON → PostgreSQL)
  → PQC Rules Engine branches into:
      ├─ All PASS → Cert Signer: Fully Quantum Safe (90-day X.509)
      ├─ Hybrid only → Cert Signer: PQC Transitioning (30-day X.509) + RAG transition roadmap
      └─ Any FAIL → RAG Pipeline (HNDL timeline + patch generation) + Cert Signer: Quantum Vulnerable (7-day X.509)
  → Compiled result → Dashboard
```

> [!IMPORTANT]
> The pipeline follows a strict sequential flow: `CBOM → PQC Rules Engine → Certification Engine`. The Certification Engine depends on the Rules Engine output (compliance tier). The RAG pipeline is triggered **only for Tier 2 / Tier 3 assets** after the Rules Engine has classified the tier. The RAG pipeline has **no write access** to risk scores, compliance tier decisions, or certificate content — all security decisions are deterministic.

### 2.3 Component Interaction

- **FastAPI** is the central orchestrator — receives scan requests, spawns async tasks, aggregates results.
- **Discovery Engine** feeds raw endpoints to **Crypto Analyzer**.
- **Crypto Analyzer** produces structured data for the **CBOM Generator**.
- **CBOM Generator** writes to **PostgreSQL** and passes records to the **PQC Rules Engine**. The Rules Engine then passes its compliance tier output to the **Certification Engine**.
- **PQC Rules Engine** is a deterministic boolean engine that decides the compliance tier — no AI involved.
- **RAG Pipeline** (LangChain + Qdrant) is triggered only for vulnerable/transitioning assets to produce HNDL timelines and patches.
- **Cert Signer** issues X.509 certificates signed with ML-DSA-65 (via liboqs/OQS OpenSSL).

---

## 3. Modules / Components Breakdown

### 3.1 Discovery Engine

| Aspect | Detail |
|--------|--------|
| **Purpose** | Enumerate all public-facing cryptographic surfaces for a given target |
| **Input** | Domain name, IP address, or CIDR range |
| **Output** | Deduplicated list of live cryptographic surfaces with metadata |
| **Sub-modules** | DNS Enumeration (Amass + DNSx), Port Scanner (python-nmap), TLS ClientHello Probe, API Surface Inspector (optional — JWT `alg` header), VPN Endpoint Detector (partial — IKEv2), Certificate Chain Extractor, Asset Aggregator |
| **Connects to** | Crypto Analyzer (downstream) |

### 3.2 Cipher Suite Parser

| Aspect | Detail |
|--------|--------|
| **Purpose** | Decompose TLS cipher strings into 4 independent components and map each to quantum threat |
| **Input** | Raw TLS cipher string (handles both TLS 1.2 and TLS 1.3 formats) |
| **Output** | Four components: key exchange, authentication, encryption, integrity — each with vulnerability value (V: 0.00–1.00) |
| **Logic** | Regex + delimiter-based splitting; lookup table for quantum threat classification |

> **Note: TLS 1.3 cipher suites do not expose key exchange or authentication details in the cipher string.**
> For TLS 1.3:
> - Cipher parsing must be separated from handshake analysis
> - KEX/authentication must be derived from handshake/session metadata
>
> Implementation split:
> - `cipher_parser.py` → handles TLS 1.2 parsing
> - `handshake_metadata_resolver.py` → handles TLS 1.3 extraction
| **Connects to** | Risk Scoring Engine, PQC Classification |

### 3.3 Certificate Chain Analyzer

| Aspect | Detail |
|--------|--------|
| **Purpose** | Extract and analyze leaf, intermediate, and root certificates |
| **Input** | Certificate chain from TLS handshake |
| **Output** | Public key algorithm, key size, signature algorithm, `quantumSafe` boolean per cert |
| **Connects to** | CBOM Generator |

### 3.4 Quantum Risk Scoring Engine

| Aspect | Detail |
|--------|--------|
| **Purpose** | Compute numeric quantum risk score (0–100) per asset |
| **Input** | Four vulnerability values from Cipher Suite Parser |
| **Output** | Score 0–100 with component-level breakdown |
| **Formula** | `Score = 100 × ((0.45 × V_kex) + (0.35 × V_sig) + (0.10 × V_sym) + (0.10 × V_tls))` |
| **Connects to** | PQC Compliance Engine, CBOM Generator |

### 3.5 PQC Compliance Engine (Rules Engine)

| Aspect | Detail |
|--------|--------|
| **Purpose** | Deterministic boolean classification into three compliance tiers |
| **Input** | Parsed CBOM with algorithm data per asset |
| **Output** | Tier: `FULLY_QUANTUM_SAFE`, `PQC_TRANSITIONING`, or `QUANTUM_VULNERABLE` |
| **Logic** | Three independent checks: KEX (PASS/HYBRID/FAIL), SIG (PASS/HYBRID/FAIL), SYM (OK/WARN/FAIL). Aggregation: all PASS → Tier 1; no FAIL + hybrid present → Tier 2; any FAIL → Tier 3 |
| **Connects to** | Certification Engine, RAG Pipeline (triggers it for Tier 2/3) |

> [!CAUTION]
> This engine must be **fully deterministic** — no LLM, no probabilistic system. Security decisions cannot hallucinate.

### 3.6 CBOM Generator

| Aspect | Detail |
|--------|--------|
| **Purpose** | Produce CycloneDX 1.6-compliant Cryptographic Bill of Materials |
| **Input** | Structured crypto data from analyzer + risk scores |
| **Output** | CBOM JSON document with `cryptoProperties` schema, stored as JSONB in PostgreSQL |
| **Structure** | Per-asset document containing: TLS version, cipher suite, decomposed algorithms, cert metadata, `quantumRiskSummary` block |
| **Connects to** | PostgreSQL (storage), PQC Rules Engine, Export (JSON/PDF download) |

### 3.7 HNDL Timeline Calculator

| Aspect | Detail |
|--------|--------|
| **Purpose** | Compute per-asset break year based on published qubit roadmaps |
| **Input** | Algorithm type from CBOM |
| **Output** | Estimated break year with source attribution |
| **Formula** | `BreakYear = CurrentYear + (RequiredLogicalQubits / ProjectedQubitGrowthRate)` |
| **Connects to** | RAG Pipeline (part of LangChain workflow) |

### 3.8 RAG Pipeline (Threat Intelligence)

| Aspect | Detail |
|--------|--------|
| **Purpose** | Generate HNDL timelines, server-specific patches, and migration roadmaps |
| **Input** | Vulnerable CBOM data (asset type + cipher details) |
| **Output** | Three artifacts: HNDL timeline, server-specific PQC config patch, phased migration roadmap |
| **Stack** | LangChain (workflow orchestrator) + Qdrant (vector DB with NIST doc embeddings) |
| **Connects to** | PostgreSQL (stores outputs), Output Layer (surfaces in reports) |

### 3.9 Patch Generator

| Aspect | Detail |
|--------|--------|
| **Purpose** | Generate deployable server-specific PQC configuration patches |
| **Input** | Detected server type + current cipher config |
| **Output** | nginx config with `ssl_ecdh_curve X25519MLKEM768:X25519`, Apache config with `SSLOpenSSLConfCmd`, etc. |
| **Key detail** | Patches require OQS-provider-patched OpenSSL. AES-256-GCM is left unchanged (quantum-acceptable). |
| **Connects to** | RAG Pipeline (invoked by LangChain workflow) |

### 3.10 Certification Engine (X.509 Signer)

| Aspect | Detail |
|--------|--------|
| **Purpose** | Issue signed X.509 compliance certificates per asset |
| **Input** | Compliance tier from PQC Rules Engine |
| **Output** | Signed X.509 certificate with custom OID extensions (PQC-STATUS, FIPS-COMPLIANT, etc.) |
| **Logic** | Tier 1 → 90-day cert; Tier 2 → 30-day cert; Tier 3 → 7-day cert + remediation bundle ID |
| **Signing** | Primary: ML-DSA-65 via OQS OpenSSL subprocess. Fallback: ECDSA with same custom OID extensions. |
| **Connects to** | PostgreSQL (stores certs), Output Layer |

### 3.11 FastAPI Backend

| Aspect | Detail |
|--------|--------|
| **Purpose** | REST API orchestration layer |
| **Key endpoints** | `POST /api/v1/scan`, scan status, CBOM retrieval, cert download, report export |
| **Async model** | asyncio + httpx for concurrent TLS probing (up to 50 concurrent handshakes) |
| **Connects to** | All internal modules; Next.js frontend |

### 3.12 Next.js Dashboard (Frontend)

| Aspect | Detail |
|--------|--------|
| **Purpose** | Security analyst interface with risk heatmap, CBOM viewer, cert renderer, dual reports |
| **Stack** | Next.js 14 (App Router) + Tailwind CSS + shadcn/ui + Recharts |
| **Views** | Risk heatmap, expandable CBOM viewer, certificate viewer/verifier, CISO report view, Engineer report view |

---

## 4. Technology Stack

### Backend
| Technology | Purpose |
|-----------|---------|
| Python 3.11 | Core language |
| FastAPI | REST API framework + async scan orchestration |
| asyncio + httpx | Concurrent TLS probing (replaces Celery + Redis) |
| PostgreSQL 15 | CBOM storage, cert store, audit log (JSONB for CBOM) |
| SQLAlchemy / asyncpg | Database ORM / driver |

### Cryptographic Stack
| Technology | Purpose |
|-----------|---------|
| sslyze | TLS handshake engine |
| pyOpenSSL | TLS operations (requires OQS-patched OpenSSL) |
| Python `cryptography` lib | X.509 operations, cert parsing |
| liboqs via `oqs-python` | Real ML-KEM, ML-DSA, SLH-DSA operations |
| OQS OpenSSL provider | Enables PQC cipher suite negotiation in TLS |

### Discovery Tools
| Technology | Purpose |
|-----------|---------|
| Amass | Subdomain enumeration + cert transparency logs |
| DNSx | DNS resolution and validation |
| python-nmap | Port scanning (TCP + UDP) |

### Intelligence Stack
| Technology | Purpose |
|-----------|---------|
| LangChain | RAG workflow orchestration — runs **in-process** within the FastAPI backend (not a separate service) |
| Qdrant | Vector database holding NIST document embeddings |
| LLM (via LangChain) | Generates HNDL reports, patches, migration roadmaps |

### Frontend
| Technology | Purpose |
|-----------|---------|
| Next.js 14 (App Router) | Web dashboard framework |
| Tailwind CSS + shadcn/ui | Styling and UI components |
| Recharts | Risk heatmap visualization |

### Infrastructure
| Technology | Purpose |
|-----------|---------|
| Docker + Docker Compose | Containerization; OQS-OpenSSL compiled from source inside container |

---

## 5. Data Model / Data Structures

### 5.1 Database Entities (PostgreSQL)

#### `scan_jobs`
| Column | Type | Description |
|--------|------|-------------|
| id | UUID (PK) | Unique scan identifier |
| target | TEXT | Domain / IP / CIDR input |
| status | ENUM | `pending`, `running`, `completed`, `failed` |
| created_at | TIMESTAMP | Scan request time |
| completed_at | TIMESTAMP | Scan completion time |

#### `discovered_assets`
| Column | Type | Description |
|--------|------|-------------|
| id | UUID (PK) | Unique asset identifier |
| scan_id | UUID (FK → scan_jobs) | Parent scan |
| hostname | TEXT | Resolved hostname |
| ip_address | TEXT | IP address (stored as TEXT, not INET — asyncpg has limited native INET support) |
| port | INTEGER | Port number |
| protocol | TEXT | tcp / udp |
| service_type | TEXT | `tls`, `vpn`, `api` |
| server_software | TEXT | Detected server (nginx, Apache, etc.) |

#### `crypto_assessments`
| Column | Type | Description |
|--------|------|-------------|
| id | UUID (PK) | |
| asset_id | UUID (FK → discovered_assets) | |
| tls_version | TEXT | e.g. `1.2`, `1.3` |
| cipher_suite | TEXT | Full cipher string |
| kex_algorithm | TEXT | Key exchange algorithm |
| auth_algorithm | TEXT | Authentication algorithm |
| enc_algorithm | TEXT | Symmetric encryption algorithm |
| mac_algorithm | TEXT | Integrity/MAC algorithm |
| kex_vulnerability | FLOAT | V_kex (0.00–1.00) |
| sig_vulnerability | FLOAT | V_sig (0.00–1.00) |
| sym_vulnerability | FLOAT | V_sym (0.00–1.00) |
| tls_vulnerability | FLOAT | V_tls (0.00–1.00) |
| risk_score | FLOAT | Computed quantum risk (0–100) |
| compliance_tier | ENUM | `FULLY_QUANTUM_SAFE`, `PQC_TRANSITIONING`, `QUANTUM_VULNERABLE` |

#### `certificate_chains`
| Column | Type | Description |
|--------|------|-------------|
| id | UUID (PK) | |
| asset_id | UUID (FK → discovered_assets) | |
| cert_level | TEXT | `leaf`, `intermediate`, `root` |
| subject | TEXT | Certificate subject |
| issuer | TEXT | Certificate issuer |
| public_key_algorithm | TEXT | e.g. RSA, ECDSA |
| key_size_bits | INTEGER | Key size |
| signature_algorithm | TEXT | e.g. SHA256withRSA |
| quantum_safe | BOOLEAN | |
| not_before | TIMESTAMP | |
| not_after | TIMESTAMP | |

#### `cbom_documents`
| Column | Type | Description |
|--------|------|-------------|
| id | UUID (PK) | |
| scan_id | UUID (FK → scan_jobs) | |
| asset_id | UUID (FK → discovered_assets) | |
| serial_number | TEXT | Deterministic scan-scoped URN (`urn:aegis:scan:{date}:{hostname-or-ip}:{port}:{asset_uuid}`) |
| cbom_json | JSONB | Full CycloneDX 1.6 CBOM document |
| created_at | TIMESTAMP | |

#### `compliance_certificates`
| Column | Type | Description |
|--------|------|-------------|
| id | UUID (PK) | |
| asset_id | UUID (FK → discovered_assets) | |
| tier | ENUM | Three-tier classification |
| certificate_pem | TEXT | Signed X.509 PEM |
| signing_algorithm | TEXT | `ML-DSA-65` or `ECDSA` (fallback) |
| valid_from | TIMESTAMP | |
| valid_until | TIMESTAMP | 90/30/7 days from issuance |
| extensions_json | JSONB | Custom OID extension data |
| remediation_bundle_id | UUID (FK, nullable) | Links to remediation for Tier 3 |

#### `remediation_bundles`
| Column | Type | Description |
|--------|------|-------------|
| id | UUID (PK) | |
| asset_id | UUID (FK → discovered_assets) | |
| hndl_timeline | JSONB | Per-algorithm break year with sources |
| patch_config | TEXT | Server-specific PQC config patch |
| migration_roadmap | TEXT | Phased migration plan |
| source_citations | JSONB | NIST doc references |
| created_at | TIMESTAMP | |

### 5.2 Key Data Structures (In-Code)

```python
# Vulnerability lookup table
VULNERABILITY_MAP = {
    "kex": {
        "RSA": 1.00, "ECDHE": 1.00, "ECDH": 1.00, "DHE": 1.00, "DH": 1.00,
        "X25519_MLKEM768": 0.30,
        "MLKEM512": 0.00, "MLKEM768": 0.00, "MLKEM1024": 0.00,
    },
    "sig": {
        "RSA": 1.00, "ECDSA": 1.00, "DSA": 1.00,
        "MLDSA44": 0.00, "MLDSA65": 0.00, "MLDSA87": 0.00,
        "SLHDSA": 0.00,
    },
    "sym": {
        "AES128": 0.50, "AES256": 0.05, "AES256GCM": 0.05,
        "3DES": 1.00, "DES": 1.00, "RC4": 1.00,
        "CHACHA20": 0.05,
    },
}

TLS_VULNERABILITY_MAP = {
    "1.0": 1.00,  # Broken — legacy protocol penalty
    "1.1": 0.80,  # Deprecated protocol penalty
    "1.2": 0.40,  # Moderate protocol-level penalty
    "1.3": 0.00,  # No legacy protocol penalty; preferred baseline
}

# HNDL qubit requirements
QUBIT_REQUIREMENTS = {
    "RSA-2048": {"logical_qubits": 4000, "growth_rate": 400, "break_year_offset": 10},
    "ECDH-P256": {"logical_qubits": 2330, "growth_rate": 400, "break_year_offset": 6},
    "RSA-4096": {"logical_qubits": 8000, "growth_rate": 400, "break_year_offset": 20},
}

# Risk score weights
WEIGHTS = {"kex": 0.45, "sig": 0.35, "sym": 0.10, "tls": 0.10}
```

---

## 6. Step-by-Step Implementation Plan

### Phase 1: Foundation & Docker Infrastructure (Days 1–2)

1. **Initialize project structure**
   - Create monorepo with `backend/`, `frontend/`, `docker/`, `docs/` directories
   - Set up Python project with `pyproject.toml` / `requirements.txt`
   - Set up Next.js 14 project in `frontend/`

2. **Build Docker environment with OQS OpenSSL**
   - Write `Dockerfile` that compiles OpenSSL 3.x with OQS provider from source
   - Write `docker-compose.yml` with services: `backend`, `postgres`, `qdrant`
   - Verify `oqs-python` works inside the container (ML-KEM key generation test)

3. **Set up PostgreSQL schema**
   - Create all tables from the data model above
   - Create migration scripts (Alembic)

---

### Phase 2: Core Scanner — Discovery Engine (Days 3–5)

4. **DNS enumeration module**
   - Integrate Amass subprocess for subdomain enumeration
   - Integrate DNSx for DNS resolution / validation
   - Certificate transparency log queries

5. **Port scanning module**
   - Integrate python-nmap for TCP (443, 8443, 4443) and UDP (500, 4500, 1194) scanning

6. **TLS ClientHello probe**
   - Use sslyze / pyOpenSSL to send a full cipher offering
   - Extract server's preferred cipher suite and full certificate chain
   - Handle both TLS 1.2 and TLS 1.3 negotiation

7. **Asset aggregator**
   - Deduplication logic
   - Scope validation (ensure scanned assets are within authorized target)

---

### Phase 3: Cryptographic Analysis Engine (Days 5–7)

8. **Cipher suite parser**
   - Regex-based decomposition into kex / auth / enc / mac
   - Handle TLS 1.2 format (`TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384`) in `cipher_parser.py`
   - Handle TLS 1.3 format (`TLS_AES_256_GCM_SHA384`) via `handshake_metadata_resolver.py` — kex/auth are **not** in the cipher string and must be derived from handshake/session metadata
   - Map each component to vulnerability value via lookup table

9. **Certificate chain analyzer**
   - Parse leaf, intermediate, root certs
   - Extract: public key algo, key size, signature algo
   - Set `quantumSafe` boolean per certificate

10. **Quantum risk scoring engine**
    - Implement weighted formula: `Score = 100 × ((0.45 × V_kex) + (0.35 × V_sig) + (0.10 × V_sym) + (0.10 × V_tls))`
    - Return score 0–100 with component breakdown

11. **PQC compliance engine (rules engine)**
    - Three-axis boolean checks: KEX (PASS/HYBRID/FAIL), SIG (PASS/HYBRID/FAIL), SYM (OK/WARN/FAIL)
    - Aggregation logic → compliance tier determination
    - **Zero AI dependence** — pure boolean logic

---

### Phase 4: CBOM Generation (Days 7–8)

12. **CycloneDX 1.6 schema mapper**
    - Map all crypto assessment data to CycloneDX 1.6 JSON with `cryptoProperties`
    - Include `quantumRiskSummary` block
    - Deterministic scan-scoped serial number scheme (`urn:aegis:scan:{date}:{hostname-or-ip}:{port}:{asset_uuid}`)

13. **CBOM persistence and export**
    - Store as JSONB in PostgreSQL
    - JSON download endpoint
    - PDF export

---

### Phase 5: Threat Intelligence RAG Pipeline (Days 8–10)

14. **Qdrant setup and document ingestion**
    - Deploy Qdrant via Docker Compose
    - Ingest 7 NIST source documents as embeddings:
      - NIST SP 800-208, FIPS 203, FIPS 204, FIPS 205, IR 8547
      - IBM + Google qubit roadmap data
      - IETF hybrid KEX drafts
    - Use an embedding model (e.g., `text-embedding-3-small` or open-source alternative)

15. **LangChain workflow setup**
    - LangChain runs **in-process** within the FastAPI backend — it is an internal orchestration layer, not a separate service. No external API calls or microservice deployment is required for MVP.
    - Create workflow for HNDL timeline generation
    - Create workflow for server-specific patch generation
    - Create workflow for migration roadmap generation

16. **HNDL timeline calculator**
    - Implement `BreakYear = CurrentYear + (RequiredLogicalQubits / ProjectedQubitGrowthRate)`
    - Source attribution in every output

17. **Patch generator**
    - Template-based generation for nginx, Apache, OpenSSL CLI
    - Inject correct OQS directives (`ssl_ecdh_curve X25519MLKEM768:X25519`, etc.)
    - Preserve AES-256-GCM as-is (quantum-acceptable)

---

### Phase 6: Certification Engine (Days 10–12)

18. **X.509 certificate generation**
    - Primary: ML-DSA-65 signing via OQS OpenSSL subprocess invocation
    - Fallback: ECDSA signing via Python `cryptography` library
    - Custom OID extensions: `PQC-STATUS`, `FIPS-COMPLIANT`, `BROKEN-ALGORITHMS`, `Remediation-Bundle-ID`

19. **Three-tier issuance logic**
    - Tier 1 → 90-day validity, PQC-READY=TRUE
    - Tier 2 → 30-day validity, PQC-STATUS=HYBRID
    - Tier 3 → 7-day validity, PQC-STATUS=VULNERABLE + bundle ID

---

### Phase 7: FastAPI Endpoints (Days 12–13)

20. **REST API implementation**
    - `POST /api/v1/scan` — initiate scan with target and scope
    - `GET /api/v1/scan/{id}` — scan status and progress
    - `GET /api/v1/scan/{id}/results` — full compiled results
    - `GET /api/v1/assets/{id}/cbom` — CBOM JSON download
    - `GET /api/v1/assets/{id}/certificate` — X.509 PEM download
    - `GET /api/v1/assets/{id}/remediation` — patch + HNDL timeline
    - OpenAPI/Swagger spec auto-generation

---

### Phase 8: Frontend Dashboard (Days 13–16)

21. **Next.js dashboard setup**
    - App Router with pages: scan input, scan progress, results dashboard
    - Tailwind CSS + shadcn/ui component library

22. **Dashboard views**
    - Risk heatmap (Recharts) — overview of all scanned assets
    - CBOM expandable JSON viewer
    - Certificate viewer with metadata and tier badge
    - HNDL timeline visualization per asset
    - Dual report views: CISO summary (executive) + Engineer detail (technical)

---

## 7. Pipeline Logic

### End-to-End Pipeline Flow

```
INPUT: Target domain / IP / CIDR
  │
  ▼
STAGE 1 — DISCOVERY
  ├── DNS Enumeration (Amass + DNSx) → subdomains + IPs
  ├── Port Scan (python-nmap) → open ports (443, 8443, 4443, 500, 4500)
  └── TLS ClientHello Probe → server cipher preference + certificate chain
       ├── API Inspector (optional) → JWT alg field
       └── VPN Detector (partial) → IKEv2 SA proposals
  │
  ▼ deduplicated asset list
STAGE 2 — CRYPTO ANALYSIS
  ├── Cipher Suite Parser → kex, auth, enc, mac decomposition
  │     Maps each to vulnerability value (0.00–1.00)
  ├── Certificate Chain Analyzer → pub key algo, key size, sig algo, quantumSafe
  ├── Risk Score Calculator → weighted formula → score 0–100
  └── PQC Classifier (boolean rules) → PASS/HYBRID/FAIL per axis → tier
  │
  ▼ structured crypto assessment per asset
STAGE 3 — CBOM GENERATION
  ├── Map to CycloneDX 1.6 JSON with cryptoProperties
  ├── Add quantumRiskSummary block
  └── Store as JSONB in PostgreSQL
  │
  ▼
STAGE 4 — PQC RULES ENGINE
  └── Deterministic compliance tier → FULLY_QUANTUM_SAFE / PQC_TRANSITIONING / QUANTUM_VULNERABLE
  │
  ├──────────────────────────────────────┐
  ▼                                      ▼
STAGE 5 — RAG PIPELINE              STAGE 6 — CERTIFICATION
(Tier 2 & Tier 3 only)               (depends on Rules Engine output)
  ├── Query Qdrant (NIST docs)         ├── Determine cert validity (tier-driven)
  ├── Compute HNDL break year          ├── Set custom OID extensions
  ├── Generate server patch            └── Sign with ML-DSA-65 (or ECDSA fallback)
  └── Generate migration roadmap
  │                             │
  └──────────────┬──────────────┘
                 ▼
STAGE 7 — OUTPUT
  ├── CBOM JSON/PDF download
  ├── Signed X.509 certificate
  ├── HNDL timeline (if applicable)
  ├── Server-specific PQC patch (if applicable)
  └── Risk heatmap dashboard
```

### Key Decision Points

1. **TLS 1.2 vs 1.3 format**: Parser switches regex strategy based on cipher prefix format
2. **AES-256 scoring**: Correctly scored at V=0.05 (NOT 1.00) — this is a critical differentiator
3. **Compliance tier branching**: Determines if RAG pipeline is triggered and which cert validity period applies
4. **ML-DSA-65 availability**: If OQS OpenSSL is available, sign with ML-DSA-65; otherwise fall back to ECDSA

---

## 8. Pipeline Testing Plan

### 8.1 Unit Tests

| Component | Test Cases | Validation |
|-----------|-----------|------------|
| **Cipher Suite Parser** | TLS 1.2 strings, TLS 1.3 strings, edge cases (empty, malformed) | Correct decomposition into kex/auth/enc/mac; correct vulnerability values |
| **Risk Score Calculator** | Known input → expected score (e.g., ECDHE+RSA+AES256+TLS1.2 → 84.5) | Exact numeric match to documented example |
| **PQC Compliance Engine** | All-PASS → FULLY_QUANTUM_SAFE; Hybrid-only → PQC_TRANSITIONING; Any-FAIL → QUANTUM_VULNERABLE | Correct tier for each combination |
| **HNDL Calculator** | RSA-2048 → ~2036; ECDH P-256 → ~2032 | Break year within expected range |
| **CBOM Generator** | Valid CycloneDX 1.6 schema output | JSON schema validation against CycloneDX spec |
| **Cert Signer** | Generate cert with custom OIDs, verify signature | Certificate parseable, OIDs present, signature valid |

**Run command:**
```bash
docker-compose exec backend pytest tests/unit/ -v
```

### 8.2 Integration Tests

| Pipeline Section | Test | Validation |
|-----------------|------|------------|
| **Discovery → Analysis** | Scan a known public endpoint (e.g., `testssl.sh`) | Assets discovered, cipher suites extracted, parsed correctly |
| **Analysis → CBOM** | Feed parsed crypto data through CBOM generator | Valid CycloneDX JSON stored in PostgreSQL |
| **CBOM → Rules Engine → Cert** | Pass a QUANTUM_VULNERABLE CBOM through | Correct tier assigned, 7-day cert issued, remediation bundle created |
| **CBOM → Rules → RAG → Patch** | Trigger RAG for a vulnerable nginx asset after Rules Engine assigns Tier 3 | HNDL timeline computed, nginx patch generated with `ssl_ecdh_curve X25519MLKEM768:X25519` |
| **Full pipeline** | End-to-end scan of `testssl.sh` | All stages execute, dashboard renders complete results |

**Run command:**
```bash
docker-compose exec backend pytest tests/integration/ -v --timeout=120
```

### 8.3 Example Input/Output Validation

**Input:** Domain `testssl.sh`

**Expected Pipeline Output:**
```
Discovery: endpoints found on ports 443
Cipher: TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384
  → kex=ECDHE (V=1.00), auth=RSA (V=1.00), enc=AES-256-GCM (V=0.05), mac=SHA384 (V~0)
Score: ~84.5 (0–100 scale)
Tier: QUANTUM_VULNERABLE (assigned by PQC Rules Engine → triggers RAG + 7-day cert)
HNDL: RSA-2048 break year ~2036
Patch: nginx config with ssl_ecdh_curve X25519MLKEM768:X25519
Cert: 7-day X.509 with PQC-STATUS=VULNERABLE
```

### 8.4 Debugging Checkpoints

| # | Checkpoint | How to verify |
|---|-----------|---------------|
| 1 | Docker + OQS works | Run `python -c "import oqs; print(oqs.get_enabled_kem_mechanisms())"` — should list ML-KEM variants |
| 2 | Discovery finds endpoints | Inspect raw discovery output JSON for target domain |
| 3 | TLS handshake succeeds | Check sslyze output for negotiated cipher suite |
| 4 | Parser decomposition correct | Log 4 components and compare against manual inspection |
| 5 | Risk score matches formula | Manually calculate and compare |
| 6 | Compliance tier is correct | Check tier against the rules engine truth table |
| 7 | CBOM is valid CycloneDX | Validate against official CycloneDX 1.6 JSON schema |
| 8 | Qdrant has documents | Query Qdrant collection stats endpoint |
| 9 | RAG output has citations | Check HNDL report for NIST document references |
| 10 | X.509 cert is valid | Parse with `openssl x509 -text` and verify extensions |

---

## 9. Risks / Ambiguities

### Critical Risks

| Risk | Severity | Notes |
|------|----------|-------|
| **OQS OpenSSL compilation** | 🔴 Blocker | Standard pip-installed pyOpenSSL cannot negotiate PQC. Docker must compile OpenSSL 3.x + OQS from source. If this fails, PQC is blocked. |
| **ML-DSA X.509 signing** | 🟠 High | Python `cryptography` library doesn't natively support FIPS 204 ML-DSA. Must use OQS OpenSSL CLI via subprocess. ECDSA fallback preserves compliance data but loses the "quantum-safe certificate" narrative. |
| **LangChain + Qdrant configuration** | 🟠 High | Setting up LangChain workflows and ingesting NIST docs into Qdrant is non-trivial. Embedding model choice, chunk size, and retrieval quality directly affect RAG output quality. |
| **Scan timeouts** | 🟡 Medium | DNS enumeration + port scanning + TLS probing across many subdomains could be slow. Need timeouts and concurrency limits. |

### Ambiguities Requiring Assumptions

| Area | Assumption Made |
|------|----------------|
| **LLM for RAG pipeline** | Document doesn't specify which LLM LangChain should use. Assuming an OpenAI-compatible model (GPT-4 or local alternative). |
| **Embedding model** | Not specified. Assuming `text-embedding-3-small` or an open-source model like `nomic-embed-text`. |
| **Authentication/Authorization** | No mention of user auth for the dashboard or API. Assuming basic auth or API keys for MVP. |
| **Multi-tenant isolation** | MVP is single-bank. No multi-tenancy needed yet. |
| **TLS 1.3 kex/auth extraction** | TLS 1.3 ciphers don't include kex/auth in the cipher string (negotiated separately). The document mentions handling this but doesn't specify the exact sslyze fields to use. Assuming sslyze provides this data in its scan results. |
| **VPN scanning depth** | Positioned as "partial analysis" — assuming only detection and basic IKEv2 SA proposal extraction, not full VPN audit. |
| **JWT inspection** | Positioned as "optional module" — will only attempt on endpoints that return Authorization headers. |
| **NIST document format** | Assuming PDFs that need to be parsed and chunked before embedding into Qdrant. |
| **Scheduler mechanism** | "Continuous monitoring" is mentioned but not specified. Assuming a simple cron-style scheduler or APScheduler for re-scans. |
| **PDF report generation** | Mentioned but not detailed. Assuming a library like `weasyprint` or `reportlab` for PDF export. |

---

> [!NOTE]
> This plan focuses exclusively on building the core system. Deployment, CI/CD, and production infrastructure are explicitly excluded per the instructions. The plan follows the 4-week Gantt chart from the solution file but is reorganized into logical phases that can be parallelized where possible.
