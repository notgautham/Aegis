"""
Integration tests for the Phase 8 API and background orchestration layer.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta

import httpx
import pytest
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from backend.core.config import get_settings
from backend.core.database import get_db
from backend.main import app
from backend.models.cbom_document import CbomDocument
from backend.models.compliance_certificate import ComplianceCertificate
from backend.models.discovered_asset import DiscoveredAsset
from backend.models.enums import ComplianceTier, ScanStatus, ServiceType
from backend.models.remediation_bundle import RemediationBundle
from backend.models.scan_job import ScanJob
from backend.pipeline import ScanReadService, ScanRuntimeStore
from backend.discovery.types import ValidatedHostname
from tests.unit._phase8_helpers import (
    StubDNSValidator,
    build_phase8_orchestrator,
    build_tls_result,
    make_tls_port,
    make_vpn_port,
)


@pytest.fixture
async def session_factory():
    engine = create_async_engine(get_settings().DATABASE_URL, echo=False, future=True)
    factory = async_sessionmaker(engine, expire_on_commit=False)
    try:
        yield factory
    finally:
        await engine.dispose()


async def _make_client(session_factory):
    async def override_get_db():
        async with session_factory() as session:
            try:
                yield session
                await session.commit()
            except Exception:
                await session.rollback()
                raise

    app.dependency_overrides[get_db] = override_get_db
    transport = httpx.ASGITransport(app=app)
    client = httpx.AsyncClient(transport=transport, base_url="http://test")
    return client


@pytest.mark.asyncio
async def test_scan_api_runs_stubbed_pipeline_and_exposes_artifacts(tmp_path, session_factory) -> None:
    hostname = f"phase8-{uuid.uuid4().hex[:8]}.example.com"
    ip_address = "198.51.100.41"
    runtime_store = ScanRuntimeStore()
    app.state.scan_tasks = {}
    app.state.scan_runtime_store = runtime_store
    app.state.pipeline_orchestrator = build_phase8_orchestrator(
        session_factory=session_factory,
        tmp_path=tmp_path,
        runtime_store=runtime_store,
        validated_hostnames=[],
        port_findings_by_ip={ip_address: [make_tls_port(ip_address), make_vpn_port(ip_address)]},
        tls_results_by_target={(hostname, ip_address, 443): build_tls_result(hostname=hostname, ip_address=ip_address)},
        enumerated_hostnames=[hostname],
    )
    app.state.pipeline_orchestrator.dns_validator = StubDNSValidator(
        records=[ValidatedHostname(hostname=hostname, ip_addresses=(ip_address,))]
    )
    app.state.scan_read_service = ScanReadService(
        session_factory=session_factory,
        runtime_store=runtime_store,
    )

    client = await _make_client(session_factory)
    try:
        response = await client.post("/api/v1/scan", json={"target": hostname})
        assert response.status_code == 202
        payload = response.json()
        scan_id = uuid.UUID(payload["scan_id"])

        task = app.state.scan_tasks.get(scan_id)
        if task is not None:
            await task
        assert scan_id not in app.state.scan_tasks

        status_response = await client.get(f"/api/v1/scan/{scan_id}")
        assert status_response.status_code == 200
        status_payload = status_response.json()
        assert status_payload["status"] == "completed"
        assert status_payload["stage"] == "completed"
        assert status_payload["summary"]["tls_assets"] == 1
        assert status_payload["summary"]["vulnerable_assets"] == 1
        assert status_payload["events"]
        assert status_payload["degraded_modes"]
        assert status_payload["progress"] == {
            "assets_discovered": 2,
            "assessments_created": 1,
            "cboms_created": 1,
            "remediations_created": 1,
            "certificates_created": 1,
        }

        results_response = await client.get(f"/api/v1/scan/{scan_id}/results")
        assert results_response.status_code == 200
        results_payload = results_response.json()
        assert len(results_payload["assets"]) == 2
        tls_asset = next(asset for asset in results_payload["assets"] if asset["assessment"] is not None)
        assert tls_asset["assessment"]["risk_score"] == 84.5

        cbom_response = await client.get(f"/api/v1/assets/{tls_asset['asset_id']}/cbom")
        certificate_response = await client.get(f"/api/v1/assets/{tls_asset['asset_id']}/certificate")
        remediation_response = await client.get(f"/api/v1/assets/{tls_asset['asset_id']}/remediation")

        assert cbom_response.status_code == 200
        assert certificate_response.status_code == 200
        assert remediation_response.status_code == 200
        assert "serial_number" in cbom_response.json()
        assert "certificate_pem" in certificate_response.json()
        assert "patch_config" in remediation_response.json()
    finally:
        await client.aclose()
        app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_latest_artifact_selection_is_deterministic_with_equal_timestamps(session_factory) -> None:
    scan_id = uuid.uuid4()
    asset_id = uuid.uuid4()
    created_at = datetime(2026, 3, 27, tzinfo=UTC)
    ids = sorted((uuid.uuid4(), uuid.uuid4()), key=str)
    earlier_id, later_id = ids[0], ids[1]

    async with session_factory() as session:
        session.add(ScanJob(id=scan_id, target="latest.example.com", status=ScanStatus.COMPLETED))
        session.add(
            DiscoveredAsset(
                id=asset_id,
                scan_id=scan_id,
                hostname="latest.example.com",
                ip_address="198.51.100.51",
                port=443,
                protocol="tcp",
                service_type=ServiceType.TLS,
                server_software="nginx",
            )
        )
        session.add_all(
            [
                CbomDocument(
                    id=earlier_id,
                    scan_id=scan_id,
                    asset_id=asset_id,
                    serial_number=f"urn:aegis:scan:20260327:latest.example.com:443:{earlier_id}",
                    cbom_json={"serial": "older"},
                    created_at=created_at,
                ),
                CbomDocument(
                    id=later_id,
                    scan_id=scan_id,
                    asset_id=asset_id,
                    serial_number=f"urn:aegis:scan:20260327:latest.example.com:443:{later_id}",
                    cbom_json={"serial": "newer"},
                    created_at=created_at,
                ),
                RemediationBundle(
                    id=earlier_id,
                    asset_id=asset_id,
                    hndl_timeline={"version": "older"},
                    patch_config="older",
                    migration_roadmap="older",
                    source_citations={"documents": []},
                    created_at=created_at,
                ),
                RemediationBundle(
                    id=later_id,
                    asset_id=asset_id,
                    hndl_timeline={"version": "newer"},
                    patch_config="newer",
                    migration_roadmap="newer",
                    source_citations={"documents": []},
                    created_at=created_at,
                ),
                ComplianceCertificate(
                    id=earlier_id,
                    asset_id=asset_id,
                    tier=ComplianceTier.FULLY_QUANTUM_SAFE,
                    certificate_pem="OLDER",
                    signing_algorithm="ECDSA",
                    valid_from=created_at,
                    valid_until=created_at + timedelta(days=30),
                    extensions_json={"version": "older"},
                ),
                ComplianceCertificate(
                    id=later_id,
                    asset_id=asset_id,
                    tier=ComplianceTier.FULLY_QUANTUM_SAFE,
                    certificate_pem="NEWER",
                    signing_algorithm="ECDSA",
                    valid_from=created_at,
                    valid_until=created_at + timedelta(days=30),
                    extensions_json={"version": "newer"},
                ),
            ]
        )
        await session.commit()

    app.state.scan_read_service = ScanReadService(
        session_factory=session_factory,
        runtime_store=ScanRuntimeStore(),
    )
    client = await _make_client(session_factory)
    try:
        cbom_response = await client.get(f"/api/v1/assets/{asset_id}/cbom")
        certificate_response = await client.get(f"/api/v1/assets/{asset_id}/certificate")
        remediation_response = await client.get(f"/api/v1/assets/{asset_id}/remediation")

        assert cbom_response.status_code == 200
        assert certificate_response.status_code == 200
        assert remediation_response.status_code == 200
        assert cbom_response.json()["id"] == str(later_id)
        assert certificate_response.json()["id"] == str(later_id)
        assert remediation_response.json()["id"] == str(later_id)
    finally:
        await client.aclose()
        app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_invalid_target_and_failure_cleanup_are_reported(tmp_path, session_factory) -> None:
    hostname = f"phase8-{uuid.uuid4().hex[:8]}.example.com"
    runtime_store = ScanRuntimeStore()
    app.state.scan_tasks = {}
    app.state.scan_runtime_store = runtime_store
    app.state.pipeline_orchestrator = build_phase8_orchestrator(
        session_factory=session_factory,
        tmp_path=tmp_path,
        runtime_store=runtime_store,
        validated_hostnames=[],
        port_findings_by_ip={},
        tls_results_by_target={},
    )
    app.state.pipeline_orchestrator.dns_validator = StubDNSValidator([], should_fail=True)
    app.state.scan_read_service = ScanReadService(
        session_factory=session_factory,
        runtime_store=runtime_store,
    )

    client = await _make_client(session_factory)
    try:
        bad_response = await client.post("/api/v1/scan", json={"target": ""})
        assert bad_response.status_code == 400
        assert bad_response.json()["error"]["type"] == "http_error"

        response = await client.post("/api/v1/scan", json={"target": hostname})
        assert response.status_code == 202
        scan_id = uuid.UUID(response.json()["scan_id"])
        task = app.state.scan_tasks.get(scan_id)
        if task is not None:
            await task
        assert scan_id not in app.state.scan_tasks

        status_response = await client.get(f"/api/v1/scan/{scan_id}")
        missing_response = await client.get(f"/api/v1/assets/{uuid.uuid4()}/certificate")

        assert status_response.status_code == 200
        assert status_response.json()["status"] == "failed"
        assert status_response.json()["stage"] == "failed"
        assert missing_response.status_code == 404
    finally:
        await client.aclose()
        app.dependency_overrides.clear()
