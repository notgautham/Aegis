"""
Mission Control overview and lightweight scan history endpoints.
"""

from __future__ import annotations

from fastapi import APIRouter, Query, Request

from backend.api.v1.schemas import MissionControlOverviewResponse, ScanHistoryResponse

router = APIRouter(tags=["Mission Control"])


@router.get("/mission-control/overview", response_model=MissionControlOverviewResponse)
async def get_mission_control_overview(
    request: Request,
    recent_limit: int = Query(default=10, ge=1, le=25),
    priority_limit: int = Query(default=5, ge=1, le=10),
) -> MissionControlOverviewResponse:
    """Return the Mission Control aggregate payload across recent scans."""
    payload = await request.app.state.scan_read_service.get_mission_control_overview(
        recent_limit=recent_limit,
        priority_limit=priority_limit,
    )
    return MissionControlOverviewResponse(**payload)


@router.get("/scan/history", response_model=ScanHistoryResponse)
async def get_scan_history(
    request: Request,
    limit: int | None = Query(default=None, ge=1, le=5000),
    target: str | None = Query(default=None, min_length=1),
) -> ScanHistoryResponse:
    """Return a lightweight scan timeline, optionally filtered by exact target."""
    normalized_target = target.strip() if target is not None else None
    payload = await request.app.state.scan_read_service.get_scan_history(
        limit=limit,
        target=normalized_target or None,
    )
    return ScanHistoryResponse(**payload)
