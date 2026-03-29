# Aegis

Quantum-readiness assessment and remediation command platform for banking infrastructure.

> Discover public cryptographic surfaces, generate CBOM evidence, classify post-quantum readiness, produce remediation guidance, and issue compliance certificates from one scan-centric workflow.

## Overview

Aegis is built for the **Harvest Now, Decrypt Later (HNDL)** problem. It helps security teams identify which internet-facing banking assets still rely on classical cryptography that becomes unsafe in a post-quantum future, then turns that assessment into operator-ready evidence:

- **Discovery:** Enumeration of public-facing cryptographic assets (TLS, VPN, API).
- **Analysis:** Deterministic quantum-risk scoring (45/35/10/10 weighted model).
- **Evidence:** CycloneDX 1.6 Cryptographic Bill of Materials (CBOM) generation.
- **Classification:** NIST-aligned PQC readiness tiers (Safe, Transitioning, Vulnerable).
- **Remediation:** Phased migration guidance and technical patches grounded in NIST standards.
- **Certification:** Post-Quantum signed X.509 compliance certificates (ML-DSA-65).

## Core Capabilities

- **Byte-Level PQC Detection:** Specialized OQS-patched engine that detects hybrid PQC (e.g., X25519MLKEM768) at the handshake level.
- **Deterministic Logic:** Security scoring and classification are hard-coded to NIST standards, not delegated to LLMs.
- **Cloud Intelligence:** Retrieval-Augmented Generation (RAG) using Groq, Jina AI, and Cohere to generate legally-grounded remediation roadmaps.
- **High Performance:** Multi-mode scanning including a high-speed "Direct Mode" for instant results.

## Tech Stack

### Backend & Infrastructure
- **Runtime:** Python 3.11 on **Alpine Linux** (Specialized PQC Image).
- **Core:** FastAPI, SQLAlchemy (Async), PostgreSQL 15.
- **PQC Engine:** **liboqs**, **OpenSSL 3.4.0** with OQS Provider.
- **Vector DB:** Qdrant (Search for NIST Standards).

### Intelligence & RAG
- **LLMs:** Groq (Llama 3.3 70B), OpenRouter (Gemma 3 27B).
- **Embeddings:** Jina AI (v3), Cohere (v3).

### Frontend
- **Framework:** Next.js 14, TypeScript, Tailwind CSS.
- **UI:** Custom shadcn-style primitives.

## Quick Start

### 1. Configure Environment
Create a `.env` file using the template in [SETUP.md](./SETUP.md). You will need keys for Groq and Jina AI.

### 2. Launch Infrastructure
```bash
docker compose up -d --build
docker exec aegis-backend alembic upgrade head
docker exec aegis-backend python scripts/ingest_nist_docs.py
```

### 3. Run a Scan
- **Frontend:** Open `http://localhost:3000` after running `npm run dev` in the `frontend` folder.
- **Terminal:** Run `python simulate_aegis.py` for an end-to-end benchmark table.

## API Surface

- `GET /health` — System status
- `POST /api/v1/scan` — Dispatch scan job
- `GET /api/v1/scan/{scan_id}/results` — Fetch compiled artifacts
- `GET /api/v1/mission-control/overview` — Portfolio posture summary

## Documentation

- [SETUP.md](./SETUP.md) — Comprehensive installation guide
- [IMPLEMENTATION.md](./IMPLEMENTATION.md) — Technical architecture and data model
- [SOLUTION.md](./SOLUTION.md) — Product framing and problem context
- [API.md](./API.md) — Endpoint documentation

---

**Aegis**  
Quantum-readiness assessment and remediation for banking-grade internet-facing infrastructure.
