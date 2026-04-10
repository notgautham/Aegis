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
- `backend/api/v1/schemas.py`
  - Scan history and compiled scan results now expose richer posture summary fields such as `average_q_score`, `critical_assets`, and `unknown_assets`.
  - Per-asset compiled scan results now expose persisted `asset_fingerprint` history.
- `backend/pipeline/orchestrator.py`
  - Read service now loads `asset_fingerprints` into compiled asset results and includes richer per-scan summary metrics in history/results payloads.
- `frontend/src/lib/api.ts`
  - Frontend API contract now includes asset fingerprint history plus richer scan-history summary fields.
- `frontend/src/lib/adapters.ts`
  - Live scan history now adapts to the richer backend summary fields and exposes short deterministic score-reason text for comparison views.
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
  - Uses selected scan assets.
  - Removed the leftover fake score-history fallback so the page only shows real same-target history or an honest baseline state.
- `frontend/src/pages/CyberRatingTiers.tsx`
  - Uses selected scan assets.
- `frontend/src/pages/PQCCompliance.tsx`
  - Uses selected scan assets.
  - Compliance heatmap and improvement recommendations are now derived from live asset posture instead of embedded demo counts.
- `frontend/src/pages/PQCHndl.tsx`
  - Uses selected scan assets.
  - HNDL exposure matrix now derives from live asset HNDL posture and business criticality instead of static demo cells.
- `frontend/src/pages/PQCQuantumDebt.tsx`
  - Uses selected scan assets.
  - Quantum debt score, type breakdown, and simulator now derive from the selected scan asset set.
  - Recent debt growth now uses the prior real scan when one is available.
- `frontend/src/pages/RemediationActionPlan.tsx`
  - Uses selected scan assets.
  - Uses selected scan target label instead of stale session-only scan context labels.
- `frontend/src/pages/RemediationAIPatch.tsx`
  - Uses selected scan assets plus raw remediation bundles/actions from the compiled scan results payload.
  - Static canned patch templates were removed in favor of persisted `patch_config`, `migration_roadmap`, and remediation actions when available.
- `frontend/src/pages/AssetDetail.tsx`
  - Uses selected scan assets.
  - Score history now uses persisted asset fingerprint history instead of demo timelines.
  - The page now shows a short deterministic explanation of why AEGIS assigned the current score.
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
  - Now prefers persisted `asset_fingerprint` score history for the 7-day trend and shows a short weakest-dimensions summary per asset.
- `frontend/src/pages/ScanReport.tsx`
  - Uses live scan history and live per-scan results with demo fallback.
  - Delta comparison now uses logical asset identity instead of scan-row IDs, so repeated scans compare more accurately.
  - Report actions and CBOM summary now show truthful backend-backed coverage states instead of fake generated artifacts.
- `frontend/src/pages/ScanConsole.tsx`
  - Uses real backend scan status and event streams instead of scripted demo output.
  - Supports both active scans from the queue and historical selected UUID scans through persisted events.
- `backend/pipeline/orchestrator.py`
  - Scan status/results runtime payload now falls back to persisted `scan_events` when in-memory runtime state is unavailable.
- `frontend/src/lib/api.ts`
  - Scan status contract now includes real stage, timing, events, and degraded-mode fields used by Scan Console.
- `frontend/src/pages/RemediationRoadmap.tsx`
  - Roadmap phases, progress, effort-impact matrix, and estimator now derive from the selected scan remediation backlog and artifact coverage.
  - Organizational phase status remains inferred from current-scan evidence, not from a persisted project-management backend model.
- `frontend/src/pages/ReportingExecutive.tsx`
  - Uses selected scan context and live scan history for truthful report-source coverage.
  - Leaves file generation/download blank until backend reporting endpoints exist.
- `frontend/src/pages/ReportingScheduled.tsx`
  - Reflects the true system state with an empty scheduling view instead of fake schedules.
- `frontend/src/pages/ReportingOnDemand.tsx`
  - Uses selected scan context to show real section availability and report scope.
  - Leaves final generation blank until backend render/download support exists.
- `frontend/src/components/dashboard/CommandPalette.tsx`
  - Uses live selected assets for query search and live scan history with demo fallback for scan navigation.
  - Selecting a scan now updates the shared selected-scan context before navigating.
- `frontend/src/pages/ScanHistory.tsx`
  - Now uses richer scan summary fields and displays short deterministic score-reason summaries in the table and compare view.

### Still Demo Or Mixed

## Frontend Follow-Up Fixes

- `frontend/src/pages/AssetDiscovery.tsx`
  - If backend starts exposing richer discovery data, replace placeholder values instead of extending frontend inference logic.
- `frontend/src/pages/DashboardHome.tsx`
  - The intelligence digest is intentionally demo.
  - Leave it alone unless product direction changes.

## Backend / API Gaps Blocking Better Frontend Wiring

### Core Platform Gaps

- Real authentication and authorization are not implemented yet.
  - The current login flow is frontend-local only.
  - Backend API routes are not protected by JWT, session, API key, or user/tenant scoping.
  - Add backend auth enforcement, token/session handling, and scan ownership rules before treating the system as multi-user or production-ready.
- Alembic migration history is not fully in sync with the current ORM/runtime schema.
  - The running code expects later tables and columns such as `scan_events`, `dns_records`, `asset_fingerprints`, `remediation_actions`, and newer scan/discovery columns.
  - Add the missing migration(s) so a completely fresh database can be created from repo state without manual intervention.

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

### Required API Additions

- A target-specific cyber-rating history / projection endpoint would reduce frontend fan-out for enterprise score pages.
  - The current enterprise score page now builds truthful same-target history from scan-history summaries client-side, but a dedicated backend read model would still scale better.
- Reporting pages do not yet have backend report-generation support.
  - No persisted executive/compliance/risk/CBOM report artifact list is available.
  - No on-demand report render/download endpoint exists for PDF, HTML, CSV, or JSON bundles.
  - No scheduled report CRUD/execution API exists for recipients, cadence, or run history.
- Scan queue cancellation is still frontend-local.
  - The UI can now cancel queued items and stop tracking an active item, but there is no backend per-scan cancel/abort endpoint yet for a true server-side stop.
- A per-software CVE detail endpoint or expanded result payload is needed if `DiscoveryDetailPanel.tsx` should show real individual CVE rows instead of count-only messaging.
- Remediation pages do not yet have persisted program-management state.
  - Assignees in `RemediationActionPlan.tsx` are still frontend-local.
  - `RemediationRoadmap.tsx` phase status/progress is inferred from current remediation actions and artifacts, not from backend-owned roadmap entities.
- Remediation bundles currently expose one generic `patch_config` block per asset, not server-specific or per-finding variants.
  - `RemediationAIPatch.tsx` therefore keeps the server selector for operator context, but cannot yet switch to truly different backend-generated patch variants per runtime.
- Remediation roadmap text is still delivered as one long-form `migration_roadmap` blob.
  - `RemediationAIPatch.tsx` now renders this more cleanly in the frontend, but the long-term scalable fix is a structured backend roadmap payload with explicit phases, tasks, priorities, and citations.
- PQC HNDL pages still do not have true data-retention / shelf-life inputs from the backend.
  - The current HNDL heatmap is therefore derived from `businessCriticality` x `hndlRiskLevel`, not a persisted retention model.
- PQC Quantum Debt does not have a backend-native debt metric or projection model yet.
  - The current page uses a deterministic frontend derivation from live asset Q-scores plus prior scan comparison when available.
- Scan-level CBOM export endpoints are still needed for schema-accurate multi-asset export formats:
  - CycloneDX XML
  - PDF executive report
  - HTML shareable report
  - CDXA attestation package
- Signed CBOM attestation metadata is not exposed to the frontend today.
  - If the product should show or export real CBOM signatures/hashes, the backend needs to persist and expose that evidence instead of the frontend inferring it.
- Graph visualization/storage is not implemented yet.
  - The Discovery/network graph areas currently do not have a real backend graph model behind them.
  - Evaluate a local graph-capable store such as Neo4j (or a simpler relational/materialized graph approach if sufficient) for persisting relationships between scans, domains, IPs, certificates, ports, software, and ownership.
  - Add backend ingestion/read paths for graph relationships and expose graph-ready API payloads for the frontend.
  - Wire the relevant frontend pages/components to render real graph topology from persisted relationship data instead of placeholders.
- A real notification mechanism is not implemented yet.
  - Current notification behavior is mostly local/frontend-only and not backed by persisted notification state or delivery channels.
  - Add backend-owned notification entities/events plus read/update APIs for in-app notifications.
  - Decide later whether email, Slack, webhook, or other delivery channels should be supported, and wire those through the backend rather than frontend-only logic.
- The top-right export action is not functional yet.
  - Define what it should export based on the active page/scan context.
  - Add backend export endpoints/artifact generation where needed and connect the shared top-right export button to those real outputs.
- Some legacy UI copy and scales still assume the older `0-1000` score model.
  - Normalize remaining references in marketing/landing surfaces and any analytical pages that still present `0-1000` instead of the current `0-100` posture scale.

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

1. Implement real backend auth and access control before productionizing broader multi-user usage.
2. Bring Alembic migration history fully in sync with the current ORM/runtime schema.
3. Add richer backend comparison/history endpoints where current pages still fan out across many scan-result calls client-side.

## Agent Acceptance Checklist

- The page changes when the top scan selector changes.
- `This Scan` shows only data from the currently selected scan.
- `All Time` shows aggregated real data across completed scans.
- No new page should import demo arrays unless it is explicitly listed under `Intentionally Demo / Leave Alone`.
- Build passes with `npm.cmd run build`.
- If frontend inference is used because backend data is missing, document that here immediately.
