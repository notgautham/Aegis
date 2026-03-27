"""
Phase 8 scan orchestration endpoints.
"""

from __future__ import annotations

import asyncio
import logging
import uuid

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from backend.api.v1.schemas import (
    ScanAcceptedResponse,
    ScanCreateRequest,
    ScanResultsResponse,
    ScanStatusResponse,
)
from backend.core.database import get_db
from backend.discovery import AuthorizedScope
from backend.models.enums import ScanStatus
from backend.repositories.scan_job_repo import ScanJobRepository

router = APIRouter(tags=["Scans"])
logger = logging.getLogger(__name__)


@router.post("/scan", response_model=ScanAcceptedResponse, status_code=status.HTTP_202_ACCEPTED)
async def create_scan(
    request: Request,
    payload: ScanCreateRequest,
    session: AsyncSession = Depends(get_db),
) -> ScanAcceptedResponse:
    """Create a persisted scan job and dispatch the background orchestrator."""
    try:
        AuthorizedScope.from_target(payload.target)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    repository = ScanJobRepository(session)
    scan_job = await repository.create(
        target=payload.target,
        status=ScanStatus.PENDING,
    )
    await session.commit()

    runtime_store = getattr(request.app.state, "scan_runtime_store", None)
    if runtime_store is not None:
        runtime_store.register_scan(
            scan_id=scan_job.id,
            target=scan_job.target,
            created_at=scan_job.created_at,
        )

    orchestrator = request.app.state.pipeline_orchestrator
    scan_task = asyncio.create_task(
        orchestrator.run_scan(scan_id=scan_job.id, target=scan_job.target)
    )
    request.app.state.scan_tasks[scan_job.id] = scan_task
    scan_task.add_done_callback(
        lambda completed_task, scan_id=scan_job.id: _cleanup_scan_task(
            request=request,
            scan_id=scan_id,
            task=completed_task,
        )
    )
    return ScanAcceptedResponse(
        scan_id=scan_job.id,
        target=scan_job.target,
        status=scan_job.status,
        created_at=scan_job.created_at,
    )


@router.get("/scan/{scan_id}", response_model=ScanStatusResponse)
async def get_scan_status(
    scan_id: uuid.UUID,
    request: Request,
) -> ScanStatusResponse:
    """Return current scan status and derived progress."""
    payload = await request.app.state.scan_read_service.get_scan_status(scan_id=scan_id)
    return ScanStatusResponse(**payload)


@router.get("/scan/{scan_id}/results", response_model=ScanResultsResponse)
async def get_scan_results(
    scan_id: uuid.UUID,
    request: Request,
) -> ScanResultsResponse:
    """Return the compiled read model for one scan."""
    payload = await request.app.state.scan_read_service.get_scan_results(scan_id=scan_id)
    return ScanResultsResponse(**payload)


def _cleanup_scan_task(*, request: Request, scan_id: uuid.UUID, task: asyncio.Task[None]) -> None:
    request.app.state.scan_tasks.pop(scan_id, None)
    try:
        task.result()
    except Exception:
        logger.exception("Background scan task failed for %s.", scan_id)
