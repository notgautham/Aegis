# 🛡️ Aegis: Project Setup Guide

This guide provides step-by-step instructions to set up the **Aegis Post-Quantum Cryptography Intelligence Platform**.

## 📋 Prerequisites

Before starting, ensure you have the following installed:

*   **Docker & Docker Compose**: [Install Docker Desktop](https://www.docker.com/products/docker-desktop/)
*   **Git**: [Install Git](https://git-scm.com/downloads)
*   **Python 3.11+**: For running the terminal simulation script.

---

## 🚀 1. Initial Repository Setup

Clone the repository and move into the project directory:

```bash
git clone https://github.com/notgautham/Aegis.git
cd Aegis
```

---

## 🔑 2. Environment Configuration

Aegis uses high-performance cloud providers for its Intelligence layer. Create a `.env` file in the root directory:

```ini
# ── Database & Infrastructure ──────────────────────────
DATABASE_URL=postgresql+asyncpg://aegis:aegis@postgres:5432/aegis
QDRANT_URL=http://qdrant:6333
QDRANT_COLLECTION_NAME=aegis_nist_docs
DOCS_SOURCE_DIR=docs/nist

# ── Application Settings ──────────────────────────────
SECRET_KEY=change-me-in-production
PROJECT_NAME=Aegis
API_V1_STR=/api/v1
SKIP_ENUMERATION=true

# ── Intelligence Layer (Cloud-Only) ───────────────────
EMBEDDING_PROVIDER_MODE=cloud
LLM_PROVIDER_MODE=cloud
LLM_TIMEOUT_SECONDS=20.0
EMBEDDING_TIMEOUT_SECONDS=20.0

# LLM Providers (Primary: Groq | Fallback: OpenRouter)
GROQ_API_KEY=your_groq_key
GROQ_MODEL=llama-3.3-70b-versatile

OPENROUTER_API_KEY=your_openrouter_key
OPENROUTER_MODEL=google/gemma-3-27b-it

# Embedding Providers (Primary: Jina | Fallback: Cohere)
JINA_API_KEY=your_jina_key
JINA_EMBEDDING_MODEL=jina-embeddings-v3

COHERE_API_KEY=your_cohere_key
COHERE_EMBEDDING_MODEL=embed-english-v3.0
```

---

## 🏗️ 3. Infrastructure Deployment (Docker)

Aegis runs on a specialized **Alpine Linux** environment with a custom **OQS-patched OpenSSL** build for byte-level PQC detection.

1.  **Start the services**:
    ```bash
    docker compose up -d --build
    ```
    *Note: The build compiles `liboqs` and the `oqs-provider` from source. It takes ~3-5 minutes.*

2.  **Verify the PQC Engine**:
    ```bash
    docker exec aegis-backend openssl-oqs list -providers
    ```
    You should see `oqsprovider` in the active status list.

---

## 🗄️ 4. Initialization

Initialize the database schema and the vector search index:

1.  **Run Migrations**:
    ```bash
    docker exec aegis-backend alembic upgrade head
    ```

2.  **Ingest NIST Intelligence Corpus**:
    ```bash
    docker exec aegis-backend python scripts/ingest_nist_docs.py
    ```

---

## 🌐 5. Running Scans

### via Frontend Dashboard
1.  Start the frontend: `cd frontend && npm install && npm run dev`
2.  Access [http://localhost:3000](http://localhost:3000)
3.  Enter a target (e.g., `discord.com`) and click **Launch Scan**.

### via Terminal Simulation
Aegis includes a robust terminal simulation tool for automated benchmarking:
```bash
# Set up a local venv
python3 -m venv .venv
source .venv/bin/activate
pip install httpx

# Run the simulation
python simulate_aegis.py
```

---

## 📊 Access Points
*   **Backend API (Swagger)**: [http://localhost:8000/docs](http://localhost:8000/docs)
*   **Vector DB Dashboard**: [http://localhost:6333/dashboard](http://localhost:6333/dashboard)
