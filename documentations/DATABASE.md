# Aegis Database Reference

This document describes the current persisted data model used by Aegis.

The platform uses two storage systems:

- PostgreSQL for transactional scan records and generated artifacts
- Qdrant for the retrieval corpus used by the remediation intelligence pipeline

## Storage Roles

### PostgreSQL

PostgreSQL stores:

- scan jobs
- discovered assets
- deterministic crypto assessments
- certificate-chain observations
- generated CBOM documents
- remediation bundles
- structured remediation actions
- compliance certificates
- persisted scan events
- DNS validation rows
- cross-scan asset fingerprints

### Qdrant

Qdrant stores:

- vector embeddings for the approved local remediation corpus in [docs/nist](./docs/nist)
- the `aegis_nist_docs` collection used by the Phase 6 retrieval and remediation flow

Qdrant is not used for scan jobs, asset state, or normal application records. Those stay in PostgreSQL.

## Important Source-of-Truth Note

The current application code expects the schema described in the SQLAlchemy models under [backend/models](./backend/models).

The Alembic history checked into the repo currently includes the initial migration, but the running code also expects later tables and columns such as:

- `scan_events`
- `dns_records`
- `asset_fingerprints`
- `remediation_actions`
- `scan_jobs.scan_profile`
- `scan_jobs.initiated_by`
- `discovered_assets.open_ports`
- `discovered_assets.asset_metadata`
- `discovered_assets.is_shadow_it`
- `discovered_assets.discovery_source`

Treat the ORM models and the live database schema as the authoritative shape for the current application behavior.

## PostgreSQL Engine

- Database: PostgreSQL 15
- ORM: SQLAlchemy 2 async ORM
- Driver: `asyncpg`
- Migrations: Alembic
- Local container name: `aegis-postgres`
- Default local connection:
  - internal Docker URL: `postgresql+asyncpg://aegis:aegis@postgres:5432/aegis`
  - host psql/pgAdmin URL: `postgres://aegis:aegis@localhost:5432/aegis`

## Scan-Centric Data Model

Aegis is scan-centric.

- One `scan_jobs` row represents one submitted scan target.
- Each scan can discover many `discovered_assets`.
- Each asset can then accumulate assessments and generated artifacts.
- Some records are scan-scoped.
- Some records are asset-scoped.
- `asset_fingerprints` provide a stable cross-scan identity layer across repeated runs.

High-level relationship graph:

```text
scan_jobs
  |- discovered_assets
  |    |- crypto_assessments
  |    |- certificate_chains
  |    |- cbom_documents
  |    |- remediation_bundles
  |    |- remediation_actions
  |    \- compliance_certificates
  |- dns_records
  \- scan_events

asset_fingerprints
  |- first_seen_scan_id -> scan_jobs.id
  \- last_seen_scan_id  -> scan_jobs.id
```

## Enum Types

### `scan_status`

Python enum: [ScanStatus](./backend/models/enums.py)

- `pending`
- `running`
- `completed`
- `failed`

### `service_type`

Python enum: [ServiceType](./backend/models/enums.py)

- `tls`
- `vpn`
- `api`

### `compliance_tier`

Python enum: [ComplianceTier](./backend/models/enums.py)

- `FULLY_QUANTUM_SAFE`
- `PQC_TRANSITIONING`
- `QUANTUM_VULNERABLE`

### `cert_level`

Python enum: [CertLevel](./backend/models/enums.py)

- `leaf`
- `intermediate`
- `root`

### `remediation_priority`

Python enum: [RemediationPriority](./backend/models/remediation_action.py)

- `P1`
- `P2`
- `P3`
- `P4`

### `remediation_status`

Python enum: [RemediationStatus](./backend/models/remediation_action.py)

- `not_started`
- `in_progress`
- `done`
- `verified`

### `remediation_effort`

Python enum: [RemediationEffort](./backend/models/remediation_action.py)

- `low`
- `medium`
- `high`

## Tables

### `scan_jobs`

Model: [backend/models/scan_job.py](./backend/models/scan_job.py)

Purpose:

- root execution record for every submitted scan
- source of truth for scan status, creation time, and completion time
- parent row for scan-scoped children

Important columns:

- `id` - UUID primary key
- `target` - exact submitted target string
- `status` - `scan_status`
- `created_at`
- `completed_at`
- `scan_profile` - optional scan-profile label
- `initiated_by` - optional actor/source label

Notes:

- `scan_profile` is free-form text persisted as submitted by clients.
- dashboard full-port mode is activated by profile text containing `full port`, `full-port`, `all ports`, or `all-ports`.
- scanner profiles (`Quick`/`Standard`/`Deep`/`PQC Focus`) and scanner toggles (full port scan, enumeration) are independent UI controls that are serialized into this single `scan_profile` string.

Key relationships:

- one-to-many `discovered_assets`
- one-to-many `cbom_documents`
- one-to-many `dns_records`
- one-to-many `scan_events`

### `discovered_assets`

Model: [backend/models/discovered_asset.py](./backend/models/discovered_asset.py)

Purpose:

- one row per discovered cryptographic surface within a specific scan
- anchor row for downstream crypto analysis and generated artifacts

Important columns:

- `id` - UUID primary key
- `scan_id` - FK to `scan_jobs.id`
- `hostname`
- `ip_address`
- `port`
- `protocol`
- `service_type`
- `server_software`
- `open_ports` - JSONB summary of related open ports for the host
- `asset_metadata` - JSONB discovery/TLS metadata
- `is_shadow_it` - boolean flag
- `discovery_source` - source marker such as DNS validation or port scan path

Key relationships:

- many-to-one `scan_job`
- one-to-many `crypto_assessments`
- one-to-many `certificate_chains`
- one-to-many `cbom_documents`
- one-to-many `remediation_bundles`
- one-to-many `remediation_actions`
- one-to-many `compliance_certificates`

`asset_metadata` JSON conventions used by current frontend-facing APIs:

- `service_type` - normalized service type string
- `domain_enrichment` (object, when hostname is available):
  - `hostname`
  - `root_domain`
  - `registrar`
  - `registration_date` (`YYYY-MM-DD` when available)
  - `expiry_date` (`YYYY-MM-DD` when available)
  - `nameservers` (array of strings)
- `network_enrichment` (object, when IP enrichment resolves):
  - `subnet`
  - `reverse_dns`
  - `asn`
  - `netname`
  - `isp`
  - `city`

### `crypto_assessments`

Model: [backend/models/crypto_assessment.py](./backend/models/crypto_assessment.py)

Purpose:

- deterministic decomposition of the asset's crypto posture
- source of risk score and compliance tier

Important columns:

- `id`
- `asset_id` - FK to `discovered_assets.id`
- `tls_version`
- `cipher_suite`
- `kex_algorithm`
- `auth_algorithm`
- `enc_algorithm`
- `mac_algorithm`
- `kex_vulnerability`
- `sig_vulnerability`
- `sym_vulnerability`
- `tls_vulnerability`
- `risk_score`
- `compliance_tier`

Notes:

- vulnerability values are normalized floats in the `0.0` to `1.0` range
- `risk_score` is a `0` to `100` score produced by the deterministic rules/scoring pipeline
- frontend `q_score` is derived as `100 - risk_score` (higher is better)

### `certificate_chains`

Model: [backend/models/certificate_chain.py](./backend/models/certificate_chain.py)

Purpose:

- persists individual certificates observed in a TLS chain
- used for asset certificate detail, leaf certificate summaries, and CBOM mapping

Important columns:

- `id`
- `asset_id`
- `cert_level`
- `subject`
- `issuer`
- `public_key_algorithm`
- `key_size_bits`
- `signature_algorithm`
- `quantum_safe`
- `not_before`
- `not_after`

### `cbom_documents`

Model: [backend/models/cbom_document.py](./backend/models/cbom_document.py)

Purpose:

- stores generated CycloneDX 1.6 cryptographic bills of materials

Important columns:

- `id`
- `scan_id`
- `asset_id`
- `serial_number` - unique
- `cbom_json` - JSONB
- `created_at`

### `remediation_bundles`

Model: [backend/models/remediation_bundle.py](./backend/models/remediation_bundle.py)

Purpose:

- stores the main Phase 6 remediation output for an asset

Important columns:

- `id`
- `asset_id`
- `hndl_timeline` - JSONB
- `patch_config` - generated patch/config text
- `migration_roadmap` - roadmap text
- `source_citations` - JSONB citation payload
- `created_at`

### `remediation_actions`

Model: [backend/models/remediation_action.py](./backend/models/remediation_action.py)

Purpose:

- stores structured remediation tasks derived from assessments and bundles

Important columns:

- `id`
- `asset_id`
- `remediation_bundle_id`
- `priority`
- `finding`
- `action`
- `effort`
- `status`
- `category`
- `nist_reference`
- `created_at`
- `updated_at`

### `compliance_certificates`

Model: [backend/models/compliance_certificate.py](./backend/models/compliance_certificate.py)

Purpose:

- stores issued Aegis compliance certificates per asset

Important columns:

- `id`
- `asset_id`
- `tier`
- `certificate_pem`
- `signing_algorithm`
- `valid_from`
- `valid_until`
- `extensions_json`
- `remediation_bundle_id`

### `dns_records`

Model: [backend/models/dns_record.py](./backend/models/dns_record.py)

Purpose:

- stores validated DNS resolution rows for hostnames discovered during a scan

Important columns:

- `id`
- `scan_id`
- `hostname`
- `resolved_ips` - JSONB array
- `cnames` - JSONB array
- `discovery_source`
- `is_in_scope`
- `discovered_at`

### `scan_events`

Model: [backend/models/scan_event.py](./backend/models/scan_event.py)

Purpose:

- persists runtime pipeline events so historical scans still have event logs after in-memory state is gone

Important columns:

- `id`
- `scan_id`
- `timestamp`
- `kind`
- `stage`
- `message`

### `asset_fingerprints`

Model: [backend/models/asset_fingerprint.py](./backend/models/asset_fingerprint.py)

Purpose:

- stable cross-scan identity for the same logical asset
- used for persisted q-score history and trend views

Important columns:

- `id`
- `canonical_key` - unique logical identity, typically host/IP plus port/protocol
- `first_seen_scan_id`
- `last_seen_scan_id`
- `first_seen_at`
- `last_seen_at`
- `appearance_count`
- `q_score_history` - JSONB array of score snapshots
- `latest_q_score`
- `latest_compliance_tier`

## Write-Side Flow

During a successful scan, the pipeline typically writes in this order:

1. `scan_jobs`
2. `dns_records`
3. `discovered_assets`
4. `crypto_assessments`
5. `asset_fingerprints`
6. `certificate_chains`
7. `cbom_documents`
8. `remediation_bundles`
9. `remediation_actions`
10. `compliance_certificates`
11. `scan_events`

Not every scan populates every table. Example:

- non-remediated scans may leave `remediation_bundles` empty
- scans with no captured certificate chain may leave `certificate_chains` empty
- sparse targets may only create one asset row

## Read-Side API Assembly

The frontend does not query tables directly. The backend read service assembles:

- scan status payloads
- compiled scan results
- latest artifact per asset
- mission-control overview
- mission-control recent activity
- mission-control network graph
- scan history

The main compiled payload comes from:

- [backend/pipeline/orchestrator.py](./backend/pipeline/orchestrator.py)
- [backend/api/v1/schemas.py](./backend/api/v1/schemas.py)

## Qdrant

### Purpose

Qdrant stores the embedded remediation/reference corpus used by the retrieval and RAG layer.

### Current collection

- collection name: `aegis_nist_docs`

### Source corpus

- local files under [docs/nist](./docs/nist)
- supported ingestion formats:
  - `.pdf`
  - `.txt`
  - `.md`

### Lifecycle

- documents are ingested when you explicitly run the ingestion script
- scans do not re-ingest the corpus on every run
- scans query the persisted vectors already stored in Qdrant

### Setup and validation commands

```powershell
docker compose exec backend python scripts/ingest_nist_docs.py
docker compose exec backend python scripts/validate_ingested_corpus.py
```

### Relevant files

- [scripts/ingest_nist_docs.py](./scripts/ingest_nist_docs.py)
- [scripts/validate_ingested_corpus.py](./scripts/validate_ingested_corpus.py)
- [backend/intelligence/retrieval.py](./backend/intelligence/retrieval.py)
- [docs/nist/README.md](./docs/nist/README.md)

## Useful Operational Commands

### Apply migrations

```powershell
docker compose exec backend alembic upgrade head
```

### Open psql inside the Postgres container

```powershell
docker compose exec postgres psql -U aegis -d aegis
```

### List table row counts

```powershell
docker compose exec postgres psql -U aegis -d aegis -c "\\dt"
```

### Inspect recent scans

```powershell
docker compose exec postgres psql -U aegis -d aegis -c "select id, target, status, created_at, completed_at from scan_jobs order by created_at desc limit 20;"
```

### Inspect collection status in Qdrant

```powershell
docker compose exec backend python scripts/validate_ingested_corpus.py
```

## Related Files

- [backend/core/database.py](./backend/core/database.py)
- [backend/models](./backend/models)
- [backend/repositories](./backend/repositories)
- [backend/api/v1/schemas.py](./backend/api/v1/schemas.py)
- [API.md](./API.md)
- [SETUP.md](./SETUP.md)
