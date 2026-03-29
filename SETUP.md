# 🛡️ Aegis: Project Setup Guide

Follow these steps to set up the **Aegis Post-Quantum Cryptography Platform** on your local machine.

## 📋 Prerequisites

*   **Docker Desktop**: [Install Here](https://www.docker.com/products/docker-desktop/)
*   **Git**: [Install Here](https://git-scm.com/downloads)
*   **API Keys**: You will need keys for **Groq** (primary LLM) and **Jina AI** (primary Embeddings).

---

## 🔑 1. Environment Configuration

Create a `.env` file in the root directory. Copy the template below and replace the placeholder keys with your own.

```ini
# ── Database & Vector DB ───────────────────────────────
DATABASE_URL=postgresql+asyncpg://aegis:aegis@postgres:5432/aegis
QDRANT_URL=http://qdrant:6333
QDRANT_COLLECTION_NAME=aegis_nist_docs
DOCS_SOURCE_DIR=docs/nist

# ── Application ────────────────────────────────────────
SECRET_KEY=change-me-in-production
PROJECT_NAME=Aegis
API_V1_STR=/api/v1
SKIP_ENUMERATION=true

# ── Cloud Intelligence (RAG) ──────────────────────────
EMBEDDING_PROVIDER_MODE=cloud
LLM_PROVIDER_MODE=cloud
LLM_TIMEOUT_SECONDS=20.0
EMBEDDING_TIMEOUT_SECONDS=20.0

# Groq (Primary LLM)
GROQ_API_KEY=gsk_...
GROQ_MODEL=llama-3.3-70b-versatile

# Jina AI (Primary Embeddings)
JINA_API_KEY=jina_...
JINA_EMBEDDING_MODEL=jina-embeddings-v3

# Fallbacks
OPENROUTER_API_KEY=sk-or-...
OPENROUTER_MODEL=google/gemma-3-27b-it
COHERE_API_KEY=...
COHERE_EMBEDDING_MODEL=embed-english-v3.0
```

---

## 🏗️ 2. Infrastructure Deployment

Aegis uses a custom **Alpine Linux** build with a pre-compiled **OQS-OpenSSL** binary.

1.  **Launch the services**:
    ```bash
    docker compose up -d --build
    ```
    *Note: The first build compiles libraries from source and takes 3-5 minutes.*

2.  **Verify the PQC Engine**:
    ```bash
    docker exec aegis-backend openssl-oqs list -providers
    ```
    Confirm that `oqsprovider` appears in the active list.

---

## 🗄️ 3. Initialization

Once the containers are running, initialize the database and the vector index.

1.  **Apply Database Schema**:
    ```bash
    docker exec aegis-backend alembic upgrade head
    ```

2.  **Ingest NIST Standards**:
    This step embeds the NIST standard documents into Qdrant using Jina AI.
    ```bash
    docker exec aegis-backend python scripts/ingest_nist_docs.py
    ```

---

## 🌐 4. Usage

### Dashboard Access
*   **Frontend UI:** `http://localhost:3000` (run `cd frontend && npm install && npm run dev`)
*   **Backend API (Swagger):** `http://localhost:8000/docs`

### Terminal Simulation
Aegis includes a terminal-based benchmark tool to verify the entire pipeline instantly:
```bash
# Setup venv
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# Run simulation
python simulate_aegis.py
```

---

## 🛠️ Troubleshooting

*   **SSL Errors**: If cloud API calls fail, ensure the `backend/intelligence/cloud_utils.py` tunnel is active.
*   **N/A Scores**: Ensure the target site is reachable. Try `github.com` as a verified target.
*   **Docker Crash**: Ensure Docker Desktop has at least 4GB of RAM allocated.
