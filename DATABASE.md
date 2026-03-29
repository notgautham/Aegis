# Aegis Database Reference

This document describes the persisted data model used by the Aegis backend.

The database is PostgreSQL and is intended to run inside Docker for local development and demo use. You do **not** need PostgreSQL installed on the host machine if you are using `docker compose`.

## Overview

Aegis persists the scan pipeline in a scan-centric model:

- `scan_jobs` is the root execution object
- each scan owns many discovered assets
- each asset may have:
  - crypto assessments
  - certificate-chain observations
  - CBOM documents
  - remediation bundles
  - issued compliance certificates

This model supports:
- live scan polling
- compiled scan results
- latest-artifact retrieval per asset
- Mission Control overview aggregation
- recent scan history timeline

## Core Entity Graph

```text
scan_jobs
  └─ discovered_assets
      ├─ crypto_assessments
      ├─ certificate_chains
      ├─ cbom_documents
      ├─ remediation_bundles
      └─ compliance_certificates
```

## Database Engine

- Database: PostgreSQL 15
- ORM: SQLAlchemy async
- Driver: `asyncpg`
- Migrations: Alembic

## Important Operational Note

For local setup, Postgres is provided by Docker Compose:

```powershell
docker compose up -d
docker compose exec backend alembic upgrade head
```

## Enum Types

### `scan_status`
- `pending`
- `running`
- `completed`
- `failed`

### `compliance_tier`
- `FULLY_QUANTUM_SAFE`
- `PQC_TRANSITIONING`
- `QUANTUM_VULNERABLE`

### `cert_level`
- `leaf`
- `intermediate`
- `root`

### `service_type`
- `tls`
- `vpn`
- `api`

## Tables

### 1. `scan_jobs`

Represents one scan request for a domain, IP, or CIDR.

#### Key columns
- `id` — UUID primary key
- `target` — submitted scan target
- `status` — scan lifecycle state
- `created_at`
- `completed_at`

#### Role
- root execution record
- status polling source
- parent of all discovered assets in that scan

### 2. `discovered_assets`

Represents one public-facing cryptographic surface discovered during a scan.

#### Key columns
- `id` — UUID primary key
- `scan_id` — FK to `scan_jobs.id`
- `hostname`
- `ip_address`
- `port`
- `protocol`
- `service_type`
- `server_software`

#### Role
- scan-scoped inventory row
- anchor object for all downstream analysis and artifacts

### 3. `crypto_assessments`

Represents deterministic analysis of an asset’s cryptographic posture.

#### Key columns
- `id`
- `asset_id` — FK to `discovered_assets.id`
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

#### Role
- primary source for risk and tier in the UI
- drives prioritization and reporting

### 4. `certificate_chains`

Stores observed X.509 chain metadata from discovery-time TLS probing.

#### Expected fields
This table captures per-certificate-chain-position observations such as:
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

#### Role
- raw certificate posture evidence
- upstream input for analysis and CBOM mapping

### 5. `cbom_documents`

Stores generated CycloneDX 1.6 CBOM artifacts.

#### Expected fields
- `id`
- `scan_id`
- `asset_id`
- `serial_number`
- `cbom_json`
- `created_at`

#### Role
- persisted machine-readable cryptographic evidence
- downloadable via the asset CBOM endpoint

### 6. `remediation_bundles`

Stores the Phase 6 intelligence-layer outputs for an asset.

#### Key columns
- `id`
- `asset_id`
- `hndl_timeline`
- `patch_config`
- `migration_roadmap`
- `source_citations`
- `created_at`

#### Role
- remediation and migration evidence
- HNDL timeline source for the asset workbench

### 7. `compliance_certificates`

Stores issued Aegis compliance certificates.

#### Key columns
- `id`
- `asset_id`
- `tier`
- `certificate_pem`
- `signing_algorithm`
- `valid_from`
- `valid_until`
- `extensions_json`
- `remediation_bundle_id`

#### Role
- final certification evidence
- displayed in the workbench and reports

## Relationship Summary

### `scan_jobs` → `discovered_assets`
- one-to-many
- cascade delete

### `discovered_assets` → `crypto_assessments`
- one-to-many in model structure
- latest/compiled read path selects the relevant assessment per asset

### `discovered_assets` → `certificate_chains`
- one-to-many

### `discovered_assets` → `cbom_documents`
- one-to-many

### `discovered_assets` → `remediation_bundles`
- one-to-many

### `discovered_assets` → `compliance_certificates`
- one-to-many

### `compliance_certificates` → `remediation_bundles`
- optional many-to-one via `remediation_bundle_id`

## Read-Model Behavior

The UI does not directly join raw tables itself. Instead, backend read services assemble:

- scan status polling payloads
- compiled scan results
- latest per-asset artifact selection
- Mission Control overview
- recent scan history

That means these database tables support two modes:

### Write-side pipeline persistence
- discovery writes assets
- analysis writes assessments
- CBOM generation writes CBOMs
- remediation writes remediation bundles
- certification writes compliance certificates

### Read-side API assembly
- latest artifact per asset
- scan summary counts
- recent history items
- portfolio overview aggregates

## Notes On Artifact History

The schema supports historical persistence over repeated scans:

- scans are not overwritten
- assets are tied to the specific scan that found them
- CBOM, remediation, and certificate artifacts are persisted and then read via deterministic “latest relevant artifact” selection

This is important because the final prototype already includes:
- recent scan history
- Mission Control recent scans
- asset-level evidence lookup

## Why `ip_address` Is Stored As Text

The project intentionally stores IP addresses as `TEXT` instead of PostgreSQL `INET` for compatibility with the async stack and to keep the model behavior simple and predictable in the current pipeline.

## Migrations

All schema changes must go through Alembic.

### Apply migrations

```powershell
docker compose exec backend alembic upgrade head
```

### Create a new migration

```powershell
docker compose exec backend alembic revision --autogenerate -m "your_change_name"
```

## Verification Queries

Useful checks from inside the running backend/database environment:

### Check migration state

```powershell
docker compose exec backend alembic current
```

### Check scan rows

```powershell
docker compose exec postgres psql -U aegis -d aegis -c "select id, target, status, created_at from scan_jobs order by created_at desc limit 10;"
```

### Check asset counts per scan

```powershell
docker compose exec postgres psql -U aegis -d aegis -c "select scan_id, count(*) from discovered_assets group by scan_id;"
```

## Related Files

- [backend/models/scan_job.py](./backend/models/scan_job.py)
- [backend/models/discovered_asset.py](./backend/models/discovered_asset.py)
- [backend/models/crypto_assessment.py](./backend/models/crypto_assessment.py)
- [backend/models/compliance_certificate.py](./backend/models/compliance_certificate.py)
- [backend/models/remediation_bundle.py](./backend/models/remediation_bundle.py)
- [backend/models/enums.py](./backend/models/enums.py)
- [migrations/](./migrations)
- [API.md](./API.md)
