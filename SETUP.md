# Aegis Setup Guide

This guide provides the exact steps to host and run the Aegis platform locally using Docker. 

## Prerequisites

- **Git**
- **Docker Desktop** (Required for all platforms: Windows, macOS, Linux)

*Note:* No local Node.js or Python installations are required. No cloud API keys are required for the default local deterministic mode. The intelligence corpus (Qdrant) and environment variables (`.env`) are already preconfigured and preloaded for you.

---

## 1. Clone the Repository

```bash
git clone https://github.com/notgautham/Aegis.git
cd Aegis
```

*(Optional)* If you need to reset the environment variables, you can copy the template:
```bash
cp .env.example .env
```

## 2. Deploy the Stack

Build and start all services in detached mode:

```bash
docker compose up -d --build
```

Docker will automatically:
- Build the OQS-enabled Python backend.
- Build the React/Vite frontend.
- Spin up PostgreSQL (with Apache AGE) and Qdrant.
- Apply all database migrations automatically on startup.

## 3. Access the Platform

Once the containers are running, you can access the services here:

- **Web Dashboard:** [http://localhost:3000](http://localhost:3000)
- **Backend API:** [http://localhost:8000](http://localhost:8000)
- **Interactive API Docs (Swagger):** [http://localhost:8000/docs](http://localhost:8000/docs)
- **PgAdmin (DB Management):** [http://localhost:5050](http://localhost:5050)

**Demo Login Credentials:**
- **Email:** `demo@aegis.bank`
- **Password:** `aegis2026`

---

## Common Operational Commands

**View System Logs:**
To monitor the scanning engine and backend events:
```bash
docker compose logs -f backend
```

To monitor the frontend UI logs:
```bash
docker compose logs -f frontend
```

**Run a Terminal Verification Scan:**
To verify the scanning engine is working without using the UI:
```bash
docker compose exec backend python simulation/run.py --target sc.com --skip-enumeration
```

**Stop the Platform:**
To safely shut down all containers without losing your scanned data:
```bash
docker compose down
```
