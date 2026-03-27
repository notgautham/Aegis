"""
Phase 8 asset artifact endpoints.
"""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Request

from backend.api.v1.schemas import CbomResponse, CertificateResponse, RemediationResponse

router = APIRouter(tags=["Assets"])


@router.get("/assets/{asset_id}/cbom", response_model=CbomResponse)
async def get_asset_cbom(asset_id: uuid.UUID, request: Request) -> CbomResponse:
    """Return the latest persisted CBOM for one asset."""
    payload = await request.app.state.scan_read_service.get_latest_cbom(asset_id=asset_id)
    return CbomResponse(**payload)


@router.get("/assets/{asset_id}/certificate", response_model=CertificateResponse)
async def get_asset_certificate(asset_id: uuid.UUID, request: Request) -> CertificateResponse:
    """Return the latest persisted certificate for one asset."""
    payload = await request.app.state.scan_read_service.get_latest_certificate(asset_id=asset_id)
    return CertificateResponse(**payload)


@router.get("/assets/{asset_id}/remediation", response_model=RemediationResponse)
async def get_asset_remediation(asset_id: uuid.UUID, request: Request) -> RemediationResponse:
    """Return the latest persisted remediation bundle for one asset."""
    payload = await request.app.state.scan_read_service.get_latest_remediation(asset_id=asset_id)
    return RemediationResponse(**payload)
