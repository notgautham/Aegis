# AEGIS PostgreSQL Schema
## Version 2.0 — Verified Against Source Code
> This document is the authoritative schema specification. Agents must read this fully before making any database changes. All additions have been verified against the actual backend pipeline code.

---

## How to Read This Document

- **[EXISTS]** — table or column already in the database via migration `5327e82a5ead`
- **[ADD]** — must be added in the new migration
- **[DATA GAP]** — data is collected by backend code but currently discarded, not persisted
- **[NOT COLLECTED]** — data does not exist anywhere in the current backend; schema alone cannot fix this, collection logic must also be added

---

## Verified Data Loss Analysis

The following data is actively computed during every scan and then silently discarded because no table or column exists to store it:

| Data | Where It Exists | Where It's Lost |
|------|----------------|-----------------|
| DNS resolved IPs per hostname | `ValidatedHostname.ip_addresses[]` from DNSx | `_resolve_hostnames()` in orchestrator — only `hostname` reaches DB |
| DNS CNAMEs per hostname | `ValidatedHostname.cnames[]` | Same — dropped |
| Port service name and state | `PortFinding.service_name`, `PortFinding.state` | `_persist_discovered_assets()` only saves `port` and `protocol` |
| API inspection: JWT algorithms | `APIInspectionResult.jwt_algorithms` | Merged into `AggregatedAsset.metadata` but `metadata` is never saved |
| API inspection: mTLS requirement | `APIInspectionResult.mtls_required` | Same |
| API inspection: HTTP response headers | `APIInspectionResult.headers` | Same |
| API inspection: HTTP status code | `APIInspectionResult.status_code` | Same |
| VPN detected protocol | `VPNProbeResult.detected_protocol` | Same — `metadata` not saved |
| VPN probe details | `VPNProbeResult.details` | Same |
| Scan runtime events | `ScanRuntimeStore` in `app.state` | Lives in memory only — lost on backend restart |
| Scan profile used | set by `ScanQueueContext` | `scan_jobs` has no `scan_profile` column |

Data that is **not collected at all** and therefore cannot be fixed by schema alone (requires new integration code):
- Domain registrar, nameservers, WHOIS expiry — Amass passive does not return this
- ASN, GeoIP city, ISP — no GeoIP lookup exists in the backend
- SHA-256 certificate fingerprint — not extracted by `CertificateExtractor`
- IPv6 addresses — scanner is IPv4 only currently

---

## Current Enums (All Exist — Do Not Modify)

```sql
CREATE TYPE scan_status AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED');
CREATE TYPE compliance_tier AS ENUM ('FULLY_QUANTUM_SAFE', 'PQC_TRANSITIONING', 'QUANTUM_VULNERABLE');
CREATE TYPE service_type AS ENUM ('TLS', 'VPN', 'API');
CREATE TYPE cert_level AS ENUM ('LEAF', 'INTERMEDIATE', 'ROOT');
```

New enum required:

```sql
-- [ADD]
CREATE TYPE remediation_priority AS ENUM ('P1', 'P2', 'P3', 'P4');
CREATE TYPE remediation_status AS ENUM ('not_started', 'in_progress', 'done', 'verified');
CREATE TYPE remediation_effort AS ENUM ('low', 'medium', 'high');
```

---

## Tables — Full Specification

---

### `scan_jobs` [EXISTS — ADD COLUMNS]

One row per scan job. Currently missing configuration and audit metadata.

| Column | Type | Constraint | Status | Notes |
|--------|------|-----------|--------|-------|
| `id` | `uuid` | PK, NOT NULL | EXISTS | |
| `target` | `text` | NOT NULL | EXISTS | Domain, IP, or CIDR string |
| `status` | `scan_status` | NOT NULL | EXISTS | |
| `created_at` | `timestamptz` | NOT NULL, default `now()` | EXISTS | |
| `completed_at` | `timestamptz` | nullable | EXISTS | |
| `scan_profile` | `text` | nullable | EXISTS | e.g. `'standard'`, `'quick'`, `'deep'`, `'pqc_focus'` |
| `initiated_by` | `text` | nullable | EXISTS | Username or `'system'`. Placeholder for auth layer. |

**Indexes (existing):** `ix_scan_jobs_status`, `ix_scan_jobs_target`

---

### `discovered_assets` [EXISTS — ADD COLUMNS]

One row per discovered cryptographic surface per scan. Currently stores only the minimum; much richer data is available.

| Column | Type | Constraint | Status | Notes |
|--------|------|-----------|--------|-------|
| `id` | `uuid` | PK, NOT NULL | EXISTS | |
| `scan_id` | `uuid` | FK → `scan_jobs.id` CASCADE, NOT NULL | EXISTS | |
| `hostname` | `text` | nullable | EXISTS | |
| `ip_address` | `text` | nullable | EXISTS | |
| `port` | `integer` | NOT NULL | EXISTS | |
| `protocol` | `varchar(10)` | NOT NULL | EXISTS | `tcp` or `udp` |
| `service_type` | `service_type` | nullable | EXISTS | `TLS`, `VPN`, or `API` |
| `server_software` | `text` | nullable | EXISTS | Raw banner e.g. `nginx/1.24.0` |
| `open_ports` | `jsonb` | nullable | EXISTS | Array of port finding objects from nmap. Schema: `[{"port": 443, "protocol": "tcp", "service_name": "https", "state": "open"}]`. Populated from all `PortFinding` objects for this IP. |
| `asset_metadata` | `jsonb` | nullable | EXISTS | Catch-all for data collected but not given its own column. Schema: `{"jwt_algorithms": ["RS256"], "mtls_required": false, "hsts_enabled": false, "http_status_code": 200, "vpn_protocol": "IKEv2", "vpn_details": {}}`. Populated from `APIInspectionResult` and `VPNProbeResult`. |
| `is_shadow_it` | `boolean` | NOT NULL, default `false` | EXISTS | True when asset was discovered outside the primary target scope or has no confirmed owner. Set by orchestrator heuristic. |
| `discovery_source` | `text` | nullable | EXISTS | How this asset was found: `'amass'`, `'dnsx'`, `'nmap'`, `'tls_probe'`, `'manual'`. |

**Indexes (existing):** `ix_discovered_assets_scan_id`
**New index:** `ix_discovered_assets_is_shadow_it` on `(is_shadow_it)` where `is_shadow_it = true`

---

### `dns_records` [ADD — NEW TABLE]

Stores DNS resolution results from DNSx for each hostname discovered in a scan. Currently this data is used to drive the pipeline and then discarded.

**Why needed:** The `AssetDiscovery` Domains tab needs to show hostnames, their resolved IPs, CNAMEs, and discovery source. This is the raw DNS intelligence layer.

| Column | Type | Constraint | Notes |
|--------|------|-----------|-------|
| `id` | `uuid` | PK, NOT NULL | |
| `scan_id` | `uuid` | FK → `scan_jobs.id` CASCADE, NOT NULL | |
| `hostname` | `text` | NOT NULL | Fully qualified hostname e.g. `vpn.pnb.co.in` |
| `resolved_ips` | `jsonb` | NOT NULL, default `'[]'` | Array of IP strings: `["14.140.82.10"]` |
| `cnames` | `jsonb` | NOT NULL, default `'[]'` | Array of CNAME strings |
| `discovery_source` | `text` | NOT NULL | `'amass'` or `'target'` (root domain) |
| `is_in_scope` | `boolean` | NOT NULL, default `true` | Whether DNSx validated it as in-scope |
| `discovered_at` | `timestamptz` | NOT NULL, default `now()` | |

**Indexes:**
- `ix_dns_records_scan_id` on `(scan_id)`
- `ix_dns_records_hostname` on `(hostname)`
- Unique constraint on `(scan_id, hostname)`

---

### `scan_events` [ADD — NEW TABLE]

Persistent audit log of pipeline events per scan. Currently these live in `ScanRuntimeStore` in `app.state` and are lost on backend restart. For a banking platform, a complete immutable audit trail is required.

**Why needed:** Regulatory compliance, debugging failed scans, proving scan integrity to auditors. Events currently survive only while the backend process is alive.

| Column | Type | Constraint | Notes |
|--------|------|-----------|-------|
| `id` | `uuid` | PK, NOT NULL | |
| `scan_id` | `uuid` | FK → `scan_jobs.id` CASCADE, NOT NULL | |
| `timestamp` | `timestamptz` | NOT NULL, default `now()` | |
| `kind` | `text` | NOT NULL | `'info'`, `'success'`, `'error'`, `'degraded'`, `'stage'`, `'queued'` |
| `stage` | `text` | nullable | Pipeline stage name e.g. `'probing_tls'`, `'generating_remediation'` |
| `message` | `text` | NOT NULL | Human-readable event description |

**Indexes:**
- `ix_scan_events_scan_id` on `(scan_id)`
- `ix_scan_events_scan_id_timestamp` on `(scan_id, timestamp)` — for ordered event retrieval

---

### `remediation_actions` [ADD — NEW TABLE]

Structured remediation findings per asset. Currently `remediation_bundles.patch_config` stores a free-text server config patch blob that cannot be queried, filtered, or tracked for completion status.

**Why needed:** The `RemediationActionPlan` page consumes `asset.remediation[]` as structured objects with `priority`, `finding`, `action`, `status`, `effort`. The current text blob cannot serve this. This table replaces the unqueryable text with actionable, trackable rows.

**Relationship to `remediation_bundles`:** `remediation_bundles` keeps the raw generated content (patch_config text, migration_roadmap, HNDL data). This new table stores the parsed, structured action items derived from that content.

| Column | Type | Constraint | Notes |
|--------|------|-----------|-------|
| `id` | `uuid` | PK, NOT NULL | |
| `asset_id` | `uuid` | FK → `discovered_assets.id` CASCADE, NOT NULL | |
| `remediation_bundle_id` | `uuid` | FK → `remediation_bundles.id` SET NULL, nullable | Source bundle this action was derived from |
| `priority` | `remediation_priority` | NOT NULL | `P1` = critical/immediate, `P2` = high, `P3` = medium, `P4` = low |
| `finding` | `text` | NOT NULL | Short description of the problem e.g. `'RSA key exchange — no forward secrecy'` |
| `action` | `text` | NOT NULL | What to do e.g. `'Enable ECDHE or X25519MLKEM768 key exchange'` |
| `effort` | `remediation_effort` | NOT NULL | `low`, `medium`, `high` |
| `status` | `remediation_status` | NOT NULL, default `'not_started'` | Tracks implementation progress |
| `category` | `text` | nullable | Grouping label: `'key_exchange'`, `'tls_version'`, `'cipher'`, `'certificate'`, `'pqc_migration'` |
| `nist_reference` | `text` | nullable | e.g. `'NIST FIPS 203 §4.2'` |
| `created_at` | `timestamptz` | NOT NULL, default `now()` | |
| `updated_at` | `timestamptz` | NOT NULL, default `now()` | Update on status change |

**Indexes:**
- `ix_remediation_actions_asset_id` on `(asset_id)`
- `ix_remediation_actions_priority` on `(priority)`
- `ix_remediation_actions_status` on `(status)`

---

### `asset_fingerprints` [ADD — NEW TABLE]

Provides cross-scan identity tracking. Currently, if `vpn.pnb.co.in:443` appears in scan 3 and scan 7, they are two completely unrelated rows in `discovered_assets` with no link between them. This makes it impossible to compute score trends, deltas, or improvement over time.

**Why needed:** `CyberRatingPerAsset` shows per-asset score delta between scans. `ScanHistory` trend charts require knowing that the same logical asset appeared across multiple scans. Without this, there is no historical comparison.

**Design:** A fingerprint is the stable logical identity of an asset, defined by `(hostname, port, protocol)` or `(ip_address, port, protocol)` if no hostname. Each scan that discovers the same logical asset updates the fingerprint's `last_seen_scan_id` and appends a score snapshot.

| Column | Type | Constraint | Notes |
|--------|------|-----------|-------|
| `id` | `uuid` | PK, NOT NULL | |
| `canonical_key` | `text` | UNIQUE, NOT NULL | Stable identity string: `hostname:port/protocol` e.g. `vpn.pnb.co.in:443/tcp`. IP-only assets use `ip:port/protocol`. |
| `first_seen_scan_id` | `uuid` | FK → `scan_jobs.id` SET NULL, nullable | The scan that first discovered this asset |
| `last_seen_scan_id` | `uuid` | FK → `scan_jobs.id` SET NULL, nullable | Most recent scan that found this asset |
| `first_seen_at` | `timestamptz` | NOT NULL | |
| `last_seen_at` | `timestamptz` | NOT NULL | |
| `appearance_count` | `integer` | NOT NULL, default `1` | How many scans have found this asset |
| `q_score_history` | `jsonb` | NOT NULL, default `'[]'` | Ordered array of score snapshots: `[{"scan_id": "...", "q_score": 76, "scanned_at": "2026-03-25T..."}]` |
| `latest_q_score` | `integer` | nullable | Denormalized latest q_score for fast queries. Derived as `100 - risk_score`. |
| `latest_compliance_tier` | `compliance_tier` | nullable | Denormalized from most recent `crypto_assessments` row |

**Indexes:**
- `ix_asset_fingerprints_canonical_key` on `(canonical_key)` — this is effectively unique
- `ix_asset_fingerprints_last_seen_at` on `(last_seen_at)`

---

### `crypto_assessments` [EXISTS — NO CHANGES]

Fully sufficient. All vulnerability components, risk score, and compliance tier are stored correctly.

---

### `certificate_chains` [EXISTS — NO CHANGES]

Fully sufficient. Subject, issuer, key algorithm, key size, validity dates, quantum_safe flag are all stored. SHA-256 fingerprint is not collected by the backend at all — adding a column without collection logic would just be a nullable field that's always null.

---

### `cbom_documents` [EXISTS — NO CHANGES]

The full CycloneDX 1.6 JSON is stored in `cbom_json` (jsonb). Sufficient.

---

### `remediation_bundles` [EXISTS — NO CHANGES TO COLUMNS]

Keep as-is. The `patch_config` text blob stays for the raw generated config. The new `remediation_actions` table stores the structured derived actions. Do not remove `patch_config`.

---

### `compliance_certificates` [EXISTS — NO CHANGES]

Fully sufficient.

---

## Complete Table Dependency Order

For migrations, create and drop in this order to respect foreign keys:

**Create order:**
1. `scan_jobs` (no deps)
2. `discovered_assets` (→ scan_jobs)
3. `dns_records` (→ scan_jobs)
4. `scan_events` (→ scan_jobs)
5. `asset_fingerprints` (→ scan_jobs)
6. `crypto_assessments` (→ discovered_assets)
7. `certificate_chains` (→ discovered_assets)
8. `cbom_documents` (→ discovered_assets, scan_jobs)
9. `remediation_bundles` (→ discovered_assets)
10. `remediation_actions` (→ discovered_assets, remediation_bundles)
11. `compliance_certificates` (→ discovered_assets, remediation_bundles)

---

## Migration Instructions for Agents

This schema upgrade must be implemented as a **single new Alembic migration** added to `migrations/versions/`. Do not modify the existing migration `5327e82a5ead_initial_schema.py`.

### Steps:
1. Run `alembic revision --autogenerate -m "schema_v2_data_completeness"` from the project root
2. Review the generated file — autogenerate may not pick up JSONB defaults or new enums correctly
3. Manually verify these are present in the `upgrade()` function:
   - New enum types created before their tables
   - `op.add_column()` for each column marked [ADD] on existing tables
   - `op.create_table()` for each new table
   - All indexes listed above
4. Verify `downgrade()` reverses every change in reverse order
5. Run `alembic upgrade head` against the running Postgres instance
6. Verify in pgAdmin at `localhost:5050` that all new tables and columns appear under `Schemas → public`

### Do NOT do:
- Do not drop any existing column or table
- Do not modify existing enum values — only add new enum types
- Do not change existing foreign key relationships
- Do not alter column types on existing columns
- Do not regenerate or replace migration `5327e82a5ead`

---

## What the Backend Must Be Updated to Populate

After the schema migration, these backend changes are needed to populate the new tables and columns:

| New Schema Element | Backend File to Update | What to Add |
|-------------------|----------------------|------------|
| `scan_jobs.scan_profile` | `backend/api/v1/schemas.py`, `backend/api/v1/endpoints/scans.py` | Accept `profile` in `ScanCreateRequest`, store in `scan_jobs` |
| `discovered_assets.open_ports` | `backend/pipeline/orchestrator.py` `_persist_discovered_assets()` | Pass `PortFinding[]` for this IP, serialize as JSONB |
| `discovered_assets.asset_metadata` | `backend/pipeline/orchestrator.py` `_persist_discovered_assets()` | Serialize `AggregatedAsset.metadata` (contains JWT algs, mTLS, VPN details) |
| `discovered_assets.is_shadow_it` | `backend/pipeline/orchestrator.py` `_persist_discovered_assets()` | Heuristic: true if hostname has no confirmed DNS validation match |
| `discovered_assets.discovery_source` | `backend/pipeline/orchestrator.py` `_persist_discovered_assets()` | Set from `ValidatedHostname.source` field |
| `dns_records` | `backend/pipeline/orchestrator.py` `_resolve_hostnames()` | After DNSx validates, persist each `ValidatedHostname` as a `dns_records` row |
| `scan_events` | `backend/pipeline/orchestrator.py` `ScanRuntimeStore.add_event()` | In addition to in-memory append, write to `scan_events` table |
| `remediation_actions` | `backend/pipeline/orchestrator.py` `_process_tls_asset()` | After `remediation_bundle` is generated, parse `patch_config` into structured actions and insert rows |
| `asset_fingerprints` | `backend/pipeline/orchestrator.py` `_process_tls_asset()` | After assessment is saved, upsert fingerprint using `canonical_key`, append score snapshot |
| `asset_fingerprints.latest_q_score` | Same | `round(100 - risk_score)` |

---

## Frontend Field Satisfaction After Schema v2

| Frontend `Asset` Field | Source After Migration |
|-----------------------|----------------------|
| `domain` | `discovered_assets.hostname` |
| `ip` | `discovered_assets.ip_address` |
| `port` | `discovered_assets.port` |
| `type` | `discovered_assets.service_type` (mapped) |
| `tls` | `crypto_assessments.tls_version` |
| `cipher` | `crypto_assessments.cipher_suite` |
| `keyExchange` | `crypto_assessments.kex_algorithm` |
| `qScore` | `100 - crypto_assessments.risk_score` |
| `status` | derived from `compliance_tier` + `risk_score` |
| `tier` | derived from `compliance_tier` + `risk_score` |
| `hndlBreakYear` | `remediation_bundles.hndl_timeline->>'estimatedBreakYear'` |
| `hndlYears` | derived from break_year - current_year |
| `hndlRiskLevel` | `remediation_bundles.hndl_timeline->>'urgency'` |
| `dimensionScores` | derived from `crypto_assessments.*_vulnerability` fields |
| `forwardSecrecy` | derived from `crypto_assessments.kex_algorithm` |
| `remediation[]` | **`remediation_actions`** (new table) |
| `certInfo.subject_cn` | `certificate_chains.subject` where `cert_level = 'LEAF'` |
| `certInfo.issuer` | `certificate_chains.issuer` where `cert_level = 'LEAF'` |
| `certInfo.valid_until` | `certificate_chains.not_after` where `cert_level = 'LEAF'` |
| `certInfo.days_remaining` | computed: `not_after - now()` |
| `certInfo.key_type` | `certificate_chains.public_key_algorithm` where `cert_level = 'LEAF'` |
| `certInfo.key_size` | `certificate_chains.key_size_bits` where `cert_level = 'LEAF'` |
| `software` | parsed from `discovered_assets.server_software` |
| `hstsEnabled` | `discovered_assets.asset_metadata->>'hsts_enabled'` |
| `assetTrends` (delta) | **`asset_fingerprints.q_score_history`** (new table) |

| Frontend Discovery Tab | Source After Migration |
|----------------------|----------------------|
| Domains tab | `dns_records` table |
| IP tab | `discovered_assets` grouped by `ip_address` + `open_ports` column |
| Software tab | `discovered_assets.server_software` parsed |
| Shadow IT tab | `discovered_assets` where `is_shadow_it = true` |
| SSL tab | `certificate_chains` joined to `discovered_assets` |
