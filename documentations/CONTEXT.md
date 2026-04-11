# Aegis Project Context (Single Source of Operational Truth)

Last updated: 2026-04-11
Scope: End-to-end architecture, current implementation reality, frontend/backend contracts, known gaps, verification methods, and active roadmap.

This file is intended to replace fragmented operational context spread across temporary notes. Keep this file current when major behavior or contracts change.

## 1. Product Purpose and Non-Negotiables

### 1.1 Product purpose
Aegis is a scan-centric cryptographic intelligence platform focused on banking infrastructure and quantum-readiness posture.

Core loop:
1. Discover public cryptographic surfaces (domain, IP, port, TLS/VPN/API).
2. Build deterministic crypto assessments.
3. Generate CBOM artifacts.
4. Evaluate PQC compliance tiers.
5. Compute risk and Q-score.
6. Produce remediation guidance (RAG-backed, but advisory-only).
7. Surface executive and analyst outputs in the frontend.

### 1.2 Invariants that must not drift
1. Deterministic security engine: compliance/risk scoring logic must remain deterministic; no LLM writes to risk tiers.
2. RAG is advisory-only: remediation intelligence cannot mutate deterministic scores/tiers.
3. Status/tier taxonomy must stay consistent between backend read models, adapters, and frontend widgets.
4. SOLUTION.md is product intent and must not be modified.

### 1.3 Canonical scoring/tier vocabulary (current frontend contract)
Normalized runtime asset status values used in UI:
1. `elite-pqc`
2. `transitioning`
3. `vulnerable`
4. `critical`
5. `unknown`

Backend compliance tiers expected in payloads:
1. `FULLY_QUANTUM_SAFE`
2. `PQC_TRANSITIONING`
3. `QUANTUM_VULNERABLE`

Legacy compatibility:
1. Older cached records may contain `safe`.
2. Frontend compatibility helpers treat legacy `safe` as transition-equivalent in selected compatibility paths.

## 2. Repository and Runtime Layout

Top-level key files/folders:
1. `README.md`: overview, positioning, high-level architecture.
2. `SETUP.md`: service startup and initialization procedure.
3. `API.md`: active HTTP contract.
4. `DATABASE.md`: relational + vector storage mapping.
5. `backend/`: FastAPI app, pipeline, deterministic analysis, repositories.
6. `frontend/`: React + Vite dashboard and reporting app.
7. `docker/`: OQS Dockerfile and database init scripts.
8. `simulation/`: command-line scan verification utility.
9. `tests/`: unit/integration/infra test suites.

Runtime services:
1. Backend (FastAPI): `localhost:8000`
2. Frontend (Vite app): `localhost:3000`
3. Postgres: `localhost:5432`
4. Qdrant: vector store for remediation corpus
5. pgAdmin: optional inspection UI

## 3. Backend Architecture (Reality, Not Aspirational)

### 3.1 Core backend modules
1. `backend/main.py`: app bootstrapping and API mounting.
2. `backend/api/v1/`: scan and read-model API surface.
3. `backend/pipeline/orchestrator.py`: scan lifecycle orchestration and read-model assembly.
4. `backend/discovery/`: DNS/TLS/VPN/API discovery probes and aggregation.
5. `backend/analysis/`: deterministic parser/scorer/compliance-related logic.
6. `backend/compliance/rules_engine.py`: compliance decision paths.
7. `backend/cbom/`: CycloneDX mapping.
8. `backend/intelligence/`: RAG/retrieval/roadmap advisory generation.
9. `backend/models/`: SQLAlchemy entities and enums.
10. `backend/repositories/`: persistence access layer.

### 3.2 Data model characteristics
1. Scan-centric hierarchy: `scan_jobs` -> `discovered_assets` -> assessments/artifacts.
2. Per-scan records: `scan_events`, `dns_records`, summary derivations.
3. Cross-scan continuity: `asset_fingerprints` and score history.
4. Generated artifacts: CBOM, remediation bundles/actions, compliance certificates.

### 3.3 Known backend constraints
1. Auth is not production-grade yet (frontend login is local gate).
2. Some migration history can lag behind runtime ORM expectations.
3. Reporting generation/scheduled jobs are not fully backend-owned yet.

## 4. Frontend Architecture (Current Operational Model)

### 4.1 Frontend stack
1. React 18 + TypeScript + Vite.
2. Tailwind + custom UI components.
3. Route-driven dashboard surfaces under `/dashboard`.

### 4.2 High-impact context providers
1. `frontend/src/contexts/SelectedScanContext.tsx`
	- Canonical selected scan state.
	- Persists selection in `aegis-selected-scan-id` localStorage.
	- Fetches live scan results for UUID selections.
	- Falls back to demo snapshots only for non-UUID historical/demo paths.
2. `frontend/src/contexts/ScanQueueContext.tsx`
	- Manages queued targets and polling lifecycle.
	- Creates scans via API and tracks stage/progress.
	- Emits runtime queue state and completion notifications.
3. `frontend/src/contexts/ScanContext.tsx`
	- Domain-focused helper context (root domain/org label derivation).

### 4.3 Frontend data contract layer
1. `frontend/src/lib/api.ts`
	- Typed API client and response contracts.
2. `frontend/src/lib/adapters.ts`
	- Backend-to-UI mapping and normalization.
3. `frontend/src/lib/status.ts`
	- Shared transition/PQC-ready classifier helpers.

### 4.4 Selected scan ownership rule
All scan-scoped dashboard/report pages must derive data from `SelectedScanContext` first. Direct demo imports are allowed only when explicitly intentional and documented in this file.

## 5. Scan Lifecycle and Selection Sync (Important)

### 5.1 Queue execution flow
1. User submits target(s) from dashboard or scan console.
2. `ScanQueueContext.startQueue()` creates queued items.
3. `api.createScan()` returns backend `scan_id`.
4. Poll loop uses `api.getScanStatus(scanId)`.
5. On completion/failure, queue item is updated and notification emitted.

### 5.2 Previously observed bug (fixed)
Symptom:
1. User starts a new scan (example `icicibank.com`).
2. Dashboard continues showing previous scan (example discord) instead of new completed scan.

Root cause:
1. Dashboard selection sync used queue-derived `done` items from `queue` array.
2. Queue completion flow immediately cleared queue (`updateQueue([])`), so React effects could miss transient `done` state.
3. Result: selected scan remained on prior scan ID.

### 5.3 Implemented fix
1. Added `latestCompletedScanId` state in `ScanQueueContext`.
2. Set this value immediately when a scan item reaches `completed` in poll loop.
3. Exposed `latestCompletedScanId` through queue context.
4. Updated dashboard selection sync in `DashboardLayout` to follow `latestCompletedScanId` instead of reverse-searching ephemeral queue rows.

Changed files:
1. `frontend/src/contexts/ScanQueueContext.tsx`
2. `frontend/src/pages/DashboardLayout.tsx`

Validation performed:
1. Static diagnostics on changed files: clean.
2. Production build (`npm run build`): success.

## 6. Frontend Functional Coverage Status

### 6.1 Largely live-wired pages/components
1. Dashboard KPI and analytical strips.
2. Asset tables and grouped scan detail views.
3. Scan report major sections.
4. Discovery major tabs (excluding known network graph completeness constraints).
5. CBOM overview/per-asset flow.
6. Per-asset and enterprise rating flows (with target-history limitations).
7. Remediation action plan and roadmap (roadmap partly inferred).
8. Scan history and scan console core paths.

### 6.2 Known intentionally demo or mixed areas (must be explicit)
1. Some intelligence digest/presentation elements remain demo by product direction.
2. Some reporting surfaces remain skeletons until backend artifact generation exists.
3. Certain advanced graph/discovery enrichments remain placeholders when backend does not provide source fields.

## 7. Recent Frontend Normalization Work (Completed)

Major completed themes from latest implementation phases:
1. Status/tier mapping fixes:
	- Correct transition mapping to `transitioning`.
	- Correct tier thresholds and label semantics.
2. Counter consistency:
	- KPI/Q-score transition counts now honor `transitioning`, compatibility `safe`, and `complianceTier` fallbacks.
3. Table correctness:
	- Grouping by `hostname:port` where expected.
	- Stable composite keys for grouped rows.
	- Correct KEY/CERT column mapping.
4. Network legend semantics:
	- Labels updated to requested user-facing wording.
5. Helper centralization:
	- Shared status helpers introduced and integrated across major widgets.
6. Backend read-model alignment (partial but important):
	- Orchestrator graph/read-service status semantics updated toward new taxonomy.

## 8. Verified Reference Scenario (Discord Scan)

Reference scan used during validation:
1. Scan ID: `9f55b7bf-8714-4a87-8306-9e20f3f23db0`

Observed validated behavior in prior checks:
1. KPI transition counts aligned with expected values.
2. Q-score transition counts aligned with expected values.
3. Grouped asset rows shown as expected (`Assets (2)` for `discord.com` grouped by ports).
4. Dashboard labels reflected corrected taxonomy.

## 9. Backend/API Contract Notes for Frontend Developers

### 9.1 Required scan endpoints
1. `POST /api/v1/scan`
2. `GET /api/v1/scan/{scan_id}`
3. `GET /api/v1/scan/{scan_id}/results`
4. `GET /api/v1/scan/history`

### 9.2 Critical payload fragments used by UI
1. `summary` posture counters.
2. `stage` and runtime `events` for scan console/status visuals.
3. `assets[].assessment` and `assets[].certificate`.
4. `assets[].remediation` + `remediation_actions`.
5. `assets[].asset_fingerprint` for cross-scan trend continuity.
6. `dns_records` and discovery metadata.

### 9.3 Compatibility hazards
1. Missing or mixed status vocabulary leads to broken counters and misleading labels.
2. Queue/selection race conditions produce stale dashboard context.
3. Demo fallback blending can hide real-data regressions if not tightly controlled.

## 10. Operational Commands and Validation Playbook

### 10.1 Standard startup
1. `docker compose up -d --build`
2. `docker compose exec backend alembic upgrade head`
3. `docker compose exec backend python scripts/ingest_nist_docs.py`

### 10.2 Frontend local checks
1. `cd frontend && npm run build`
2. `cd frontend && npm run test` (where available/useful)

### 10.3 Backend scan simulation
1. `docker compose exec backend python simulation/run.py --target <domain> --skip-enumeration`

### 10.4 Useful runtime inspection
1. Backend logs: `docker compose logs -f backend`
2. Frontend logs: `docker compose logs -f frontend`
3. Browser console for UI state issues.

## 11. Known Gaps and Risks (Current Priority Order)

### 11.1 High priority
1. Full backend-wide status contract consolidation so all read surfaces emit consistent normalized statuses.
2. Eliminate residual live/demo blending edge cases in selected-scan UX.
3. Add regression tests for grouping, counter logic, and KEY/CERT correctness.

### 11.2 Medium priority
1. Introduce backend-native report generation and scheduling APIs.
2. Add richer discovery enrichment data (registrar/ASN/ISP/location) in read models.
3. Add server-side scan cancel endpoint for true queue cancellation.

### 11.3 Foundational platform risk
1. Backend authN/authZ remains non-production.
2. Ensure Alembic revisions fully represent current ORM expectations on fresh DB bootstrap.

## 12. Next-Phase Execution Plan (Active)

Phase A (immediate):
1. Complete residual frontend status-logic normalization using shared helpers in any remaining outlier components.
2. Add focused tests for:
	- transition counters
	- grouped rows by `hostname:port`
	- KEY/CERT column mapping
	- selected scan sync on queue completion

Phase B:
1. Audit backend read-model emitters for taxonomy consistency.
2. Lock down one canonical status mapping policy at adapter boundary.

Phase C:
1. Reduce/remove stale fallback interactions that can select old scans unintentionally.
2. Harden automated visual verification flow for deterministic dashboards.

## 13. Practical Debugging Guide

When a new scan appears to show old results:
1. Verify queue completion event emits current scan UUID.
2. Check `latestCompletedScanId` in `ScanQueueContext` state path.
3. Confirm `aegis-selected-scan-id` updates after completion.
4. Validate selected UUID exists in `GET /scan/history`.
5. Verify `GET /scan/{id}/results` returns scan-specific payload for that UUID.

When counters look wrong:
1. Validate adapter mapping in `frontend/src/lib/adapters.ts`.
2. Validate helper logic in `frontend/src/lib/status.ts`.
3. Check for legacy `safe` compatibility conditions if old records are present.

When table rows duplicate unexpectedly:
1. Confirm grouping key (`hostname:port`) is used in detail/report tables.
2. Confirm row key includes stable grouped identity.

## 14. Documentation Governance for This File

Update this file when any of the following changes:
1. API response shape used by frontend components.
2. Status/tier normalization rules.
3. Selected-scan ownership or queue-to-selection wiring.
4. Demo/live data policy changes.
5. Major page wiring transitions from demo -> live.
6. Priority roadmap order.

Update style rules:
1. Prefer concrete facts over proposals.
2. Separate implemented behavior from planned behavior.
3. Include exact file paths for changed ownership points.
4. Keep risk and workaround notes actionable.

## 15. File Ownership Pointers (Where to Edit What)

Frontend ownership map:
1. API contracts: `frontend/src/lib/api.ts`
2. Adapter normalization: `frontend/src/lib/adapters.ts`
3. Shared status helpers: `frontend/src/lib/status.ts`
4. Scan selection state: `frontend/src/contexts/SelectedScanContext.tsx`
5. Scan queue lifecycle: `frontend/src/contexts/ScanQueueContext.tsx`
6. Dashboard routing and scan prompt shell: `frontend/src/pages/DashboardLayout.tsx`
7. Main dashboard composition: `frontend/src/pages/DashboardHome.tsx`
8. Report composition: `frontend/src/pages/ScanReport.tsx`

## 16. QA Hardening Update (2026-04-11)

### 16.1 White-screen regression fix
1. Root cause: runtime initialization order bug in network graph (`filteredNodes` referenced before declaration in `useMemo`).
2. Fix applied in `frontend/src/components/dashboard/NetworkGraph.tsx` by defining `filteredNodes` before `viewBox` memoization.
3. Result: dashboard no longer crashes to blank screen when graph component renders.

### 16.2 Completed dashboard/scan tasks
1. Graph viewport clipping fixed via dynamic auto-fit `viewBox` bounds in network graph.
2. Scanner prompt now enforces single URL/domain input; Enter key starts the scan.
3. Live logs now retain extended history (up to 1000 lines) during queue execution.
4. Key labels normalized to `Key Exchange` across dashboard/report/security tables.
5. Per-scan enumeration toggle implemented and wired through `scan_profile` to orchestrator behavior.
6. `simulation/run.py` synchronized with frontend semantics:
	- prints `risk_score` and `q_score` semantics,
	- supports pretty table output for local IDE use,
	- supports `--full-port-scan` and `--format` flags.

### 16.3 Verification status
1. Frontend production build successful after fixes.
2. Runtime scan submissions (`POST /api/v1/scan`) accepted and queue flow remains operational.
3. Simulation runner static syntax check successful in current workspace environment.

## 17. Microsoft.com Follow-up Fixes (2026-04-11)

### 17.1 Subdomain coverage under full enumeration
1. Root cause identified: runtime environment missing `amass` binary, causing enumeration degradation.
2. Fix applied in `backend/discovery/dns_enumerator.py`:
	- increased Amass time budget for large domains,
	- added fallback enumeration via `crt.sh` Certificate Transparency feed when Amass is unavailable/fails,
	- bounded fallback hostnames via `fallback_max_hostnames` for runtime safety.
3. Additional resilience in `backend/pipeline/orchestrator.py`:
	- deterministic hostname candidate expansion when full enumeration is enabled.

### 17.2 Network graph disconnected `443` nodes
1. Root cause identified: graph builder could emit duplicate node IDs for shared IP/port entities across multiple hostnames.
2. Fix applied in `backend/pipeline/orchestrator.py` mission-control graph assembly:
	- unique node emission for domains/IPs/ports,
	- deterministic position maps per unique entity,
	- deduplicated edge creation to keep node-edge topology consistent.
3. Additional frontend safety guard in `frontend/src/components/dashboard/NetworkGraph.tsx`:
	- deduplicate incoming nodes by ID before mapping/rendering, to avoid orphan visuals from legacy payloads.

### 17.3 Runtime verification snapshot
1. Fresh `microsoft.com` full-enumeration run progressed with:
	- `Enumeration completed with 301 hostname candidate(s)`
	- `DNS validation retained 158 hostname(s) in scope`
2. Validation confirms scan now advances beyond enumeration stage and preserves broader hostname coverage than root/www fallback mode.

## 18. Discovery Page Completion Pass (2026-04-11)

### 18.1 Performance improvements
1. Scan history endpoint now uses a bounded default timeline limit to avoid unbounded payloads.
2. Discovery all-time aggregation no longer preloads by default; it is fetched only when the user selects `All Time` scope.
3. All-time discovery scan fan-in is capped to a practical max to prevent UI stalls on very large histories.

### 18.2 Data quality and UX improvements
1. Scan Detail search moved near the Full Report action for faster access.
2. Domains/IP/SSL tabs now normalize unavailable values consistently (`Unavailable`) instead of mixed `-`/`Unknown` placeholders.
3. SSL tab now prioritizes rows with real certificate material and clearer expiry rendering.
4. IP enrichment now attempts geolocation fallback so location fields populate more often.
5. Software tab now infers service entries when explicit server banner metadata is absent.
6. Shadow IT summary clarifies it is computed from active scope data (not hardcoded).
7. Network graph now includes zoom controls and viewport handling tuned for dense result sets.

### 18.3 Score semantics clarification
1. Q-score remains algorithm-risk derived (`q_score = 100 - risk_score`).
2. Certificate expiry is displayed as an operational signal alongside (not inside) deterministic algorithm score.

Backend ownership map:
1. API schemas: `backend/api/v1/schemas.py`
2. Read-model assembly + orchestration: `backend/pipeline/orchestrator.py`
3. Deterministic scoring logic: `backend/analysis/risk_scorer.py`
4. Compliance logic: `backend/compliance/rules_engine.py`
5. Persistence models/enums: `backend/models/`

## 16. De-duplication Notice

This file now acts as the primary long-form operational memory in-repo. Redundant planning/map files should be removed or archived once their unique information is merged here.

## 17. QA Session Log (2026-04-11)

### 17.1 Full QA kickoff
1. Full QA started with the first user-reported blocker: newly-run scan target not being selected in dashboard after completion.

### 17.2 Issue under test
1. Reported behavior: running `icicibank.com` still lands user on previous discord scan result context.
2. Expected behavior: selected scan must switch to the latest completed scan for the just-run target.

### 17.3 Implemented remediation
1. Persisted `latestCompletedScanId` in queue context and exposed it to consumers.
2. Switched dashboard selected-scan sync to this stable completion signal.

### 17.4 Regression automation added
1. New script: `frontend/scripts/qa-scan-selection.mjs`
2. New npm command: `npm run qa:scan-selection -- <target>`
3. Purpose: deterministic E2E validation that selected scan ID matches latest completed scan for target.

### 17.5 Executed evidence
1. Command run: `cd frontend && npm run qa:scan-selection -- icicibank.com`
2. Result snapshot:
	- `previousDiscordScanId`: `9f55b7bf-8714-4a87-8306-9e20f3f23db0`
	- `latestTargetScanId`: `8957d708-d52d-46fb-b46b-5c252d107158`
	- `latestTargetStatus`: `completed`
	- `selectedScanId`: `8957d708-d52d-46fb-b46b-5c252d107158`
	- `selectedMatchesLatestTarget`: `true`
3. Secondary stability run:
	- Command: `cd frontend && npm run qa:scan-selection -- pnb.co.in`
	- `latestTargetScanId`: `363d5799-9f5b-4cc1-bd04-2ab121d0804f`
	- `selectedScanId`: `363d5799-9f5b-4cc1-bd04-2ab121d0804f`
	- `selectedMatchesLatestTarget`: `true`

### 17.6 Build integrity check
1. Frontend production build re-run after QA script changes: success.
2. Known non-blocking warning remains: large bundle/chunk size warning from Vite.

### 17.7 Core engine vs frontend parity check (google.com)
1. User-provided dashboard snapshot for scan `4119c40a-cf25-4a9b-bd5a-59a172b08650` was validated against backend `GET /api/v1/scan/{id}/results`.
2. Backend summary confirmed:
	- `total_assets=1`
	- `transitioning_assets=1`
	- `fully_quantum_safe_assets=0`
	- `vulnerable_assets=0`
	- `critical_assets=0`
	- `average_q_score=50`
3. Backend asset details confirmed:
	- host `google.com`, IP `142.251.43.46`, port `443`
	- TLS `TLSv1.3`
	- cipher `TLS_AES_256_GCM_SHA384`
	- KEX `X25519_MLKEM768`
	- risk `50`
	- tier `PQC_TRANSITIONING`
	- cert signature `ecdsa-with-SHA256`
	- CA `CN=WE2,O=Google Trust Services,C=US`
4. Result: dashboard output and core engine output are aligned for this scan.

### 17.8 Full Port Scan feature rollout
1. Backend capability added: optional full TCP scan mode per scan profile.
2. Activation token parsing supports profile text variants including `full port`, `full-port`, `all ports`, `all-ports`.
3. Runtime behavior when enabled:
	- TCP scan uses all ports (`1-65535`) via nmap `-p-`.
	- UDP remains bounded to existing configured set.
4. Scanner-page UI control added on Quantum Readiness Scanner prompt:
	- Toggle: `Enabled`/`Disabled`.
	- Note explains scope and performance impact.
5. Runtime validation evidence:
	- Scan created with profile `Standard + Full Port Scan`.
	- Backend events included message: `Running full TCP scan across all ports (1-65535) and bounded UDP discovery.`

### 17.9 Dashboard stale graph + profile propagation fixes
1. Bug: `Asset Discovery Network Graph` could show previous-scan graph due to fetching graph data once without selected scan context.
2. Fix:
	- Frontend graph component now requests `GET /api/v1/mission-control/graph` with `scan_id=<selectedScanId>` when selected scan is UUID.
	- Graph refetches when selected scan changes.
3. Files:
	- `frontend/src/components/dashboard/NetworkGraph.tsx`
	- `frontend/src/lib/api.ts`

4. Bug: Full Port Scan toggle could appear enabled but scan creation still default to `Standard` due to queue profile propagation timing/race.
5. Fix:
	- Queue items now store their own `profile` string.
	- `createScan` now uses `nextItem.profile` instead of context state that could lag.
6. File:
	- `frontend/src/contexts/ScanQueueContext.tsx`

7. Evidence after fix:
	- Captured outbound frontend payload includes:
	  `{"target":"github.com","scan_profile":"Standard + Full Port Scan","initiated_by":"frontend_scan_queue"}`
	- Latest backend scan history entry for github persisted `scan_profile="Standard + Full Port Scan"`.
	- Backend scan status events include full-port message when enabled.

## 18. Dashboard Consolidation and Score Clarity (2026-04-11)

### 18.1 Q-score vs risk-score clarification
1. Canonical model:
	- `risk_score` (0-100): higher is worse
	- `q_score` (0-100): higher is better
	- relation: `q_score = 100 - risk_score`
2. Simulation output was updated to include both values and explicit `score_model` notes.

### 18.2 Dashboard table consolidation
1. Analyst view duplicated asset data in two places:
	- `Asset Inventory` card
	- `Scan Detail -> Assets` tab
2. Change made:
	- removed duplicate `Asset Inventory` panel from dashboard analyst page
	- added `Search assets...` filter directly into `Scan Detail -> Assets`
3. Goal: one canonical asset table on dashboard, less cognitive duplication.

### 18.3 Key exchange UNKNOWN hardening
1. Improved TLS metadata resolution to ignore unusable `UNKNOWN` placeholders.
2. Added fallback behavior when TLS1.3 resolver returns unknown-like values.
3. Added TLS1.2 metadata fallback for key exchange when cipher parser value is unknown.
4. Residual note:
	- some edge targets can still report unknown values when remote endpoints provide insufficient handshake metadata.
	- unknown rate should reduce on fresh scans after these changes.

### 18.4 Discovery resilience for previously empty scans
1. Added `www.<domain>` candidate during DNS validation when enumeration is skipped.
2. Added fallback direct TLS probing on common ports when port scanning yields zero findings.
3. Full-port mode changed to additive behavior:
	- bounded scan first
	- full TCP sweep second
