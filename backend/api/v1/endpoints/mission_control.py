"""
Mission Control overview and lightweight scan history endpoints.
"""

from __future__ import annotations

import uuid
from typing import Any

from fastapi import APIRouter, Query, Request

from backend.api.v1.schemas import (
    MissionControlActivityResponse,
    MissionControlOverviewResponse,
    ScanHistoryResponse,
)

router = APIRouter(tags=["Mission Control"])

@router.get("/mission-control/graph")
async def get_network_graph(
    request: Request,
    scan_id: uuid.UUID | None = Query(default=None),
    limit: int = Query(default=150, ge=1, le=500),
) -> dict[str, list[Any]]:
    """Return graph nodes/edges derived from persisted scan assets."""
    payload = await request.app.state.scan_read_service.get_network_graph(
        scan_id=scan_id,
        limit=limit,
    )
    return payload


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


@router.get("/mission-control/activity", response_model=MissionControlActivityResponse)
async def get_mission_control_activity(
    request: Request,
    limit: int = Query(default=25, ge=1, le=100),
) -> MissionControlActivityResponse:
    """Return recent persisted scan activity for dashboard feeds."""
    payload = await request.app.state.scan_read_service.get_recent_activity(limit=limit)
    return MissionControlActivityResponse(**payload)


@router.get("/scan/history", response_model=ScanHistoryResponse)
async def get_scan_history(
    request: Request,
    limit: int | None = Query(default=200, ge=1, le=5000),
    target: str | None = Query(default=None, min_length=1),
) -> ScanHistoryResponse:
    """Return a lightweight scan timeline, optionally filtered by exact target."""
    normalized_target = target.strip() if target is not None else None
    payload = await request.app.state.scan_read_service.get_scan_history(
        limit=limit,
        target=normalized_target or None,
    )
    return ScanHistoryResponse(**payload)
