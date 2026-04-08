# AEGIS Wiring TODO

This file tracks remaining frontend, backend, and API work needed to replace demo data with real scan-backed data.

Update this file whenever a page is wired, a backend field is exposed, or a blocker is removed. Keep entries concrete so a later AI agent can pick up a single item and finish it safely.

## How To Use This File

- Treat `src/contexts/SelectedScanContext.tsx` as the live per-scan source of truth for frontend pages.
- Treat `src/lib/api.ts` and `src/lib/adapters.ts` as the only supported frontend/backend contract layer.
- Do not wire pages directly to raw backend JSON.
- If a page still depends on `src/data/demoData.ts`, list it here until it is removed or intentionally kept demo.
- If the database already has the needed field but the API does not expose it, record that under `Backend/API Gaps` instead of inventing frontend-only logic.

## Intentionally Demo / Leave Alone

- `frontend/src/components/dashboard/IntelligencePanel.tsx`
  - Keep this demo/hardcoded for now by product decision.
- `frontend/src/pages/AssetDiscovery.tsx`
  - `network` tab intentionally not worked yet.

## Frontend Wiring Status

### Done

- `frontend/src/pages/ScanHistory.tsx`
  - Uses live scan history with demo fallback.
- `frontend/src/components/dashboard/DataContextBadge.tsx`
  - Uses live scan history merged with demo fallback.
- `frontend/src/contexts/SelectedScanContext.tsx`
  - Loads live scan results for UUID scans and avoids stale asset reuse when switching scans.
  - Now also exposes raw compiled scan results, raw asset rows, and DNS records so pages can use richer backend-backed discovery/detail data without bypassing the shared app flow.
- `backend/api/v1/schemas.py`
  - Compiled scan results now expose `dns_records` plus per-asset `open_ports`, `asset_metadata`, `discovery_source`, and `is_shadow_it`.
- `backend/pipeline/orchestrator.py`
  - Read service now loads persisted `dns_records` and discovery-side asset metadata into scan results payloads.
- `frontend/src/lib/api.ts`
  - Frontend API contract now includes the new discovery-side response fields.
- `frontend/src/pages/DashboardHome.tsx`
  - Main dashboard sections use selected scan data.
- `frontend/src/components/dashboard/KPIStrip.tsx`
  - Uses live selected assets and updates correctly on scan switch.
- `frontend/src/components/dashboard/QScoreOverview.tsx`
  - Uses live selected assets.
- `frontend/src/components/dashboard/CyberRating.tsx`
  - Uses live selected assets.
- `frontend/src/components/dashboard/AssetTable.tsx`
  - Uses live selected assets.
- `frontend/src/components/dashboard/CryptoSecurityOverview.tsx`
  - Uses live selected assets.
- `frontend/src/components/dashboard/AssetRiskDistribution.tsx`
  - Uses live selected assets.
- `frontend/src/components/dashboard/CertExpiryTimeline.tsx`
  - Uses live selected assets.
- `frontend/src/components/dashboard/SinceLastScanStrip.tsx`
  - Uses live scan history for comparison.
- `frontend/src/pages/AssetInventory.tsx`
  - Uses selected scan assets.
- `frontend/src/pages/CBOMOverview.tsx`
  - Uses selected scan assets plus persisted CBOM presence to drive chart/table scope more truthfully.
  - `AEGIS Intelligence Digest` here is live-backed from the current scan asset set.
- `frontend/src/pages/CBOMPerAsset.tsx`
  - Uses selected scan assets plus raw persisted CBOM payloads.
  - Fake attestation hashes/signatures were removed; the page now shows real CBOM metadata and JSON preview from the backend payload.
- `frontend/src/pages/CBOMExport.tsx`
  - Uses current scan data.
  - Can truthfully export current-scan JSON and CSV from available persisted/frontend-held data.
  - Unsupported formats are now explicitly marked as requiring backend export support instead of pretending to work.
- `frontend/src/pages/CyberRatingEnterprise.tsx`
  - Uses selected scan assets, but see outstanding scale/text issues below.
- `frontend/src/pages/CyberRatingTiers.tsx`
  - Uses selected scan assets.
- `frontend/src/pages/PQCCompliance.tsx`
  - Uses selected scan assets.
- `frontend/src/pages/PQCHndl.tsx`
  - Uses selected scan assets.
- `frontend/src/pages/PQCQuantumDebt.tsx`
  - Uses selected scan assets.
- `frontend/src/pages/RemediationActionPlan.tsx`
  - Uses selected scan assets.
- `frontend/src/pages/RemediationAIPatch.tsx`
  - Uses selected scan assets.
- `frontend/src/pages/AssetDetail.tsx`
  - Uses selected scan assets.
- `frontend/src/pages/AssetDiscovery.tsx`
  - `This Scan` uses selected scan data.
  - `All Time` aggregates real completed scans through API calls.
  - Domains, SSL, IP, software, and shadow tabs now switch with scope.
  - Now consumes raw compiled scan results and DNS records in addition to adapted assets, so selected-scan and all-time discovery views can use persisted discovery metadata where available.
- `frontend/src/components/dashboard/DiscoveryDetailPanel.tsx`
  - Uses live DNS resolution rows and live discovery-side asset metadata from the current Discovery scope.
  - No longer mixes demo DNS/CVE detail into real scan views.
  - CVE drilldown remains intentionally count-only until the backend exposes real per-software CVE details.
- `frontend/src/pages/CyberRatingPerAsset.tsx`
  - Uses selected assets and computes 7-day trends from real older completed scans in scan history.
  - Falls back to neutral trend when there is not enough real history for the current asset identity.
- `frontend/src/pages/ScanReport.tsx`
  - Uses live scan history and live per-scan results with demo fallback.
  - Delta comparison now uses logical asset identity instead of scan-row IDs, so repeated scans compare more accurately.
- `frontend/src/pages/ScanConsole.tsx`
  - Uses real backend scan status and event streams instead of scripted demo output.
  - Supports both active scans from the queue and historical selected UUID scans through persisted events.
- `backend/pipeline/orchestrator.py`
  - Scan status/results runtime payload now falls back to persisted `scan_events` when in-memory runtime state is unavailable.
- `frontend/src/lib/api.ts`
  - Scan status contract now includes real stage, timing, events, and degraded-mode fields used by Scan Console.

### Still Demo Or Mixed

- `frontend/src/components/dashboard/CommandPalette.tsx`
  - Still searches demo `assets` and demo `scanHistory`.
  - Needs live selected assets plus live scan history.

## Frontend Follow-Up Fixes

- `frontend/src/pages/CyberRatingEnterprise.tsx`
  - Scale cleanup needed.
  - Current score is now 0-100, but some colors, copy, and benchmark visuals still reference old 0-1000 thresholds.
  - Fix tier color thresholds to match 0-100.
  - Fix benchmark cards and labels to use 0-100 consistently.
  - Fix narrative text that still references old monthly point jumps and hardcoded dates.
- `frontend/src/pages/AssetDiscovery.tsx`
  - Clean up stale comments that still mention old demo-only behavior.
  - If backend starts exposing richer discovery data, replace placeholder values instead of extending frontend inference logic.
- `frontend/src/pages/DashboardHome.tsx`
  - The intelligence digest is intentionally demo.
  - Leave it alone unless product direction changes.

## Backend / API Gaps Blocking Better Frontend Wiring

### Discovery Page Data Missing From API

These fields already matter to the UI but are not currently available through the scan results payload:

- Domain enrichment
  - registrar
  - registration date
  - expiry date
  - nameservers
- IP enrichment
  - subnet
  - ASN
  - netname
  - city
  - ISP

### Database Has Data But Frontend Contract Does Not

These exist in schema and models, but are not fully exposed through the frontend-facing API contract:

- `asset_fingerprints` history beyond the latest snapshot

### Required API Additions

- Scan history endpoint may need richer per-scan summary fields for cross-page comparison.
- A per-software CVE detail endpoint or expanded result payload is needed if `DiscoveryDetailPanel.tsx` should show real individual CVE rows instead of count-only messaging.
- Scan-level CBOM export endpoints are still needed for schema-accurate multi-asset export formats:
  - CycloneDX XML
  - PDF executive report
  - HTML shareable report
  - CDXA attestation package
- Signed CBOM attestation metadata is not exposed to the frontend today.
  - If the product should show or export real CBOM signatures/hashes, the backend needs to persist and expose that evidence instead of the frontend inferring it.

## Known Real-Data Sparsity

These are not necessarily bugs, but they make some pages look empty for single-host scans such as `testssl.sh` or `badssl.com`:

- Single scan often returns only one asset.
- `software` can be empty if server fingerprinting is not available.
- `ipv6` is typically empty.
- `ownerTeam` is often defaulted.
- `businessCriticality` is often defaulted.
- `certInfo.subject_alt_names` can be empty.
- `certInfo.sha256_fingerprint` can be empty.
- `hndl` fields depend on remediation/HNDL pipeline output and may be null for some scans.

## Suggested Next Work Order

1. Clean up `CyberRatingEnterprise.tsx` remaining 0-1000 assumptions.
2. Wire `CommandPalette.tsx` to live assets and scan history.

## Agent Acceptance Checklist

- The page changes when the top scan selector changes.
- `This Scan` shows only data from the currently selected scan.
- `All Time` shows aggregated real data across completed scans.
- No new page should import demo arrays unless it is explicitly listed under `Intentionally Demo / Leave Alone`.
- Build passes with `npm.cmd run build`.
- If frontend inference is used because backend data is missing, document that here immediately.
