"""
Aegis API v1 Router.

Aggregates all v1 endpoint routers into a single router
that is mounted on the FastAPI application at /api/v1.
"""

from fastapi import APIRouter

api_router = APIRouter()

# ── Future endpoint routers will be included here ──────
# Example:
# from backend.api.v1.endpoints import scans, assets
# api_router.include_router(scans.router, prefix="/scan", tags=["Scans"])
# api_router.include_router(assets.router, prefix="/assets", tags=["Assets"])
