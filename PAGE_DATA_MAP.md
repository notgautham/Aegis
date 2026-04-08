# AEGIS — Page Data Map

> **Project:** AEGIS is a quantum cryptography intelligence platform built for Punjab National Bank (PNB). It scans network assets (domains, APIs, VPNs), evaluates their cryptographic posture against post-quantum computing threats, and provides remediation guidance aligned with NIST FIPS 203/204/205 standards.
>
> **Stack:** React 18 + TypeScript + Vite + Tailwind CSS. No backend in the frontend repo — connects to a FastAPI backend via `src/lib/api.ts`. Demo data lives in `src/data/demoData.ts`.
>
> **Data flow:** Pages consume data via the `useSelectedScan()` context hook, which returns `selectedAssets: Asset[]` scoped to the currently selected scan. Some pages still import `assets` directly from `demoData.ts` (noted below). Live backend data is fetched when the selected scan ID is a UUID; otherwise demo data is used.

---

## Landing & Auth

### `/` — Landing Page (`Index.tsx`)
- **Data:** None (static marketing content)
- **Displays:** Hero section, capabilities grid, live risk matrix demo, NIST standards overview, pipeline section, trust strip, dashboard preview, CTA, footer
- **Format:** Static text, animated sections via framer-motion

### `/login` — Login (`Login.tsx`)
- **Data:** None
- **Displays:** Email/password form. Sets `localStorage('aegis-auth')` on submit. Redirects to `/dashboard`
- **Format:** Single card with form inputs

---

## Dashboard

All dashboard pages are nested under `/dashboard` via `DashboardLayout.tsx`, which provides the sidebar, top bar, command palette, scan queue widget, and page navigation buttons. All pages are wrapped in `SelectedScanProvider`, `ScanQueueProvider`, `ScanProvider`, and `PinnedPagesProvider` contexts.

### `/dashboard` — Mission Control (`DashboardHome.tsx`)
- **Data source:** `useSelectedScan()` → `selectedAssets`, `selectedScan`, `selectedScanId`; also imports `assets`, `scanHistory`, `scanAssetMap` from demoData for comparison/diff
- **Displays:**
  - **DataContextBadge** — shows which scan is selected
  - **ViewRoleToggle** — switches between Executive / Analyst / Compliance views
  - **KPIStrip** — total assets, Q-Score, critical findings, PQC-ready %, cert expiring count
  - **SinceLastScanStrip** — delta metrics since previous scan
  - **Analyst view:** NetworkGraph, CyberRating gauge, AssetTable (sortable/filterable), QScoreOverview, IntelligencePanel (AI insights from selectedAssets), CertExpiryTimeline, AssetRiskDistribution, CryptoSecurityOverview, RecentActivityFeed
  - **Executive view:** Pie charts (status distribution, key length distribution, cipher usage), top findings table, new assets detected, compliance package modal
  - **Compliance view:** NIST compliance matrix, audit trail
- **Data shape:** `Asset[]` with fields: `domain`, `qScore` (0–1000), `status` (critical|vulnerable|standard|safe|elite-pqc), `tier`, `certInfo`, `dimensionScores`, `cipher`, `tls`, `keyExchange`, `remediation[]`, `hndlBreakYear`, `forwardSecrecy`

---

## Asset Section

### `/dashboard/discovery` — Asset Discovery (`AssetDiscovery.tsx`)
- **Data source:** `useSelectedScan()` → `selectedAssets`; also `domainRecords`, `ipRecords`, `softwareRecords`, `shadowITAlerts`, `assets` from demoData
- **Displays:**
  - **Scope toggle:** "This Scan" (selectedAssets) vs "All Time" (all assets)
  - **Tabs:** Domains, SSL Certificates, IP/Subnets, Software & Services, Network Graph, Shadow IT
  - **Domains tab:** Table of `DomainRecord[]` — domain, registrar, registration/expiry dates, status (new|confirmed|false_positive), risk score
  - **SSL tab:** Table of `Asset[]` (displayAssets) — domain, TLS version, cipher, key exchange, Q-Score, certificate details
  - **IP tab:** Table of `IPRecord[]` — IP address, open ports, subnet, ASN, ISP, city, reverse DNS, risk level
  - **Software tab:** Table of `SoftwareRecord[]` — product, version, type, EOL date, CVE count, PQC native support
  - **Network Graph:** Visual node graph of asset relationships
  - **Shadow IT:** Alert cards for unknown/unauthorized assets
  - **DiscoveryDetailPanel:** Slide-out panel on row click showing detailed info per record type
- **Data shape:** `DomainRecord { domain, registrar, registrationDate, expiryDate, status, riskScore, nameservers }`, `IPRecord { ip, portsOpen, subnet, asn, isp, risk }`, `SoftwareRecord { product, version, type, eolDate, cveCount, pqcNativeSupport }`

### `/dashboard/inventory` — Asset Inventory (`AssetInventory.tsx`)
- **Data source:** `useSelectedScan()` → `selectedAssets`
- **Displays:** Filterable card grid of all assets with search, type filters (All, Web, API, VPN, Mail, IoT, Server)
  - Each card: domain, IP, type icon, TLS version, Q-Score with color coding, status badge, port
  - Click navigates to `/dashboard/assets/:id`
- **Data shape:** `Asset[]` — uses `domain`, `ip`, `type`, `tls`, `qScore`, `status`, `port`

### `/dashboard/assets/:id` — Asset Detail (`AssetDetail.tsx`)
- **Data source:** `assets` from demoData (finds by domain match from URL param)
- **Displays:** Full single-asset deep dive:
  - Asset header: domain, URL, IP, type, status badge, Q-Score gauge
  - Certificate details: subject CN, SANs, issuer, CA, signature algorithm, key type/size, validity dates, days remaining, SHA-256 fingerprint
  - TLS configuration: version, cipher suite, key exchange, forward secrecy status
  - Dimension scores radar: tls_version, key_exchange, cipher_strength, certificate_algo, forward_secrecy, pqc_readiness (each 0–100)
  - HNDL timeline: break year, years remaining, risk level
  - Software info: product, version, EOL, CVEs, PQC support
  - Remediation actions table: priority (P1–P4), finding, action, effort, status
- **Data shape:** Full `Asset` interface including `certInfo`, `dimensionScores`, `software`, `remediation[]`

---

## CBOM (Cryptographic Bill of Materials)

### `/dashboard/cbom` — CBOM Overview (`CBOMOverview.tsx`)
- **Data source:** `useSelectedScan()` → `selectedAssets`; also `caDistribution`, `keyLengthDistribution`, `tlsVersionDistribution`, `assets` from demoData (for cipher chart)
- **Displays:**
  - **KPI cards (6):** Applications covered, sites surveyed, active certificates, weak crypto instances (qScore ≤ 40), certificate issues (days_remaining ≤ 30), PQC-ready %
  - **Charts:** Key Length Distribution (bar), Encryption Protocols (pie), Top Certificate Authorities (horizontal bar), Cipher Usage (horizontal bar)
  - **Per-Application CBOM table:** domain, key length (certificate algo), cipher suite, TLS version, CA, Q-Score, status badge
- **Data shape:** `Asset[]` plus `caDistribution`, `keyLengthDistribution`, `tlsVersionDistribution` (Record<string, number> aggregates)

### `/dashboard/cbom/per-asset` — CBOM Per-Asset (`CBOMPerAsset.tsx`)
- **Data source:** `useSelectedScan()` → `selectedAssets`
- **Displays:** Expandable accordion per asset showing:
  - Crypto algorithm details, cipher suite, key exchange
  - CBOM attestation hash (SHA-256, generated client-side)
  - Verification modal with JSON attestation record
- **Data shape:** `Asset[]` — uses `cipher`, `keyExchange`, `tls`, `certInfo`, `qScore`

### `/dashboard/cbom/export` — CBOM Export Center (`CBOMExport.tsx`)
- **Data source:** None (static UI)
- **Displays:** Export format cards (JSON, PDF, CSV, XML, SARIF, CycloneDX) with download buttons
- **Format:** Static card grid with icons

---

## PQC (Post-Quantum Cryptography)

### `/dashboard/pqc/compliance` — PQC Compliance (`PQCCompliance.tsx`)
- **Data source:** `assets` from demoData (⚠️ not using selectedAssets)
- **Displays:**
  - **Tier distribution cards (4):** Elite PQC, Standard, Legacy, Critical — each with count and percentage
  - **Compliance matrix bar chart**
  - **NIST regulation cards:** FIPS 203 (ML-KEM), FIPS 204 (ML-DSA), FIPS 205 (SLH-DSA) with affected asset counts
- **Data shape:** `Asset[]` — uses `tier`, `status`; static `nistRegulations[]` with id, name, description, affected count

### `/dashboard/pqc/hndl` — HNDL Timeline (`PQCHndl.tsx`)
- **Data source:** `assets` from demoData (for heatmap); `useSelectedScan()` → `selectedAssets` (for IntelligencePanel and context banner)
- **Displays:**
  - **HNDL heatmap matrix:** X-axis = data shelf life (1–30 years), Y-axis = harvest year (2024–2030), cells color-coded by number of assets at risk
  - **Context banner:** Count of assets decryptable before 2033
  - **IntelligencePanel** with AI insights
- **Data shape:** `Asset[]` — uses `hndlBreakYear`, `hndlYears`, `hndlRiskLevel`; heatmap derived from `hndlAssets` (filtered for non-null hndlBreakYear)

### `/dashboard/pqc/quantum-debt` — Quantum Debt (`PQCQuantumDebt.tsx`)
- **Data source:** `assets` from demoData (⚠️ not using selectedAssets)
- **Displays:**
  - **Migration progress:** count of elite-pqc assets vs total
  - **Quantum Debt slider:** interactive slider to model migration % and projected debt reduction
  - **Projected timeline chart** (LineChart)
  - **Cost analysis bar chart**
- **Data shape:** `Asset[]` — uses `status` for elite-pqc count; rest is computed/simulated

---

## Cyber Rating

### `/dashboard/rating/enterprise` — Enterprise Rating (`CyberRatingEnterprise.tsx`)
- **Data source:** `assets`, `enterpriseScore`, `maxScore`, `getTierLabel` from demoData (⚠️ not using selectedAssets)
- **Displays:**
  - **Enterprise Q-Score** (e.g., 370/1000) with tier label
  - **Radar chart:** 6 dimensions averaged across all assets (TLS Version, Key Exchange, Cipher Strength, Certificate, Forward Secrecy, PQC Readiness)
  - **Tier breakdown:** Elite PQC / Standard / Legacy / Critical with asset counts per tier
  - **Score trend line chart** (8-week historical)
  - **Methodology panel** (collapsible)
- **Data shape:** `Asset[]` — uses `dimensionScores`, `tier`; `enterpriseScore` (number), `maxScore` (number)

### `/dashboard/rating/per-asset` — Per-Asset Rating (`CyberRatingPerAsset.tsx`)
- **Data source:** `useSelectedScan()` → `selectedAssets`; `assetTrends` from demoData
- **Displays:**
  - Table: domain, Q-Score (color-coded), tier badge, dimension score bars, trend indicator (↑↓–), status badge
  - Click domain navigates to asset detail
- **Data shape:** `Asset[]` with `qScore`, `tier`, `status`, `dimensionScores`; `assetTrends: Record<string, number[]>` (historical score arrays per asset ID)

### `/dashboard/rating/tiers` — redirects to `/dashboard/rating/enterprise`

---

## Remediation

### `/dashboard/remediation/action-plan` — Action Plan (`RemediationActionPlan.tsx`)
- **Data source:** `useSelectedScan()` → `selectedAssets`
- **Displays:**
  - **Context banner:** summary of total findings and P1 count
  - **Progress bar:** overall remediation completion %
  - **Filterable table:** priority (P1–P4), asset domain, finding, recommended action, effort estimate, status (not_started|in_progress|done|verified)
  - **IntelligencePanel** with AI insights
- **Data shape:** `Asset[].remediation: RemediationAction[]` flattened into `{ priority, finding, action, effort, status, assetDomain, assetId }[]`

### `/dashboard/remediation/ai-patch` — AI Patch Generator (`RemediationAIPatch.tsx`)
- **Data source:** `assets` from demoData (⚠️ not using selectedAssets)
- **Displays:**
  - Server type selector (nginx, Apache, IIS, HAProxy)
  - Patch templates per finding type: code snippets with copy button, NIST reference, impact score
  - Finding types: TLS 1.0/1.1, RSA key exchange, No PQC, Certificate expiring, HSTS not enabled, RSA-2048 certificate
- **Data shape:** Static `patchTemplates: Record<string, { finding, label, code, impact, nistRef }[]>`

### `/dashboard/remediation/roadmap` — Migration Roadmap (`RemediationRoadmap.tsx`)
- **Data source:** Static phases array (no asset data)
- **Displays:**
  - **5-phase timeline:** Discovery & Assessment → TLS Hardening → PQC Hybrid → Full PQC Migration → Validation & Certification
  - Each phase: name, timeline, status (completed|in_progress|upcoming), progress %, task checklist
  - Search/filter by phase status
- **Data shape:** `Phase { id, name, timeline, status, progress, tasks[] }`

---

## Reporting

### `/dashboard/reporting/executive` — Executive Reports (`ReportingExecutive.tsx`)
- **Data source:** Static report templates
- **Displays:** Report template cards (Executive Summary, NIST Compliance, Board Presentation, Regulatory Filing) with sections list, last generated date, format, generate/download buttons
- **Data shape:** Static `reportTemplates[]`

### `/dashboard/reporting/scheduled` — Scheduled Reports (`ReportingScheduled.tsx`)
- **Data source:** Static scheduled report data
- **Displays:** Table of scheduled reports with name, frequency, next run, recipients, status toggle
- **Data shape:** Static schedule entries

### `/dashboard/reporting/on-demand` — On-Demand Builder (`ReportingOnDemand.tsx`)
- **Data source:** Static configuration options
- **Displays:** Report builder form with section checkboxes, date range, format selection, asset scope
- **Data shape:** Static form options

---

## Scan

### `/dashboard/scan-console` — Scan Console (`ScanConsole.tsx`)
- **Data source:** `useScanContext()` for scan state; `useScanQueue()` for queue state
- **Displays:**
  - Target input (comma-separated domains as chips)
  - Scan profile selector, upload button
  - Start scan button → triggers `ScanQueueContext.startQueue()` which calls `api.createScan()` per target
  - Active scan progress: phase name, progress bar, assets discovered count
- **Data shape:** `ScanQueueItem { id, target, status, currentPhase, progress, scanId? }`

### `/dashboard/history` — Scan History (`ScanHistory.tsx`)
- **Data source:** `scanHistory` from demoData; potentially live data via `api.getScanHistory()`
- **Displays:**
  - **Trend chart:** Q-Score over time (line chart)
  - **History table:** scan ID, target, date, duration, assets found, Q-Score, critical findings, status
  - Actions: View (navigates to scan report or sets selectedScanId), Compare, Open in Dashboard
- **Data shape:** `ScanHistoryEntry { id, target, started, duration, assetsFound, qScore, criticalFindings, status }`

### `/dashboard/scans/:scanId` — Scan Report (`ScanReport.tsx`)
- **Data source:** `scanHistory` from demoData (finds by scanId param); `scanSnapshots` from SelectedScanContext
- **Displays:** Detailed single-scan report with summary stats, asset breakdown, findings
- **Data shape:** `ScanHistoryEntry` + associated `Asset[]` from scanAssetMap

---

## Settings

### `/dashboard/settings` — Settings Layout (`SettingsLayout.tsx`)
- **Data source:** None
- **Displays:** Settings navigation tabs (Scan Config, Notifications, Integrations) with `<Outlet />`

### `/dashboard/settings/scan-config` — Scan Configuration (`SettingsScanConfig.tsx`)
- **Data source:** None (local state only)
- **Displays:** Scan configuration form: TLS depth, timeout, port ranges, PQC detection toggle, concurrent connections slider
- **Data shape:** Local form state (not persisted)

### `/dashboard/settings/notifications` — Notifications (`SettingsNotifications.tsx`)
- **Data source:** `useScanContext()` for scan-complete notification prefs
- **Displays:** Notification channel toggles (email, Slack, in-app), alert thresholds, scan completion notifications
- **Data shape:** Local toggle state

### `/dashboard/settings/integrations` — Integrations (`SettingsIntegrations.tsx`)
- **Data source:** None (static)
- **Displays:** Integration cards (Jira, Slack, PagerDuty, Splunk, etc.) with connect/disconnect status
- **Data shape:** Static integration list

---

## Shared Components (data-consuming)

| Component | Data | Purpose |
|---|---|---|
| `KPIStrip` | `selectedAssets` via context | Top-level KPI cards |
| `AssetTable` | `selectedAssets` via context | Sortable/filterable asset table |
| `NetworkGraph` | `selectedAssets` via context | Force-directed node graph |
| `CyberRating` | `selectedAssets` via context | Q-Score gauge |
| `QScoreOverview` | `selectedAssets` via context | Score breakdown |
| `IntelligencePanel` | `assets` prop (Asset[]) | AI-generated insight bullets |
| `CertExpiryTimeline` | `selectedAssets` via context | Certificate expiry bar chart |
| `AssetRiskDistribution` | Static data | Risk level histogram |
| `CryptoSecurityOverview` | `selectedAssets` via context | Crypto posture summary |
| `RecentActivityFeed` | Static data | Recent events list |
| `DataContextBadge` | `selectedScanId` via context | Shows active scan label |
| `SinceLastScanStrip` | `selectedAssets` + previous scan diff | Delta metrics |

---

## Key Data Interfaces

```typescript
Asset {
  id, domain, url, port, type, tls, tlsVersionsSupported,
  cipher, keyExchange, certificate, certInfo: CertificateInfo,
  qScore (0-1000), status, tier, ip, ipv6,
  hndlYears, hndlBreakYear, hndlRiskLevel,
  dimensionScores: DimensionScores, forwardSecrecy, hstsEnabled,
  ownerTeam, businessCriticality, lastScanned,
  software: SoftwareInfo | null, remediation: RemediationAction[],
  cryptoAgilityScore
}

DimensionScores { tls_version, key_exchange, cipher_strength, certificate_algo, forward_secrecy, pqc_readiness } // each 0-100

CertificateInfo { subject_cn, subject_alt_names, issuer, certificate_authority, signature_algorithm, key_type, key_size, valid_from, valid_until, days_remaining, sha256_fingerprint }

ScanHistoryEntry { id, target, started, duration, assetsFound, qScore, criticalFindings, status }

RemediationAction { priority (P1-P4), finding, action, effort (low|medium|high), status }
```

---

## Backend API Endpoints (via `src/lib/api.ts`)

| Method | Endpoint | Used By |
|---|---|---|
| POST | `/api/v1/scan` | ScanQueueContext (createScan) |
| GET | `/api/v1/scan/{scanId}` | ScanQueueContext (polling status) |
| GET | `/api/v1/scan/{scanId}/results` | SelectedScanContext (live asset data) |
| GET | `/api/v1/scan/history` | ScanHistory page |
| GET | `/api/v1/assets/{assetId}/cbom` | Available, not yet wired |
| GET | `/api/v1/assets/{assetId}/remediation` | Available, not yet wired |
| GET | `/api/v1/assets/{assetId}/certificate` | Available, not yet wired |
| GET | `/api/v1/mission-control/overview` | Available, not yet wired |

Data from the backend is transformed via `src/lib/adapters.ts` (`adaptAsset`, `adaptScanResults`, `adaptScanHistory`) to match the frontend `Asset` and `ScanHistoryEntry` interfaces.

---

## ⚠️ Pages Still Using Static `assets` Instead of `selectedAssets`

These pages import `assets` directly from `demoData.ts` and do **not** reflect the currently selected scan:

- `PQCCompliance.tsx` — uses `assets` for tier counts
- `PQCHndl.tsx` — uses `assets` for HNDL heatmap
- `PQCQuantumDebt.tsx` — uses `assets` for migration count
- `CyberRatingEnterprise.tsx` — uses `assets` for dimension averages and tier breakdown
- `RemediationAIPatch.tsx` — uses `assets` for finding detection
- `AssetDetail.tsx` — uses `assets` to find asset by domain
- `CBOMOverview.tsx` — uses `assets` for cipher usage chart (partially)
