# Aegis Setup

This guide is intentionally brief and focused only on setup.

## Prerequisites

- Docker Desktop
- Git

## 1. Clone

```bash
git clone https://github.com/notgautham/Aegis.git
cd Aegis
```

## 2. Environment (Optional)

Root `.env` is already configured for local deterministic mode.

Optional: refresh it from template if needed.

```bash
cp .env.example .env
```

## 3. Start Services

```bash
docker compose up -d --build
```

## 4. Open the App

- Frontend: `http://localhost:3000`
- Backend API: `http://localhost:8000`
- Swagger: `http://localhost:8000/docs`

## 5. Optional Verification Scan

```bash
docker compose exec backend python simulation/run.py --target sc.com --skip-enumeration
```
