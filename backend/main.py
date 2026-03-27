"""
Aegis — Quantum Cryptographic Intelligence Platform.

FastAPI application entry point with CORS middleware,
lifespan management, and health check endpoint.
"""

from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from backend.api.v1.router import api_router
from backend.core.config import get_settings
from backend.pipeline import PipelineOrchestrator, ScanNotFoundError, ScanReadService

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Application lifespan — startup and shutdown hooks."""
    # ── Startup ─────────────────────────────────────────
    # Database engine is created lazily on first query;
    # explicit table creation will be handled by Alembic migrations.
    app.state.scan_tasks = {}
    app.state.pipeline_orchestrator = PipelineOrchestrator()
    app.state.scan_read_service = ScanReadService()
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
app.state.scan_tasks = {}
app.state.pipeline_orchestrator = PipelineOrchestrator()
app.state.scan_read_service = ScanReadService()


def _error_payload(error_type: str, message: str) -> dict[str, dict[str, str]]:
    return {"error": {"type": error_type, "message": message}}


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content=_error_payload("http_error", str(exc.detail)),
    )


@app.exception_handler(RequestValidationError)
async def request_validation_handler(
    request: Request,
    exc: RequestValidationError,
) -> JSONResponse:
    return JSONResponse(
        status_code=422,
        content=_error_payload("validation_error", str(exc)),
    )


@app.exception_handler(ValueError)
async def value_error_handler(request: Request, exc: ValueError) -> JSONResponse:
    return JSONResponse(
        status_code=400,
        content=_error_payload("invalid_request", str(exc)),
    )


@app.exception_handler(ScanNotFoundError)
async def scan_not_found_handler(request: Request, exc: ScanNotFoundError) -> JSONResponse:
    return JSONResponse(
        status_code=404,
        content=_error_payload("not_found", str(exc)),
    )


@app.exception_handler(Exception)
async def unexpected_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    return JSONResponse(
        status_code=500,
        content=_error_payload("internal_error", "An unexpected server error occurred."),
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
