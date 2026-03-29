# 🛡️ Aegis: Project Setup Guide

This guide provides step-by-step instructions to set up the **Aegis Post-Quantum Cryptography Intelligence Platform**.

## 📋 Prerequisites

Before starting, ensure you have the following installed on your machine:

*   **Docker & Docker Compose**: [Install Docker Desktop](https://www.docker.com/products/docker-desktop/)
*   **Git**: [Install Git](https://git-scm.com/downloads)
*   **Python 3.11+** (Optional, for local scripting/testing)
*   **Node.js 20+** (Optional, for local frontend development)

---

## 🚀 1. Initial Repository Setup

Clone the repository and move into the project directory:

```bash
git clone https://github.com/notgautham/Aegis.git
cd Aegis
```

---

## 🔑 2. Environment Configuration

Aegis relies on several cloud providers for its Intelligence (RAG) and Remediation layers.

1.  Create a `.env` file in the root directory:
    ```bash
    touch .env
    ```
2.  Copy and paste the following configuration, ensuring your API keys are correct:

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

Aegis uses a specialized Docker environment that includes a custom build of **OpenSSL patched for Open-Quantum-Safe (OQS)**.

1.  **Start the services**:
    ```bash
    docker compose up -d --build
    ```
    *Note: The first build will take 3-5 minutes as it compiles `liboqs` and the `oqs-provider` from source.*

2.  **Verify the containers are running**:
    ```bash
    docker compose ps
    ```
    You should see `aegis-backend`, `aegis-postgres`, and `aegis-qdrant` in a `Running` or `Up` state.

---

## 🗄️ 4. Database & Intelligence Initialization

Once the containers are up, you must initialize the schema and the search index.

1.  **Run Database Migrations**:
    ```bash
    docker exec aegis-backend alembic upgrade head
    ```

2.  **Ingest NIST Intelligence Corpus**:
    This step embeds the NIST post-quantum standard documents into the Qdrant vector database using Jina AI.
    ```bash
    docker exec aegis-backend python scripts/ingest_nist_docs.py
    ```

---

## 🌐 5. Accessing the Platform

*   **Backend API Documentation (Swagger)**: [http://localhost:8000/docs](http://localhost:8000/docs)
*   **Frontend Dashboard**: [http://localhost:3000](http://localhost:3000)
*   **Qdrant Dashboard**: [http://localhost:6333/dashboard](http://localhost:6333/dashboard)

---

## 🧪 6. Running an Initial Scan

To verify everything is working, you can trigger a test scan via the API:

```bash
curl -X 'POST' \
  'http://localhost:8000/api/v1/scan/jobs' \
  -H 'Content-Type: application/json' \
  -d '{
  "target": "google.com",
  "scan_type": "discovery"
}'
```

Check the logs to see the pipeline in action:
```bash
docker compose logs -f backend
```

---

## 🛠️ Troubleshooting

*   **Docker Daemon Error**: Ensure Docker Desktop is running.
*   **404 Model Not Found**: Verify that your `GROQ_MODEL` and `OPENROUTER_MODEL` names match the current provider availability.
*   **Connection Refused**: If the backend fails to start, check logs (`docker compose logs backend`) for `ImportError` or configuration issues.
