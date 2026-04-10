# Aegis API Reference

This document describes the current backend HTTP API exposed by Aegis.

It is the practical reference for:

- frontend integration
- scan orchestration
- status polling
- artifact retrieval
- mission-control summaries
- scan-history views

The API is scan-centric:

- a scan is created first
- status and progress are polled by `scan_id`
- compiled results are fetched by `scan_id`
- per-asset artifact endpoints use `asset_id`

## Base Information

- Base URL: `http://localhost:8000`
- API prefix: `/api/v1`
- OpenAPI JSON: `http://localhost:8000/api/v1/openapi.json`
- Swagger UI: `http://localhost:8000/docs`
- Health endpoint: `GET /health`
- Response format: JSON

## Authentication

There is currently no real backend authentication or authorization layer enforced on these routes.

Current state:

- frontend login is a local prototype gate only
- backend routes are not JWT/session protected
- CORS is currently permissive in development

Treat the current API as a trusted local-development/demo surface, not a production-secure interface.

## Error Envelope

Application-level errors are returned in a consistent envelope:

```json
{
  "error": {
    "type": "not_found",
    "message": "Scan not found"
  }
}
```

Common error types:

- `http_error`
- `validation_error`
- `invalid_request`
- `not_found`
- `internal_error`

## Shared Enums

### Scan status

- `pending`
- `running`
- `completed`
- `failed`

### Service type

- `tls`
- `vpn`
- `api`

### Compliance tier

- `FULLY_QUANTUM_SAFE`
- `PQC_TRANSITIONING`
- `QUANTUM_VULNERABLE`

## Endpoints

### 1. `GET /health`

Simple backend liveness check.

Example response:

```json
{
  "status": "ok"
}
```

### 2. `POST /api/v1/scan`

Create a new scan job and dispatch the background orchestrator.

Request body:

```json
{
  "target": "example.com"
}
```

Accepted target types:

- domain
- IP address
- CIDR range

Validation notes:

- invalid targets return `400`
- target parsing uses the discovery scope validator before scan creation

Response status:

- `202 Accepted`

Response shape:

```json
{
  "scan_id": "uuid",
  "target": "example.com",
  "status": "pending",
  "created_at": "2026-04-10T12:00:00Z"
}
```

Current limitations:

- the backend currently accepts only `target`
- scan profile, notes, and priority metadata shown in the UI are still frontend-local unless separately persisted

### 3. `GET /api/v1/scan/{scan_id}`

Return live scan status and runtime telemetry.

Use this for:

- polling a running scan
- stage/progress display
- scan console event feed
- degraded-mode visibility

Response shape:

```json
{
  "scan_id": "uuid",
  "target": "example.com",
  "status": "running",
  "created_at": "2026-04-10T12:00:00Z",
  "completed_at": null,
  "progress": {
    "assets_discovered": 1,
    "assessments_created": 1,
    "cboms_created": 1,
    "remediations_created": 1,
    "certificates_created": 1
  },
  "summary": {
    "total_assets": 1,
    "tls_assets": 1,
    "non_tls_assets": 0,
    "fully_quantum_safe_assets": 0,
    "transitioning_assets": 1,
    "vulnerable_assets": 0,
    "critical_assets": 0,
    "unknown_assets": 0,
    "average_q_score": 50.0,
    "highest_risk_score": 50.0
  },
  "stage": "analysis",
  "stage_detail": "Running TLS assessment",
  "stage_started_at": "2026-04-10T12:00:03Z",
  "elapsed_seconds": 4.2,
  "events": [
    {
      "timestamp": "2026-04-10T12:00:03Z",
      "kind": "info",
      "message": "Assessment pipeline started",
      "stage": "analysis"
    }
  ],
  "degraded_modes": []
}
```

Field notes:

- `progress` is derived counter data, not a persisted row
- `summary` is a derived posture summary for the scan
- `events` come from runtime memory while active and from persisted `scan_events` for completed/history reads
- `degraded_modes` reports fallback or reduced-capability scan paths

### 4. `GET /api/v1/scan/{scan_id}/results`

Return the compiled scan read model used by the dashboard, asset pages, CBOM pages, PQC pages, remediation pages, and reports.

Top-level response shape:

```json
{
  "scan_id": "uuid",
  "target": "example.com",
  "status": "completed",
  "created_at": "2026-04-10T12:00:00Z",
  "completed_at": "2026-04-10T12:00:08Z",
  "progress": {
    "assets_discovered": 1,
    "assessments_created": 1,
    "cboms_created": 1,
    "remediations_created": 1,
    "certificates_created": 1
  },
  "summary": {
    "total_assets": 1,
    "tls_assets": 1,
    "non_tls_assets": 0,
    "fully_quantum_safe_assets": 0,
    "transitioning_assets": 1,
    "vulnerable_assets": 0,
    "critical_assets": 0,
    "unknown_assets": 0,
    "average_q_score": 50.0,
    "highest_risk_score": 50.0
  },
  "stage": "completed",
  "stage_detail": "Scan finished",
  "stage_started_at": "2026-04-10T12:00:08Z",
  "elapsed_seconds": 8.0,
  "events": [],
  "degraded_modes": [],
  "dns_records": [],
  "assets": []
}
```

#### `summary`

Includes:

- `total_assets`
- `tls_assets`
- `non_tls_assets`
- `fully_quantum_safe_assets`
- `transitioning_assets`
- `vulnerable_assets`
- `critical_assets`
- `unknown_assets`
- `average_q_score`
- `highest_risk_score`

#### `dns_records[]`

Each item contains:

- `hostname`
- `resolved_ips`
- `cnames`
- `discovery_source`
- `is_in_scope`
- `discovered_at`

#### `assets[]`

Each asset contains:

- `asset_id`
- `hostname`
- `ip_address`
- `port`
- `protocol`
- `service_type`
- `server_software`
- `open_ports`
- `asset_metadata`
- `is_shadow_it`
- `discovery_source`
- `assessment`
- `cbom`
- `remediation`
- `certificate`
- `leaf_certificate`
- `remediation_actions`
- `asset_fingerprint`

#### `assessment`

Fields:

- `id`
- `tls_version`
- `cipher_suite`
- `kex_algorithm`
- `auth_algorithm`
- `enc_algorithm`
- `mac_algorithm`
- `risk_score`
- `compliance_tier`
- `kex_vulnerability`
- `sig_vulnerability`
- `sym_vulnerability`
- `tls_vulnerability`

#### `cbom`

Fields:

- `id`
- `serial_number`
- `created_at`
- `cbom_json`

#### `remediation`

Fields:

- `id`
- `created_at`
- `hndl_timeline`
- `patch_config`
- `migration_roadmap`
- `source_citations`

#### `certificate`

Fields:

- `id`
- `tier`
- `signing_algorithm`
- `valid_from`
- `valid_until`
- `extensions_json`
- `remediation_bundle_id`
- `certificate_pem`

#### `leaf_certificate`

Leaf-certificate summary for the asset when a leaf row exists in `certificate_chains`.

Fields:

- `subject_cn`
- `issuer`
- `public_key_algorithm`
- `key_size_bits`
- `signature_algorithm`
- `quantum_safe`
- `not_before`
- `not_after`
- `days_remaining`

#### `remediation_actions[]`

Fields:

- `priority`
- `finding`
- `action`
- `effort`
- `status`
- `category`
- `nist_reference`

#### `asset_fingerprint`

Cross-scan identity and score history.

Fields:

- `canonical_key`
- `appearance_count`
- `latest_q_score`
- `latest_compliance_tier`
- `first_seen_at`
- `last_seen_at`
- `first_seen_scan_id`
- `last_seen_scan_id`
- `q_score_history[]`

Each `q_score_history[]` item contains:

- `scan_id`
- `q_score`
- `scanned_at`

### 5. `GET /api/v1/assets/{asset_id}/cbom`

Return the latest persisted CBOM for a given asset.

Response shape:

```json
{
  "id": "uuid",
  "serial_number": "urn:uuid:...",
  "created_at": "2026-04-10T12:00:05Z",
  "cbom_json": {
    "bomFormat": "CycloneDX",
    "specVersion": "1.6"
  }
}
```

### 6. `GET /api/v1/assets/{asset_id}/certificate`

Return the latest persisted compliance certificate for a given asset.

Response shape:

```json
{
  "id": "uuid",
  "tier": "PQC_TRANSITIONING",
  "signing_algorithm": "ML-DSA-65",
  "valid_from": "2026-04-10T12:00:06Z",
  "valid_until": "2026-05-10T12:00:06Z",
  "extensions_json": {},
  "remediation_bundle_id": "uuid",
  "certificate_pem": "-----BEGIN CERTIFICATE-----..."
}
```

### 7. `GET /api/v1/assets/{asset_id}/remediation`

Return the latest persisted remediation bundle for a given asset.

Response shape:

```json
{
  "id": "uuid",
  "created_at": "2026-04-10T12:00:05Z",
  "hndl_timeline": {
    "urgency": "HIGH"
  },
  "patch_config": "server { ... }",
  "migration_roadmap": "Preparation / Prerequisites ...",
  "source_citations": {
    "documents": []
  }
}
```

### 8. `GET /api/v1/mission-control/overview`

Return an aggregate portfolio view across recent scans.

Query parameters:

- `recent_limit` - optional integer, default `10`, min `1`, max `25`
- `priority_limit` - optional integer, default `5`, min `1`, max `10`

Response shape:

```json
{
  "portfolio_summary": {
    "completed_scans": 8,
    "running_scans": 1,
    "failed_scans": 1,
    "vulnerable_assets": 6,
    "transitioning_assets": 4,
    "compliant_assets": 20,
    "certificates_issued": 24,
    "remediation_bundles_generated": 10,
    "degraded_scan_count": 2
  },
  "recent_scans": [],
  "priority_findings": [],
  "system_health": {
    "backend_status": "healthy",
    "degraded_runtime_notice_count": 0
  }
}
```

#### `recent_scans[]`

Each item contains:

- `scan_id`
- `target`
- `status`
- `created_at`
- `completed_at`
- `summary`
- `progress`
- `degraded_mode_count`

#### `priority_findings[]`

Each item contains:

- `scan_id`
- `asset_id`
- `target`
- `asset_label`
- `port`
- `service_type`
- `tier`
- `risk_score`

### 9. `GET /api/v1/scan/history`

Return the scan-history timeline used by the frontend.

Query parameters:

- `limit` - optional integer, min `1`, max `5000`; omit to return all matching scans
- `target` - optional exact target filter

Response shape:

```json
{
  "items": [
    {
      "scan_id": "uuid",
      "target": "example.com",
      "status": "completed",
      "created_at": "2026-04-10T12:00:00Z",
      "completed_at": "2026-04-10T12:00:08Z",
      "summary": {
        "total_assets": 1,
        "tls_assets": 1,
        "non_tls_assets": 0,
        "vulnerable_assets": 0,
        "transitioning_assets": 1,
        "fully_quantum_safe_assets": 0,
        "critical_assets": 0,
        "unknown_assets": 0,
        "average_q_score": 50.0,
        "highest_risk_score": 50.0
      },
      "progress": {
        "assets_discovered": 1,
        "assessments_created": 1,
        "cboms_created": 1,
        "remediations_created": 1,
        "certificates_created": 1
      },
      "scan_profile": null,
      "initiated_by": null,
      "degraded_mode_count": 0
    }
  ]
}
```

This endpoint currently powers:

- Scan History page
- top scan selector
- same-target enterprise score history
- all-time aggregation paths in several pages

## Development and Verification Commands

### Start the backend stack

```bash
docker compose up -d --build
```

### Apply migrations

```bash
docker compose exec backend alembic upgrade head
```

### Ingest the corpus required for remediation retrieval

```bash
docker compose exec backend python scripts/ingest_nist_docs.py
```

### Validate the corpus and Qdrant collection

```bash
docker compose exec backend python scripts/validate_ingested_corpus.py
```

### Health check

```bash
curl http://localhost:8000/health
```

### Example create-scan request

```bash
curl -X POST http://localhost:8000/api/v1/scan \
  -H "Content-Type: application/json" \
  -d '{"target":"testssl.sh"}'
```

## Current API Gaps

These are important missing capabilities, not hidden routes:

- no real backend auth or user scoping
- no scan cancel/abort endpoint
- no report-generation/download endpoints
- no scheduled-report CRUD endpoints
- no notification APIs
- no graph/relationship APIs

## Related Files

- [backend/main.py](./backend/main.py)
- [backend/api/v1/router.py](./backend/api/v1/router.py)
- [backend/api/v1/endpoints/scans.py](./backend/api/v1/endpoints/scans.py)
- [backend/api/v1/endpoints/assets.py](./backend/api/v1/endpoints/assets.py)
- [backend/api/v1/endpoints/mission_control.py](./backend/api/v1/endpoints/mission_control.py)
- [backend/api/v1/schemas.py](./backend/api/v1/schemas.py)
- [DATABASE.md](./DATABASE.md)
- [SETUP.md](./SETUP.md)
