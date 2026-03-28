"""
Aegis API v1 Router.

Aggregates all v1 endpoint routers into a single router
that is mounted on the FastAPI application at /api/v1.
"""

from fastapi import APIRouter

from backend.api.v1.endpoints import assets, mission_control, scans

api_router = APIRouter()
api_router.include_router(mission_control.router)
api_router.include_router(scans.router)
api_router.include_router(assets.router)

# ── Future endpoint routers will be included here ──────
# Example:
# from backend.api.v1.endpoints import scans, assets
# api_router.include_router(scans.router, prefix="/scan", tags=["Scans"])
# api_router.include_router(assets.router, prefix="/assets", tags=["Assets"])
