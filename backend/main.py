"""
Aegis — Quantum Cryptographic Intelligence Platform.

FastAPI application entry point with CORS middleware,
lifespan management, and health check endpoint.
"""

from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.api.v1.router import api_router
from backend.core.config import get_settings

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Application lifespan — startup and shutdown hooks."""
    # ── Startup ─────────────────────────────────────────
    # Database engine is created lazily on first query;
    # explicit table creation will be handled by Alembic migrations.
    yield
    # ── Shutdown ────────────────────────────────────────
    from backend.core.database import engine

    await engine.dispose()


# ── Application Instance ───────────────────────────────
app = FastAPI(
    title=settings.PROJECT_NAME,
    description=(
        "Autonomous Cryptographic Intelligence Platform — "
        "discovers, inventories, evaluates, and certifies "
        "quantum-safe cryptographic posture for banking infrastructure."
    ),
    version="0.1.0",
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    lifespan=lifespan,
)

# ── CORS Middleware ─────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Tighten in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Mount API v1 ────────────────────────────────────────
app.include_router(api_router, prefix=settings.API_V1_STR)


# ── Health Check ────────────────────────────────────────
@app.get("/health", tags=["Infrastructure"])
async def health_check() -> dict[str, str]:
    """Basic health check endpoint."""
    return {"status": "ok"}
