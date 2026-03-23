# Aegis - Persistent Project Memory

## 1. Project Purpose
Aegis is an autonomous, continuous Cryptographic Intelligence Platform designed for the banking sector to combat the Harvest Now, Decrypt Later (HNDL) quantum threat vector. It discovers public-facing cryptographic assets, generates a CycloneDX 1.6 CBOM, scores quantum risk, evaluates NIST FIPS 203/204/205 compliance via a deterministic rules engine, generates Post-Quantum Cryptography (PQC) remediation patches via a RAG pipeline, and issues three-tier X.509 compliance certificates.

## 2. Current Development Phase
**Status: Pre-Implementation (Phase 1 Starting)**

No application code has been written yet. The project is entering **Phase 1: Project Scaffolding & Infrastructure** as defined in `TODO.md`.

## 3. Current State of the System

### Completed
- `SOLUTION.md` — Product definition, threat models, business context. **Never modify.**
- `IMPLEMENTATION.md` — Authoritative technical specification (architecture, modules, data models, pipeline logic, testing plan).
- `TODO.md` — 10-phase chronological engineering roadmap with atomic checklist tasks.
- `AGENTS.md` — Agent workflow guidance, document hierarchy, execution strategy.
- `RULES.md` — Operational constraints, guardrails, and safety rules.
- `MEMORY.md` — This file. Persistent project state for agent continuity.
- `.agents/skills/` — Reusable agent skills for frontend patterns.

### Pending (All 10 Phases of TODO.md)
- Docker + OQS-patched OpenSSL infrastructure
- PostgreSQL 15 database schema and Alembic migrations
- Discovery Engine (DNS, ports, TLS probing, asset aggregation)
- Cryptographic Analysis Engine (cipher parsing, cert analysis, risk scoring)
- PQC Rules Engine (deterministic compliance classification) and CBOM generator
- Threat Intelligence RAG pipeline (LangChain + Qdrant, HNDL timelines, patch generation)
- Certification Engine (ML-DSA-65 X.509 signing, three-tier issuance)
- Pipeline orchestrator and FastAPI REST API endpoints
- Next.js 14 frontend (dashboard, heatmap, CBOM viewer, cert viewer, dual reports)

## 4. Key Technical Decisions (Immutable)
- **Tech Stack:** Python 3.11 (FastAPI, asyncio), Next.js 14, PostgreSQL 15.
- **Crypto Engine:** Must use `liboqs` (via `oqs-python`) and OQS-patched OpenSSL built from source in Docker. Host OS OpenSSL will NOT work for PQC.
- **RAG Stack:** LangChain + Qdrant. **Strictly isolated** — generates HNDL timelines, patches, and roadmaps only. RAG must never alter risk scores, compliance tiers, or certificate content.
- **Security Logic:** The PQC Rules Engine is a non-AI, purely deterministic boolean evaluator. No exceptions.
- **AES-256:** Vulnerability value = 0.05, NOT 1.00. AES-256 is quantum-acceptable.
- **Dependency Flow:** Infrastructure → DB Models → Discovery → Analysis → CBOM → Rules → RAG/Certs → Pipeline Orchestrator → API → Frontend.

## 5. Next Logical Task
Execute **Phase 1** from `TODO.md`:
1. Initialize Python backend (`backend/`, `pyproject.toml`, `requirements.txt`).
2. Initialize Next.js frontend (`frontend/`, Tailwind CSS, shadcn/ui).
3. Create `docker/Dockerfile.oqs` (OpenSSL 3.x + OQS provider from source).
4. Create `docker-compose.yml` (backend, postgres, qdrant, langchain).
5. Verify `oqs-python` runs in container via `tests/infra/test_oqs.py`.

## 6. Directory of Key Files

| File | Role |
|------|------|
| `MEMORY.md` | **Read first.** Current project state and next steps. |
| `IMPLEMENTATION.md` | Authoritative technical spec. Consult before implementing any module. |
| `TODO.md` | Execution roadmap. Follow phase order. Mark tasks `[x]` when done. |
| `SOLUTION.md` | Product context and threat models. **Never modify.** |
| `RULES.md` | Operational constraints and guardrails for agents. |
| `AGENTS.md` | Agent workflow guidance and execution strategy. |
| `.agents/skills/` | Reusable patterns for frontend and component development. |
