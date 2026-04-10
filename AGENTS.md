# Aegis — Agent Instructions

This document provides instructions for AI coding agents on how to correctly implement and modify the Aegis project.

## 1. Project Context
Aegis is a continuous, autonomous Cryptographic Intelligence Platform designed for the banking sector. As defined in `SOLUTION.md`, it addresses the Harvest Now, Decrypt Later (HNDL) quantum threat vector. Aegis discovers public-facing cryptographic surfaces, inventories them into a CycloneDX 1.6 Cryptographic Bill of Materials (CBOM), evaluates compliance against NIST FIPS 203/204/205, scores quantum risk, generates remediation strategies via a RAG pipeline, and issues three-tier X.509 compliance certificates.

## 2. Source of Truth

| Document | Role |
|----------|------|
| `README.md` | **Read first.** Project overview, benchmark results, and tech stack summary. |
| `SETUP.md` | **Production setup guide.** Step-by-step instructions for infrastructure, PQC engine verification, and initialization. |
| `API.md` | **Backend surface reference.** Detailed endpoint contracts, request/response shapes, and scan-centric architecture. |
| `DATABASE.md` | **Data architecture.** Full schema mapping for PostgreSQL and collection definitions for Qdrant. |
| `SOLUTION.md` | Product intent, problem statement, threat models, and high-level context. **Never modify this file.** |
| `AGENTS.md` | This file. Workflow guidance and behavioral expectations. |

## 3. Development Workflow
- Work module-by-module (e.g., Discovery Engine, Cipher Suite Parser, etc.) rather than making large unstructured changes.
- Maintain the **PQC-Native** specialized Alpine environment for the backend to ensure byte-level detection works.
- Build minimal working implementations first, verify them, then add robustness, error handling, and edge cases.
- Use the **Cloud Tunnel (Subprocess Isolation)** pattern for any new cloud API integrations to avoid OpenSSL library conflicts.

## 4. Using Agent Skills
The repository includes reusable skills located in `.agents/skills/`. Before implementing complex functionality, agents should check this directory for a relevant skill. Prefer using an existing skill instead of recreating patterns from scratch.

When relevant, prioritize finding and using these skills:

**Backend & Infrastructure:**
- `fastapi-templates` — Async endpoint design, Pydantic schemas, dependency injection.
- `sqlalchemy-alembic-expert-best-practices-code-review` — Async ORM models, repository/DAO, Alembic migrations.
- `docker-oqs` — OQS-patched OpenSSL Dockerfile, docker-compose, PQC verification.
- `pytest-coverage` — Unit/integration test patterns, fixtures, async testing.

**Frontend:**
- `nextjs-app-router-patterns` — Next.js 14 App Router pages, layouts, client components, API client.
- `shadcn-ui` — Component installation, customization, and theming.
- `frontend-design` — Premium UI design principles and aesthetics.
- `react-components` — Design-to-React component conversion.
- `web-design-guidelines` — UX/accessibility auditing.

## 5. Implementation Rules
- **Do not invent new architecture** unless absolutely necessary.
- Respect the defined tech stack (FastAPI, Python 3.11, Vite, React, PostgreSQL, Qdrant).
- Maintain the **45/35/10/10** weighted risk scoring formula as defined in the core logic.
- Avoid large refactors unless explicitly requested by the user.
- **Never modify `SOLUTION.md`.**

## 6. File Structure Discipline
- Follow the repository structure (`backend/`, `frontend/`, `docker/`, `tests/`, `scripts/`, `simulation/`).
- Do not create unnecessary directories or duplicate modules. 
- Keep the `simulation/` directory clean; only official benchmark scripts and evidence should reside here.

## 7. Testing Expectations
- Focus on verifying the pipeline logic (unit, integration) before integrating with the UI.
- Prefer adding unit tests alongside new functionality to validate edge cases (like new cipher suite variants).
- Always verify PQC detection against `pq.cloudflareresearch.com` using the `simulation/run.py` tool.

## 8. Safe Modification Guidelines
- **Avoid modifying** database schemas or deterministic pipeline stages unless explicitly required.
- The PQC Compliance Engine must remain a purely deterministic boolean engine — do not introduce probabilistic or LLM-based logic into security evaluations.
- The RAG pipeline (LangChain + Qdrant) must never have write access to risk scores or compliance tiers.

## 9. Agent Execution Strategy
Before writing any code, execute the following steps:
1. **Read `README.md` and `SETUP.md`** to understand the current project state and environment.
2. **Consult `API.md` and `DATABASE.md`** for the specific architectural boundaries of the task.
3. **Check `.agents/skills/`** for applicable reusable skills.
4. **Implement minimal working functionality.**
5. **Verify** the implementation using the `simulation/run.py` tool and the `pytest` suite.
