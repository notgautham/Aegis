<p align="center">
  <img src="./frontend/public/logo.jpeg" alt="Aegis Logo" width="120" />
</p>

<h1 align="center">🛡️ Aegis</h1>

<p align="center">
  <strong>The Post-Quantum Cryptography Intelligence & Remediation Platform for Banking Infrastructure</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Status-In_Development-yellow?style=for-the-badge" alt="Status" />
  <img src="https://img.shields.io/badge/Python-3.11-blue?style=for-the-badge&logo=python&logoColor=white" alt="Python" />
  <img src="https://img.shields.io/badge/TypeScript-Vite--React-blue?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
</p>

<p align="center">
  <img src="https://img.shields.io/badge/PQC_Engine-OQS--OpenSSL-orange?style=flat-square" alt="PQC Engine" />
  <img src="https://img.shields.io/badge/Runtime-Alpine_Linux-blue?style=flat-square&logo=alpine-linux&logoColor=white" alt="Alpine" />
  <img src="https://img.shields.io/badge/Backend-FastAPI-009688?style=flat-square&logo=fastapi&logoColor=white" alt="FastAPI" />
  <img src="https://img.shields.io/badge/UI-Tailwind_CSS-38B2AC?style=flat-square&logo=tailwind-css&logoColor=white" alt="Tailwind" />
  <img src="https://img.shields.io/badge/Database-PostgreSQL-336791?style=flat-square&logo=postgresql&logoColor=white" alt="Postgres" />
  <img src="https://img.shields.io/badge/Vector_DB-Qdrant-red?style=flat-square" alt="Qdrant" />
  <img src="https://img.shields.io/badge/Linter-Ruff-black?style=flat-square" alt="Ruff" />
</p>

---

## 🌊 Overview

Aegis is a specialized command platform designed to address the **Harvest Now, Decrypt Later (HNDL)** threat. It enables security teams to audit banking-grade internet-facing infrastructure for quantum vulnerabilities, providing a deterministic bridge from classical encryption to a post-quantum future.

By combining low-level handshake inspection with NIST-grounded AI intelligence, Aegis turns raw network discovery into actionable cryptographic evidence and technical remediation roadmaps.

> **Note:** Aegis is currently in active development. Features and scoring models are being refined against emerging NIST FIPS standards.

## 🚀 Key Features

### 🔍 Deep Cryptographic Discovery
- **Byte-Level Handshake Inspection:** Detects hybrid Post-Quantum Cryptography (e.g., `X25519MLKEM768`) that standard scanners miss.
- **Deduplicated Asset Mapping:** Resolves complex organization-wide footprints into unique cryptographic surfaces.
- **Multi-Protocol Support:** Probes TLS, VPN (IKEv2), and API endpoints for JWT vulnerabilities.

### ⚖️ Deterministic Risk Intelligence
- **Weighted Risk Model:** Hard-coded 45/35/10/10 scoring formula based on Shor's Algorithm impact.
- **NIST-Aligned Tiers:** Instant classification into **Fully Safe**, **Transitioning**, or **Vulnerable** readiness tiers.
- **CycloneDX 1.6 CBOM:** Generates industry-standard Cryptographic Bill of Materials for compliance auditing.

### 🧠 Grounded AI Remediation
- **NIST-Grounded Roadmaps:** Uses RAG (Retrieval-Augmented Generation) to search official NIST standard documents.
- **Technical Patches:** Delivers copy-paste Nginx and OpenSSL configurations to enable PQC immediately.
- **HNDL Timelines:** Predicts algorithm break-years using up-to-date quantum computing progress data.

### 📜 Automated PQC Certification
- **Post-Quantum Signatures:** Issues X.509 certificates signed with **ML-DSA-65**.
- **Evidence Persistence:** Stores every scan, certificate, and CBOM in a high-fidelity cryptographic ledger.

## 🛠️ Tech Stack

- **Backend:** FastAPI (Python 3.11), SQLAlchemy, PostgreSQL 15
- **Infrastructure:** **Alpine Linux** with **liboqs** and OQS-patched **OpenSSL 3.4.0**
- **Intelligence:** LangChain, Qdrant (Vector DB), Groq (Llama 3.3 70B)
- **Frontend:** Vite, React, TypeScript, Tailwind CSS, Lucide icons

## 📊 Benchmark Results

The Aegis engine provides real-time, dynamic analysis of the global PQC transition:

| Target | Risk Score | Post-Quantum Status |
| :--- | :--- | :--- |
| **discord.com** | **50.0** | ✅ **Hybrid PQC Detected** (`X25519MLKEM768`) |
| **google.com** | **80.5** | ❌ Classical Only (`X25519`) |
| **amazon.com** | **86.0** | ❌ Classical Only (Legacy TLS) |

## 🏁 Quick Start

### 1. Environment Setup
Clone the repo and configure your `.env` as per [SETUP.md](./SETUP.md). You will need a **Groq** and **Jina AI** key.

### 2. Launch Stack
```bash
docker compose up -d --build
docker compose exec backend alembic upgrade head
docker compose exec backend python scripts/ingest_nist_docs.py
```

### 3. Run Your First Scan
Access the Dashboard at [http://localhost:3000](http://localhost:3000) or run the terminal simulation to persist evidence:
```bash
python simulation/run.py
```

## 📖 Documentation

- [**SETUP.md**](./SETUP.md) — Step-by-step installation guide.
- [**API.md**](./API.md) — Full backend endpoint documentation.
- [**DATABASE.md**](./DATABASE.md) — Detailed schema and data models.
- [**SOLUTION.md**](./SOLUTION.md) — Product framing and problem context.

---

<p align="center">
  Built for the future of cryptographic security.
</p>
