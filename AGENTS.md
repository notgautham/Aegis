# Aegis — Agent Instructions

This document provides instructions for AI coding agents on how to correctly implement and modify the Aegis project.

## 1. Project Context
Aegis is a continuous, autonomous Cryptographic Intelligence Platform designed for the banking sector. As defined in `SOLUTION.md`, it addresses the Harvest Now, Decrypt Later (HNDL) quantum threat vector. Aegis discovers public-facing cryptographic surfaces, inventories them into a CycloneDX 1.6 Cryptographic Bill of Materials (CBOM), evaluates compliance against NIST FIPS 203/204/205, scores quantum risk, generates remediation strategies via a RAG pipeline, and issues three-tier X.509 compliance certificates.

## 2. Source of Truth

| Document | Role |
|----------|------|
| `MEMORY.md` | **Read first every session.** Shows what exists, what's done, and what is next. |
| `IMPLEMENTATION.md` | **Authoritative technical specification.** Architecture, modules, data models, tech stack, pipeline logic. Consult before implementing any module. |
| `TODO.md` | **Execution roadmap.** Chronological, atomic checklist of tasks. Follow phase order strictly. |
| `SOLUTION.md` | Product intent, problem statement, threat models, and high-level context. **Never modify this file.** |
| `RULES.md` | Operational constraints, guardrails, and safety rules for agents. |
| `AGENTS.md` | This file. Workflow guidance and behavioral expectations. |

## 3. Development Workflow
- Execute tasks in the phase order defined in `TODO.md`, not `IMPLEMENTATION.md` (which provides the design rationale, not the task sequence).
- Work module-by-module (e.g., Discovery Engine, Cipher Suite Parser, etc.) rather than making large unstructured changes.
- Build minimal working implementations first, verify them, then add robustness, error handling, and edge cases.
- After completing tasks, mark them `[x]` in `TODO.md` and update `MEMORY.md` to reflect the new project state.

## 4. Using Agent Skills
The repository includes reusable skills located in `.agents/skills/`. Before implementing complex functionality, agents should check this directory for a relevant skill. Prefer using an existing skill instead of recreating patterns from scratch.

When relevant, prioritize finding and using these skills:

**Backend & Infrastructure:**
- `fastapi-templates` — Async endpoint design, Pydantic schemas, dependency injection
- `sqlalchemy-alembic-expert-best-practices-code-review` — Async ORM models, repository/DAO, Alembic migrations
- `docker-oqs` — OQS-patched OpenSSL Dockerfile, docker-compose, PQC verification (custom skill)
- `pytest-coverage` — Unit/integration test patterns, fixtures, async testing

**Frontend:**
- `nextjs-app-router-patterns` — Next.js 14 App Router pages, layouts, client components, API client
- `shadcn-ui` — Component installation, customization, and theming
- `frontend-design` — Premium UI design principles and aesthetics
- `react-components` — Design-to-React component conversion
- `web-design-guidelines` — UX/accessibility auditing

## 5. Implementation Rules
- **Do not invent new architecture** unless absolutely necessary.
- Follow the exact module boundaries defined in `IMPLEMENTATION.md` to ensure correct data flow and separation of concerns.
- Respect the defined tech stack (FastAPI, Python 3.11, Next.js 14, PostgreSQL) and libraries (sslyze, pyOpenSSL, liboqs, CycloneDX).
- Avoid large refactors unless explicitly requested by the user.
- **Never modify `SOLUTION.md`.**

## 6. File Structure Discipline
- Follow the repository structure defined in `IMPLEMENTATION.md` and `TODO.md` (`backend/`, `frontend/`, `docker/`, `tests/`, `scripts/`).
- Do not create unnecessary directories or duplicate modules. Maintain clear separation between backend, frontend, docker, and intelligence layers.

## 7. Testing Expectations
- When implementing modules, follow the **Pipeline Testing Plan** defined in `IMPLEMENTATION.md` Section 8.
- Focus on verifying the pipeline logic (unit, integration) before integrating with the UI.
- Prefer adding unit tests alongside new functionality to validate edge cases (like cipher suite parsing rules).
- Use the 10 debugging checkpoints from `IMPLEMENTATION.md` Section 8.4 to validate each pipeline stage.

## 8. Safe Modification Guidelines
- **Avoid modifying** database schemas, deterministic pipeline stages (like the PQC Rules Engine), or core data models unless explicitly required.
- The PQC Compliance Engine must remain a purely deterministic boolean engine — do not introduce probabilistic or LLM-based logic into security evaluations.
- The RAG pipeline (LangChain + Qdrant) must never read or write risk scores, compliance tiers, or certificate content.
- If changes to data models or pipeline logic are necessary, update all related modules consistently.

## 9. Agent Execution Strategy
Before writing any code, execute the following steps:
1. **Read `MEMORY.md`** to understand the current project state and next logical task.
2. **Read `TODO.md`** to identify the specific checklist item(s) to implement.
3. **Read the relevant sections of `IMPLEMENTATION.md`** for the module's architecture, inputs, outputs, and data model.
4. **Check `.agents/skills/`** for applicable reusable skills.
5. **Implement minimal working functionality.**
6. **Verify** the implementation against the testing plan and debugging checkpoints in `IMPLEMENTATION.md`.
7. **Update `TODO.md`** (mark tasks `[x]`) and **update `MEMORY.md`** to reflect the new project state.
