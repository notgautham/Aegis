# Aegis API Reference

This document describes the current backend API surface exposed by the Aegis prototype.

It is intended as a practical reference for:
- frontend development
- backend integration
- demo preparation
- new-machine setup and verification

The API is **scan-centric**:
- a scan is the primary execution object
- results, artifacts, reports, and deep links all resolve from a `scan_id`
- saved targets are a frontend-only usability layer and are **not** persisted by the backend

## Base Information

- Base URL: `http://localhost:8000`
- API prefix: `/api/v1`
- Health endpoint: `/health`
- Response format: JSON

## High-Level Surface

### Health
- `GET /health`

### Scan lifecycle
- `POST /api/v1/scan`
- `GET /api/v1/scan/{scan_id}`
- `GET /api/v1/scan/{scan_id}/results`

### Per-asset artifact retrieval
- `GET /api/v1/assets/{asset_id}/cbom`
- `GET /api/v1/assets/{asset_id}/certificate`
- `GET /api/v1/assets/{asset_id}/remediation`

### Final-prototype read models
- `GET /api/v1/mission-control/overview`
- `GET /api/v1/scan/history`

## Authentication

The current prototype does not expose a full authentication or authorization layer in the API surface. Treat it as a trusted development/demo environment.

## Scan Status Model

Current backend scan statuses:

- `pending`
- `running`
- `completed`
- `failed`

## Shared Enum Values

### Compliance tiers
- `FULLY_QUANTUM_SAFE`
- `PQC_TRANSITIONING`
- `QUANTUM_VULNERABLE`

### Service types
- `tls`
- `vpn`
- `api`

## 1. Health Endpoint

### `GET /health`

Returns simple backend liveness.

#### Example response

```json
{
  "status": "ok"
}
```

## 2. Create Scan

### `POST /api/v1/scan`

Starts a new scan for a target domain, IP, or CIDR.

#### Request body

```json
{
  "target": "example.com"
}
```

#### Response

```json
{
  "scan_id": "c72dc1d0-4cb0-4d06-a5a0-4fe2f87ec2c0",
  "target": "example.com",
  "status": "pending",
  "created_at": "2026-03-29T12:00:00Z"
}
```

#### Notes

- The frontend scan workflow panel may collect profile, notes, environment, and priority tags.
- The backend scan creation endpoint currently accepts **only** `target`.
- Those extra workflow fields are frontend-local convenience metadata for the final prototype.

## 3. Poll Scan Status

### `GET /api/v1/scan/{scan_id}`

Returns live scan state and runtime telemetry suitable for Mission Control polling.

#### Response shape

```json
{
  "scan_id": "uuid",
  "target": "example.com",
  "status": "running",
  "created_at": "2026-03-29T12:00:00Z",
  "completed_at": null,
  "progress": {
    "assets_discovered": 12,
    "assessments_created": 4,
    "cboms_created": 4,
    "remediations_created": 2,
    "certificates_created": 4
  },
  "summary": {
    "total_assets": 12,
    "tls_assets": 10,
    "non_tls_assets": 2,
    "fully_quantum_safe_assets": 2,
    "transitioning_assets": 4,
    "vulnerable_assets": 4,
    "highest_risk_score": 84.5
  },
  "stage": "analysis",
  "stage_detail": "Parsing TLS posture",
  "stage_started_at": "2026-03-29T12:01:10Z",
  "elapsed_seconds": 73.2,
  "events": [
    {
      "timestamp": "2026-03-29T12:01:11Z",
      "kind": "info",
      "message": "Analysis pipeline started",
      "stage": "analysis"
    }
  ],
  "degraded_modes": [
    "missing-amass-fallback-active"
  ]
}
```

#### Notes

- This endpoint is for **live runtime polling**.
- The UI uses it for:
  - Mission Control active scan card
  - stage telemetry
  - event feed
  - degraded-mode visibility

## 4. Get Compiled Scan Results

### `GET /api/v1/scan/{scan_id}/results`

Returns the compiled scan payload used by the analytical, asset, workbench, and reporting routes.

#### Response shape

```json
{
  "scan_id": "uuid",
  "target": "example.com",
  "status": "completed",
  "created_at": "2026-03-29T12:00:00Z",
  "completed_at": "2026-03-29T12:02:30Z",
  "progress": {
    "assets_discovered": 12,
    "assessments_created": 10,
    "cboms_created": 10,
    "remediations_created": 4,
    "certificates_created": 10
  },
  "summary": {
    "total_assets": 12,
    "tls_assets": 10,
    "non_tls_assets": 2,
    "fully_quantum_safe_assets": 2,
    "transitioning_assets": 4,
    "vulnerable_assets": 4,
    "highest_risk_score": 84.5
  },
  "stage": "completed",
  "stage_detail": "Scan finished",
  "stage_started_at": "2026-03-29T12:02:30Z",
  "elapsed_seconds": 150.0,
  "events": [],
  "degraded_modes": [],
  "assets": [
    {
      "asset_id": "uuid",
      "hostname": "api.example.com",
      "ip_address": "203.0.113.10",
      "port": 443,
      "protocol": "tcp",
      "service_type": "tls",
      "server_software": "nginx/1.24.0",
      "assessment": {},
      "cbom": {},
      "remediation": {},
      "certificate": {}
    }
  ]
}
```

### Asset result object

Each `assets[]` entry may include:

- identity and network fields
  - `asset_id`
  - `hostname`
  - `ip_address`
  - `port`
  - `protocol`
  - `service_type`
  - `server_software`
- analysis summary
  - `assessment`
- latest CBOM artifact
  - `cbom`
- latest remediation artifact
  - `remediation`
- latest issued compliance certificate
  - `certificate`

### Assessment object

The `assessment` object contains:

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

### Frontend usage

This is the primary data source for:

- `/risk-heatmap`
- `/assets`
- `/assets/[assetId]` asset validation and summary rail
- `/reports`

## 5. Get Asset CBOM

### `GET /api/v1/assets/{asset_id}/cbom`

Returns the latest persisted CBOM for the asset.

#### Response shape

```json
{
  "id": "uuid",
  "serial_number": "urn:uuid:aegis-scan-20260329-api.example.com-443-asset-uuid",
  "created_at": "2026-03-29T12:02:00Z",
  "cbom_json": {
    "bomFormat": "CycloneDX",
    "specVersion": "1.6"
  }
}
```

#### Frontend usage

- asset workbench CBOM tab
- JSON viewer / download flow

## 6. Get Asset Certificate

### `GET /api/v1/assets/{asset_id}/certificate`

Returns the latest compliance certificate issued for the asset.

#### Response shape

```json
{
  "id": "uuid",
  "tier": "QUANTUM_VULNERABLE",
  "signing_algorithm": "ECDSA-P384",
  "valid_from": "2026-03-29T12:02:10Z",
  "valid_until": "2026-04-05T12:02:10Z",
  "extensions_json": {
    "PQC-STATUS": "VULNERABLE"
  },
  "remediation_bundle_id": "uuid",
  "certificate_pem": "-----BEGIN CERTIFICATE-----..."
}
```

#### Frontend usage

- asset workbench certificate tab
- PEM viewer / copy / download

## 7. Get Asset Remediation

### `GET /api/v1/assets/{asset_id}/remediation`

Returns the latest remediation artifact for the asset.

#### Response shape

```json
{
  "id": "uuid",
  "created_at": "2026-03-29T12:02:05Z",
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

#### Frontend usage

- asset workbench remediation tab
- recommended next action and roadmap display

## 8. Mission Control Overview

### `GET /api/v1/mission-control/overview`

Read-only aggregate endpoint for the Mission Control home page.

#### Query params

- `recent_limit` — optional integer
- `priority_limit` — optional integer

#### Response shape

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
  "recent_scans": [
    {
      "scan_id": "uuid",
      "target": "example.com",
      "status": "completed",
      "created_at": "2026-03-29T12:00:00Z",
      "completed_at": "2026-03-29T12:02:30Z",
      "summary": {
        "vulnerable_assets": 4,
        "transitioning_assets": 2,
        "fully_quantum_safe_assets": 1,
        "highest_risk_score": 84.5
      },
      "progress": {
        "assets_discovered": 12,
        "assessments_created": 10,
        "cboms_created": 10,
        "remediations_created": 4,
        "certificates_created": 10
      },
      "degraded_mode_count": 1
    }
  ],
  "priority_findings": [
    {
      "scan_id": "uuid",
      "asset_id": "uuid",
      "target": "example.com",
      "asset_label": "api.example.com",
      "port": 443,
      "service_type": "tls",
      "tier": "QUANTUM_VULNERABLE",
      "risk_score": 84.5
    }
  ],
  "system_health": {
    "backend_status": "healthy",
    "degraded_runtime_notice_count": 1
  }
}
```

#### Frontend usage

- Mission Control posture overview
- recent scans
- priority findings
- system strip
- deterministic quick-action context

## 9. Scan History

### `GET /api/v1/scan/history`

Read-only recent scan timeline endpoint.

#### Query params

- `limit` — optional integer
- `target` — optional exact target filter

#### Response shape

```json
{
  "items": [
    {
      "scan_id": "uuid",
      "target": "example.com",
      "status": "completed",
      "created_at": "2026-03-29T12:00:00Z",
      "completed_at": "2026-03-29T12:02:30Z",
      "summary": {
        "vulnerable_assets": 4,
        "transitioning_assets": 2,
        "fully_quantum_safe_assets": 1,
        "highest_risk_score": 84.5
      },
      "progress": {
        "assets_discovered": 12,
        "assessments_created": 10,
        "cboms_created": 10,
        "remediations_created": 4,
        "certificates_created": 10
      },
      "degraded_mode_count": 1
    }
  ]
}
```

#### Frontend usage

- `/history`
- recent-scan operational timeline

## Error Model

The backend uses a consistent JSON error envelope:

```json
{
  "error": {
    "type": "not_found",
    "message": "Scan not found"
  }
}
```

Depending on the route and handler, `detail` may also appear for framework-generated validation errors.

## Frontend Integration Rules

Important integration rules already enforced in the frontend:

- do not call scan-bound routes without a resolved valid `scan_id`
- do not fabricate missing metrics
- ignore stale in-flight responses when switching scans
- validate that asset detail routes belong to the active scan
- treat urgency/action-priority labels as presentation logic, not backend facts

## Development Notes

### Start the backend stack

```powershell
docker compose up -d
docker compose exec backend alembic upgrade head
```

### Check health

```powershell
curl http://localhost:8000/health
```

### Focused integration test

```powershell
docker compose exec backend python -m pytest tests/integration/test_phase8_api.py -q
```

## Related Docs

- [README.md](./README.md)
- [DATABASE.md](./DATABASE.md)
- [IMPLEMENTATION.md](./IMPLEMENTATION.md)
- [MEMORY.md](./MEMORY.md)
