"""
Unit tests for the Phase 8 pipeline orchestrator.
"""

from __future__ import annotations

import uuid

import pytest
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from backend.core.config import get_settings
from backend.discovery.types import ValidatedHostname
from backend.models.enums import ScanStatus
from backend.models.scan_job import ScanJob
from backend.pipeline import ScanAlreadyRunningError, ScanAlreadyTerminalError, ScanReadService
from backend.repositories.scan_job_repo import ScanJobRepository
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


async def _create_scan(session_factory, *, target: str, status: ScanStatus = ScanStatus.PENDING) -> uuid.UUID:
    async with session_factory() as session:
        scan_job = ScanJob(target=target, status=status)
        session.add(scan_job)
        await session.flush()
        await session.commit()
        return scan_job.id


@pytest.mark.asyncio
async def test_happy_path_persists_tls_and_non_tls_assets(tmp_path, session_factory) -> None:
    hostname = f"phase8-{uuid.uuid4().hex[:8]}.example.com"
    ip_address = "198.51.100.10"
    orchestrator = build_phase8_orchestrator(
        session_factory=session_factory,
        tmp_path=tmp_path,
        validated_hostnames=[ValidatedHostname(hostname=hostname, ip_addresses=(ip_address,))],
        port_findings_by_ip={ip_address: [make_tls_port(ip_address), make_vpn_port(ip_address)]},
        tls_results_by_target={(hostname, ip_address, 443): build_tls_result(hostname=hostname, ip_address=ip_address)},
        enumerated_hostnames=[hostname],
    )
    scan_id = await _create_scan(session_factory, target=hostname)

    await orchestrator.run_scan(scan_id=scan_id, target=hostname)

    read_service = ScanReadService(session_factory=session_factory)
    status_payload = await read_service.get_scan_status(scan_id=scan_id)
    results_payload = await read_service.get_scan_results(scan_id=scan_id)

    assert status_payload["status"] is ScanStatus.COMPLETED
    assert status_payload["completed_at"] is not None
    assert status_payload["progress"] == {
        "assets_discovered": 2,
        "assessments_created": 1,
        "cboms_created": 1,
        "remediations_created": 1,
        "certificates_created": 1,
    }
    assert len(results_payload["assets"]) == 2
    assert any(asset["service_type"].value == "vpn" for asset in results_payload["assets"])
    tls_asset = next(asset for asset in results_payload["assets"] if asset["assessment"] is not None)
    assert tls_asset["assessment"]["risk_score"] == 84.5
    assert tls_asset["remediation"] is not None
    assert tls_asset["certificate"] is not None


@pytest.mark.asyncio
async def test_tier_one_scan_skips_remediation_and_still_issues_certificate(tmp_path, session_factory) -> None:
    hostname = f"phase8-{uuid.uuid4().hex[:8]}.example.com"
    ip_address = "198.51.100.20"
    orchestrator = build_phase8_orchestrator(
        session_factory=session_factory,
        tmp_path=tmp_path,
        validated_hostnames=[ValidatedHostname(hostname=hostname, ip_addresses=(ip_address,))],
        port_findings_by_ip={ip_address: [make_tls_port(ip_address)]},
        tls_results_by_target={
            (hostname, ip_address, 443): build_tls_result(
                hostname=hostname,
                ip_address=ip_address,
                tls_version="1.3",
                cipher_suite="TLS_AES_256_GCM_SHA384",
                metadata={"group_name": "ML-KEM-768", "auth_algorithm": "ML-DSA-65"},
            )
        },
        enumerated_hostnames=[hostname],
    )
    scan_id = await _create_scan(session_factory, target=hostname)

    await orchestrator.run_scan(scan_id=scan_id, target=hostname)

    payload = await ScanReadService(session_factory=session_factory).get_scan_results(scan_id=scan_id)
    tls_asset = payload["assets"][0]
    assert tls_asset["assessment"]["compliance_tier"].value == "FULLY_QUANTUM_SAFE"
    assert tls_asset["remediation"] is None
    assert tls_asset["certificate"] is not None


@pytest.mark.asyncio
@pytest.mark.parametrize("status", [ScanStatus.RUNNING, ScanStatus.COMPLETED, ScanStatus.FAILED])
async def test_duplicate_run_guard_rejects_running_and_terminal_scans(
    tmp_path,
    session_factory,
    status,
) -> None:
    hostname = f"phase8-{uuid.uuid4().hex[:8]}.example.com"
    orchestrator = build_phase8_orchestrator(
        session_factory=session_factory,
        tmp_path=tmp_path,
        validated_hostnames=[],
        port_findings_by_ip={},
        tls_results_by_target={},
    )
    scan_id = await _create_scan(session_factory, target=hostname, status=status)

    if status is ScanStatus.RUNNING:
        with pytest.raises(ScanAlreadyRunningError):
            await orchestrator.run_scan(scan_id=scan_id, target=hostname)
    else:
        with pytest.raises(ScanAlreadyTerminalError):
            await orchestrator.run_scan(scan_id=scan_id, target=hostname)


@pytest.mark.asyncio
async def test_per_asset_failure_isolated_while_other_assets_continue(tmp_path, session_factory) -> None:
    root_domain = f"phase8-{uuid.uuid4().hex[:8]}.example.com"
    good_hostname = f"good.{root_domain}"
    bad_hostname = f"bad.{root_domain}"
    validated = [
        ValidatedHostname(hostname=good_hostname, ip_addresses=("198.51.100.31",)),
        ValidatedHostname(hostname=bad_hostname, ip_addresses=("198.51.100.32",)),
    ]
    orchestrator = build_phase8_orchestrator(
        session_factory=session_factory,
        tmp_path=tmp_path,
        validated_hostnames=validated,
        port_findings_by_ip={
            "198.51.100.31": [make_tls_port("198.51.100.31")],
            "198.51.100.32": [make_tls_port("198.51.100.32")],
        },
        tls_results_by_target={
            (good_hostname, "198.51.100.31", 443): build_tls_result(
                hostname=good_hostname,
                ip_address="198.51.100.31",
            ),
            (bad_hostname, "198.51.100.32", 443): build_tls_result(
                hostname=bad_hostname,
                ip_address="198.51.100.32",
            ),
        },
        enumerated_hostnames=[good_hostname, bad_hostname],
    )

    delegate = orchestrator.certificate_signer

    class SelectiveFailSigner:
        async def issue_and_persist(self, *, certificate_request, compliance_certificate_repository):
            if certificate_request.asset.hostname == bad_hostname:
                raise RuntimeError("intentional signing failure")
            return await delegate.issue_and_persist(
                certificate_request=certificate_request,
                compliance_certificate_repository=compliance_certificate_repository,
            )

    orchestrator.certificate_signer = SelectiveFailSigner()
    scan_id = await _create_scan(session_factory, target=root_domain)

    await orchestrator.run_scan(scan_id=scan_id, target=root_domain)

    status_payload = await ScanReadService(session_factory=session_factory).get_scan_status(scan_id=scan_id)
    assert status_payload["status"] is ScanStatus.COMPLETED
    assert status_payload["progress"]["assets_discovered"] == 2
    assert status_payload["progress"]["assessments_created"] == 2
    assert status_payload["progress"]["cboms_created"] == 2
    assert status_payload["progress"]["certificates_created"] == 1


@pytest.mark.asyncio
async def test_outer_unexpected_exception_marks_scan_failed(tmp_path, session_factory) -> None:
    hostname = f"phase8-{uuid.uuid4().hex[:8]}.example.com"
    orchestrator = build_phase8_orchestrator(
        session_factory=session_factory,
        tmp_path=tmp_path,
        validated_hostnames=[],
        port_findings_by_ip={},
        tls_results_by_target={},
    )
    orchestrator.dns_validator = StubDNSValidator([], should_fail=True)
    scan_id = await _create_scan(session_factory, target=hostname)

    await orchestrator.run_scan(scan_id=scan_id, target=hostname)

    async with session_factory() as session:
        repository = ScanJobRepository(session)
        scan = await repository.get_by_id(scan_id)
        assert scan is not None
        assert scan.status is ScanStatus.FAILED
        assert scan.completed_at is not None
