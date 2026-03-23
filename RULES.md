# Aegis — Agent Rules & Guardrails

## 1. Document Hierarchy & Session Protocol

**At the start of every session:**
1. Read `MEMORY.md` — understand the current project state and next logical task.
2. Read `TODO.md` — identify the specific checklist items to execute.
3. Consult `IMPLEMENTATION.md` — review the relevant module's architecture, inputs, outputs, and data model before writing code.

**At the end of every session:**
1. Mark completed items `[x]` in `TODO.md`.
2. Update `MEMORY.md` to reflect the new project state.

| Priority | Document | Role |
|----------|----------|------|
| 1 | `MEMORY.md` | Current project state. **Read first every session.** |
| 2 | `IMPLEMENTATION.md` | Authoritative technical specification. Architecture, modules, data models, tech stack, and pipeline logic. |
| 3 | `TODO.md` | Execution roadmap. Work must follow the chronological phase order and task sequence. |
| 4 | `SOLUTION.md` | Product context. Problem statement, threat models, and business intent. **Never modify.** |
| 5 | `RULES.md` | This file. Operational constraints and guardrails. |
| 6 | `AGENTS.md` | Agent workflow guidance, skill usage, and behavioral expectations. |

---

## 2. Architecture Rules

- **Follow the defined architecture exactly.** Do not invent new layers, modules, services, or data flows unless the user explicitly requests it.
- **Respect module boundaries.** Each module (Discovery, Cipher Parser, Risk Scorer, Rules Engine, CBOM Generator, RAG Pipeline, Certification Engine, Pipeline Orchestrator, API, Frontend) is a discrete unit. Do not merge responsibilities across modules.
- **The PQC Compliance Engine is strictly deterministic.** It must remain a boolean rules engine with zero AI, LLM, or probabilistic influence. This is a non-negotiable security constraint.
- **The RAG pipeline (Dify + Qdrant) is isolated.** It generates HNDL timelines, patches, and migration roadmaps only. It must never read or write risk scores, compliance tiers, or certificate content.
- **AES-256 is NOT quantum-broken.** Any code, logic, or output that flags AES-256 as a critical quantum vulnerability is incorrect. AES-256 receives a vulnerability value of `0.05`, not `1.00`.
- **Layers 4 (RAG) and 5 (Certification) run in parallel** after CBOM generation, as defined in `IMPLEMENTATION.md` Section 2.2.

---

## 3. Execution Rules

- **Work in phase order.** Follow the phases defined in `TODO.md` sequentially. Do not skip ahead to later phases unless all dependencies are satisfied.
- **One task per session.** Each AI session should target one or a small cluster of related checkbox items from `TODO.md`. Mark completed items with `[x]`.
- **Build minimal first.** Implement the simplest working version of each module, verify it, then add robustness and edge-case handling.
- **Update `MEMORY.md` after significant progress.** When a phase is completed or a major module becomes functional, update `MEMORY.md` to reflect the new state.
- **Update `TODO.md` as tasks complete.** Check off items as they are finished so future agents know the current position.
- **Never modify `SOLUTION.md`.** It is the product vision document and is read-only.

---

## 4. Technology Stack Rules

- **Backend:** Python 3.11, FastAPI, asyncio + httpx, SQLAlchemy (async), PostgreSQL 15.
- **Frontend:** Next.js 14 (App Router), Tailwind CSS, shadcn/ui, Recharts.
- **Crypto:** sslyze, pyOpenSSL, `oqs-python` (liboqs), OQS-patched OpenSSL 3.x (compiled from source in Docker).
- **RAG:** Dify (workflow orchestrator), Qdrant (vector DB).
- **Infra:** Docker + Docker Compose.

**Rule:** Do not introduce alternative frameworks, ORMs, or libraries unless the defined tool is provably insufficient and the user approves the change.

---

## 5. Code Quality Rules

- Write clear, modular, well-documented Python and TypeScript code.
- Use type hints in all Python function signatures.
- Use TypeScript (not JavaScript) for all frontend code.
- Follow existing naming conventions and directory structure.
- Keep functions focused — one function, one responsibility.
- Avoid hardcoded values; use constants (e.g., `backend/analysis/constants.py`), config files, or environment variables.

---

## 6. File & Directory Rules

- Follow the directory layout defined in `IMPLEMENTATION.md` and `TODO.md`:
  - `backend/` — FastAPI app, all backend modules
  - `frontend/` — Next.js 14 app
  - `docker/` — Dockerfile, docker-compose
  - `tests/` — unit (`tests/unit/`), integration (`tests/integration/`), infrastructure (`tests/infra/`)
  - `scripts/` — one-off utility scripts (e.g., NIST document ingestion)
- Do not create duplicate modules or redundant directories.
- Place utility scripts in `scripts/`, not inside the backend application code.

---

## 7. Database Rules

- All schema changes must go through Alembic migrations. Do not modify tables by hand or with raw DDL outside of migrations.
- Follow the data model defined in `IMPLEMENTATION.md` Section 5. Do not add, rename, or remove columns without explicit instruction.
- CBOM documents are stored as JSONB. Validate against the CycloneDX 1.6 schema before persisting.

---

## 8. Testing Rules

- Follow the Pipeline Testing Plan defined in `IMPLEMENTATION.md` Section 8.
- Add unit tests when implementing new modules, especially for the Cipher Parser, Risk Scorer, and Rules Engine.
- Use the 10 debugging checkpoints from `IMPLEMENTATION.md` Section 8.4 to validate infrastructure and pipeline stages.
- All tests must run inside the Docker environment (OQS-patched OpenSSL is required).
- Run unit tests via: `docker-compose exec backend pytest tests/unit/ -v`
- Run integration tests via: `docker-compose exec backend pytest tests/integration/ -v --timeout=120`

---

## 9. Safety & Modification Rules

- **Do not modify** the risk scoring formula, vulnerability lookup tables, or compliance tier logic unless explicitly instructed.
- **Do not modify** database schemas outside of Alembic migrations.
- **Do not refactor** across multiple modules in a single session. Keep changes scoped and reversible.
- **Do not delete** existing project documentation files (`SOLUTION.md`, `IMPLEMENTATION.md`, `TODO.md`, `AGENTS.md`, `MEMORY.md`, `RULES.md`).
- If a change requires updating multiple modules (e.g., a schema change), update all affected layers consistently within the same session.

---

## 10. Skill Usage Rules

- Before implementing any module, check `.agents/skills/` for an applicable skill.
- **Backend skills:** `fastapi-templates`, `sqlalchemy-alembic-expert-best-practices-code-review`, `docker-oqs`, `pytest-coverage` — use these before writing backend code, database models, Docker configs, or tests from scratch.
- **Frontend skills:** `nextjs-app-router-patterns`, `shadcn-ui`, `frontend-design`, `react-components`, `web-design-guidelines` — use these before building UI components or pages.
- Read the skill's `SKILL.md` file in full before applying it.
