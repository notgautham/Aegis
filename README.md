<p align="center">
  <img src="./frontend/public/logo.jpeg" alt="Aegis Logo" width="120" />
</p>

<h1 align="center">Aegis</h1>

<p align="center">
  <strong>The Post-Quantum Cryptography Intelligence & Remediation Platform for Banking Infrastructure</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Status-Active_Development-yellow?style=for-the-badge" alt="Status" />
  <img src="https://img.shields.io/badge/Architecture-Fully_Containerized-blue?style=for-the-badge" alt="Architecture" />
  <img src="https://img.shields.io/badge/Security-PQC_Native-orange?style=for-the-badge" alt="Security" />
</p>

<p align="center">
  <img src="https://img.shields.io/badge/PQC_Engine-OQS--OpenSSL-orange?style=flat-square" alt="PQC Engine" />
  <img src="https://img.shields.io/badge/Graph_DB-Apache_AGE-red?style=flat-square" alt="Graph DB" />
  <img src="https://img.shields.io/badge/Vector_DB-Qdrant-darkblue?style=flat-square" alt="Vector DB" />
  <img src="https://img.shields.io/badge/Backend-FastAPI-009688?style=flat-square&logo=fastapi&logoColor=white" alt="FastAPI" />
  <img src="https://img.shields.io/badge/Frontend-React_Vite-61DAFB?style=flat-square&logo=react&logoColor=black" alt="React" />
</p>

---

## 🌊 Overview

Aegis is an autonomous cryptographic command platform designed to defend banking infrastructure against the **Harvest Now, Decrypt Later (HNDL)** threat. By merging low-level PQC handshake inspection with NIST-grounded AI intelligence, Aegis provides a deterministic bridge to a quantum-safe future.

The platform continuously discovers internet-facing assets, evaluates their cryptographic posture using high-fidelity OQS-patched handshakes, and generates technical remediation roadmaps grounded in official NIST FIPS standards.

## 🏗️ Project Structure

The project is organized as a modular monolith, fully containerized for seamless development and deployment:

```text
├── backend/             # FastAPI engine & PQC Scanning Logic
│   ├── analysis/        # Risk scoring & handshake metadata resolution
│   ├── discovery/       # Multi-protocol probing (TLS, VPN, API)
│   ├── intelligence/    # RAG Orchestrator & NIST roadmap generators
│   └── pipeline/        # Core deterministic scan orchestrator
├── frontend/            # React + Vite UI with Tailwind CSS
│   └── src/components/  # Interactive D3/Force-Graph visualizations
├── docker/              # Infrastructure-as-Code (OQS builds, Graph DB init)
├── docs/                # Intelligence corpus (NIST Standards, FIPS PDFs)
├── scripts/             # Data ingestion & validation utilities
└── simulation/          # Standalone terminal-based scan utilities
```

## 🚀 Key Capabilities

### 🔍 Discovery & Visualization
- **Interactive Asset Mapping:** Real-time visualization of organization-wide network topologies using **Apache AGE** (Graph Database).
- **Quantum-Safe Handshakes:** Direct detection of hybrid PQC groups (e.g., `X25519MLKEM768`) via native OQS integration.

### ⚖️ Deterministic Scoring
- **NIST-Aligned Readiness Tiers:** Automated classification into *Fully Safe*, *Transitioning*, or *Vulnerable*.
- **CBOM Generation:** Production of CycloneDX 1.6 Cryptographic Bill of Materials for compliance auditing.

### 🧠 AI Intelligence
- **Grounded Remediation:** RAG-powered patch generation using **Qdrant** vector search against official NIST guidelines.
- **HNDL Timelines:** Predictive analysis of algorithm break-years based on quantum computing progress.

## 📖 Essential Documentation

For detailed technical guides and references, please see the specific documentation files:

- 🛠️ [**SETUP.md**](./SETUP.md) — Universal installation, environment configuration, and startup guide.
- 📡 [**API.md**](./API.md) — Backend endpoint documentation and cURL integration examples.
- 💾 [**DATABASE.md**](./DATABASE.md) — Detailed schema mapping for PostgreSQL, Apache AGE (Graph), and Qdrant.
- 🎯 [**SOLUTION.md**](./SOLUTION.md) — Strategic product framing, threat models, and problem statement.

---

<p align="center">
  Built for the future of cryptographic security.
</p>
