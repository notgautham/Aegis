"""
Phase 8 pipeline orchestration and compiled read models.
"""

from __future__ import annotations

import asyncio
import ipaddress
import json
import logging
import os
import re
import socket
import uuid
from collections import defaultdict
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen
from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import Any, Callable, Sequence

from qdrant_client import QdrantClient
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from backend.analysis import (
    CertificateAnalyzer,
    HandshakeMetadataResolutionError,
    calculate_risk_score,
    generate_score_explanation,
    parse_tls12_cipher_suite,
    resolve_tls13_handshake_metadata,
)
from backend.analysis.constants import canonicalize_algorithm, lookup_vulnerability
from backend.cbom import AssetCbomBundle, CycloneDxMapper
from backend.cert import CertificateRequest, CertificateSigner
from backend.compliance import ComplianceInput, RulesEngine
from backend.core.config import get_settings
from backend.core.database import async_session_factory
from backend.discovery import (
    AggregatedAsset,
    AmassEnumerator,
    AuthorizedScope,
    CertificateExtractor,
    DNSxValidator,
    PortFinding,
    PortScanner,
    TLSProbe,
    TLSProbeResult,
    TLSScanTarget,
    ValidatedHostname,
    VPNProbe,
    APIInspector,
    URLProbeTarget,
    aggregate_assets,
)
from backend.discovery.dns_enumerator import DNSEnumerationError
from backend.intelligence import (
    RagOrchestrator,
    RemediationInput,
    RetrievalService,
    create_embedding_provider,
)
from backend.models.asset_fingerprint import AssetFingerprint
from backend.models.crypto_assessment import CryptoAssessment
from backend.models.discovered_asset import DiscoveredAsset
from backend.models.certificate_chain import CertificateChain
from backend.models.dns_record import DNSRecord
from backend.models.enums import CertLevel, ComplianceTier, ScanStatus, ServiceType
from backend.models.scan_job import ScanJob
from backend.models.scan_event import ScanEvent
from backend.models.remediation_action import (
    RemediationAction,
    RemediationEffort,
    RemediationPriority,
    RemediationStatus,
)
from backend.repositories import (
    AssetFingerprintRepository,
    CbomDocumentRepository,
    CertificateChainRepository,
    ComplianceCertificateRepository,
    CryptoAssessmentRepository,
    DNSRecordRepository,
    DiscoveredAssetRepository,
    RemediationBundleRepository,
    ScanEventRepository,
    ScanJobRepository,
)

logger = logging.getLogger(__name__)
MAX_SCAN_RUNTIME_EVENTS = 60
COMMON_ENUMERATION_PREFIXES: tuple[str, ...] = (
    "www",
    "api",
    "auth",
    "login",
    "sso",
    "portal",
    "secure",
    "vpn",
    "mail",
    "smtp",
    "imap",
    "pop",
    "m",
    "mobile",
    "cdn",
    "static",
    "assets",
    "img",
    "media",
    "status",
    "support",
    "admin",
    "dev",
    "test",
    "staging",
    "beta",
)


class ScanNotFoundError(RuntimeError):
    """Raised when a requested scan cannot be found."""


class ScanAlreadyRunningError(RuntimeError):
    """Raised when the same scan is dispatched twice while still running."""


class ScanAlreadyTerminalError(RuntimeError):
    """Raised when a terminal scan is dispatched again."""


@dataclass(frozen=True, slots=True)
class _DiscoveryExecution:
    aggregated_assets: tuple[AggregatedAsset, ...]
    port_findings: tuple[PortFinding, ...]
    validated_hostnames: tuple[ValidatedHostname, ...]
    tls_results_by_key: dict[tuple[str | None, str, int, str, str], TLSProbeResult]


@dataclass(frozen=True, slots=True)
class _AssessmentInputs:
    tls_version: str | None
    cipher_suite: str | None
    kex_algorithm: str | None
    auth_algorithm: str | None
    enc_algorithm: str | None
    mac_algorithm: str | None
    kex_vulnerability: float | None
    sig_vulnerability: float | None
    sym_vulnerability: float | None
    tls_vulnerability: float | None
    risk_score: float | None
    score_explanation: dict[str, Any] | None


@dataclass(slots=True)
class ScanRuntimeEvent:
    timestamp: datetime
    kind: str
    message: str
    stage: str | None = None


@dataclass(slots=True)
class ScanRuntimeState:
    scan_id: uuid.UUID
    target: str
    created_at: datetime | None = None
    stage: str | None = None
    stage_detail: str | None = None
    stage_started_at: datetime | None = None
    degraded_modes: list[str] = field(default_factory=list)
    events: list[ScanRuntimeEvent] = field(default_factory=list)


class ScanRuntimeStore:
    """In-process telemetry for active and recently completed scans."""

    def __init__(self) -> None:
        self._states: dict[uuid.UUID, ScanRuntimeState] = {}

    def register_scan(
        self,
        *,
        scan_id: uuid.UUID,
        target: str,
        created_at: datetime | None = None,
    ) -> None:
        state = self._states.get(scan_id)
        is_new_state = state is None
        if state is None:
            state = ScanRuntimeState(scan_id=scan_id, target=target, created_at=created_at)
            self._states[scan_id] = state
        else:
            state.target = target
            state.created_at = created_at or state.created_at
        state.stage = "queued"
        state.stage_detail = target
        state.stage_started_at = datetime.now(UTC)

        if is_new_state or not state.events:
            self.add_event(
                scan_id,
                "Scan accepted and queued for execution.",
                kind="queued",
                stage="queued",
            )

    def set_stage(
        self,
        scan_id: uuid.UUID,
        *,
        stage: str,
        detail: str | None = None,
        message: str | None = None,
    ) -> None:
        state = self._states.get(scan_id)
        if state is None:
            return
        state.stage = stage
        state.stage_detail = detail
        state.stage_started_at = datetime.now(UTC)
        if message:
            self.add_event(scan_id, message, kind="stage", stage=stage)

    def add_event(
        self,
        scan_id: uuid.UUID,
        message: str,
        *,
        kind: str = "info",
        stage: str | None = None,
    ) -> None:
        state = self._states.get(scan_id)
        if state is None:
            return
        state.events.append(
            ScanRuntimeEvent(
                timestamp=datetime.now(UTC),
                kind=kind,
                message=message,
                stage=stage or state.stage,
            )
        )
        if len(state.events) > MAX_SCAN_RUNTIME_EVENTS:
            del state.events[:-MAX_SCAN_RUNTIME_EVENTS]

    def add_degraded_mode(self, scan_id: uuid.UUID, message: str) -> None:
        state = self._states.get(scan_id)
        if state is None:
            return
        if message not in state.degraded_modes:
            state.degraded_modes.append(message)
        self.add_event(scan_id, message, kind="degraded")

    def mark_terminal(
        self,
        scan_id: uuid.UUID,
        *,
        status: ScanStatus,
        message: str,
    ) -> None:
        self.set_stage(scan_id, stage=status.value, message=message)

    def get_snapshot(self, scan_id: uuid.UUID) -> ScanRuntimeState | None:
        return self._states.get(scan_id)


class PipelineOrchestrator:
    """Coordinate the end-to-end Aegis pipeline for one persisted scan job."""

    def __init__(
        self,
        *,
        session_factory: async_sessionmaker[AsyncSession] | None = None,
        runtime_store: ScanRuntimeStore | None = None,
        enumerator: AmassEnumerator | None = None,
        dns_validator: DNSxValidator | None = None,
        port_scanner: PortScanner | None = None,
        tls_probe: TLSProbe | None = None,
        certificate_extractor: CertificateExtractor | None = None,
        certificate_analyzer: CertificateAnalyzer | None = None,
        rules_engine: RulesEngine | None = None,
        cbom_mapper: CycloneDxMapper | None = None,
        rag_orchestrator: RagOrchestrator | None = None,
        certificate_signer: CertificateSigner | None = None,
    ) -> None:
        self.settings = get_settings()
        self.session_factory = session_factory or async_session_factory
        self.runtime_store = runtime_store
        self.enumerator = enumerator or AmassEnumerator()
        self.dns_validator = dns_validator or DNSxValidator()
        self.port_scanner = port_scanner or PortScanner()
        self.tls_probe = tls_probe or TLSProbe()
        self.vpn_probe = VPNProbe()
        self.api_inspector = APIInspector()
        self.certificate_extractor = certificate_extractor or CertificateExtractor()
        self.certificate_analyzer = certificate_analyzer or CertificateAnalyzer()
        self.rules_engine = rules_engine or RulesEngine()
        self.cbom_mapper = cbom_mapper or CycloneDxMapper()
        self.certificate_signer = certificate_signer or CertificateSigner()
        self.rag_orchestrator = rag_orchestrator or RagOrchestrator(
            retrieval_service=RetrievalService(
                client=QdrantClient(url=self.settings.QDRANT_URL),
                collection_name=self.settings.QDRANT_COLLECTION_NAME,
                embedding_provider=create_embedding_provider(self.settings),
                default_top_k=self.settings.RAG_TOP_K,
            )
        )
        self._ip_enrichment_cache: dict[str, dict[str, Any]] = {}
        self._domain_enrichment_cache: dict[str, dict[str, Any]] = {}
        self.tls_probe_concurrency = max(
            1,
            int(os.getenv("AEGIS_TLS_PROBE_CONCURRENCY", "50")),
        )
        self.port_scan_concurrency = max(
            1,
            int(os.getenv("AEGIS_PORT_SCAN_CONCURRENCY", "20")),
        )
        self.asset_processing_concurrency = max(
            1,
            int(os.getenv("AEGIS_ASSET_PROCESSING_CONCURRENCY", "24")),
        )

    async def run_scan(self, *, scan_id: uuid.UUID, target: str) -> None:
        """Run the full Phase 3-to-7 pipeline for one existing scan job."""
        terminal_status: ScanStatus | None = None
        terminal_timestamp: datetime | None = None
        scan_profile = await self._get_scan_profile(scan_id)
        full_port_scan_enabled = self._profile_requests_full_port_scan(scan_profile)
        skip_enumeration = self._resolve_skip_enumeration(scan_profile)

        try:
            if self.runtime_store is not None:
                self.runtime_store.register_scan(scan_id=scan_id, target=target)
                self.runtime_store.set_stage(
                    scan_id,
                    stage="preparing_scan",
                    detail=target,
                    message="Scan execution started.",
                )
            await self._transition_scan_to_running(scan_id)
            discovery = await self._run_discovery(
                target,
                scan_id=scan_id,
                full_port_scan_enabled=full_port_scan_enabled,
                skip_enumeration=skip_enumeration,
            )
            persisted_assets = await self._persist_discovered_assets(
                scan_id=scan_id,
                aggregated_assets=discovery.aggregated_assets,
                port_findings=discovery.port_findings,
                validated_hostnames=discovery.validated_hostnames,
            )
            if self.runtime_store is not None:
                self.runtime_store.add_event(
                    scan_id,
                    f"Persisted {len(persisted_assets)} discovered assets.",
                    kind="success",
                )

            await self._process_tls_assets_for_scan(
                scan_id=scan_id,
                persisted_assets=persisted_assets,
                tls_results_by_key=discovery.tls_results_by_key,
            )

            # Update Graph DB
            await self._update_network_graph(target, persisted_assets)

            terminal_status = ScanStatus.COMPLETED
            terminal_timestamp = datetime.now(UTC)
        except (ScanAlreadyRunningError, ScanAlreadyTerminalError):
            raise
        except Exception:
            logger.exception("Unrecoverable scan orchestration failure for %s.", scan_id)
            terminal_status = ScanStatus.FAILED
            terminal_timestamp = datetime.now(UTC)
            if self.runtime_store is not None:
                self.runtime_store.add_event(
                    scan_id,
                    "Scan orchestration failed before completion.",
                    kind="error",
                )
        finally:
            if terminal_status is not None and terminal_timestamp is not None:
                if self.runtime_store is not None:
                    terminal_message = (
                        "Scan completed and all terminal artifacts are available."
                        if terminal_status is ScanStatus.COMPLETED
                        else "Scan failed and entered a terminal state."
                    )
                    self.runtime_store.mark_terminal(
                        scan_id,
                        status=terminal_status,
                        message=terminal_message,
                    )
                await self._mark_scan_terminal(
                    scan_id=scan_id,
                    status=terminal_status,
                    completed_at=terminal_timestamp,
                )
                try:
                    if self.runtime_store is not None:
                        snapshot = self.runtime_store.get_snapshot(scan_id)
                        if snapshot and snapshot.events:
                            async with self.session_factory() as session:
                                repo = ScanEventRepository(session)
                                for event in snapshot.events:
                                    try:
                                        async with session.begin_nested():
                                            await repo.create(
                                                scan_id=scan_id,
                                                timestamp=event.timestamp,
                                                kind=event.kind,
                                                stage=event.stage,
                                                message=event.message,
                                            )
                                    except Exception:
                                        logger.exception(
                                            "Failed to persist scan event for scan %s.",
                                            scan_id,
                                        )
                                await session.commit()
                except Exception:
                    logger.exception(
                        "Failed to persist runtime events for scan %s.",
                        scan_id,
                    )

    async def _process_tls_assets_for_scan(
        self,
        *,
        scan_id: uuid.UUID,
        persisted_assets: Sequence[DiscoveredAsset],
        tls_results_by_key: dict[tuple[str | None, str, int, str, str], TLSProbeResult],
    ) -> None:
        semaphore = asyncio.Semaphore(self.asset_processing_concurrency)

        async def _run_asset(asset: DiscoveredAsset, tls_result: TLSProbeResult) -> None:
            async with semaphore:
                await self._process_tls_asset(
                    asset_id=asset.id,
                    tls_result=tls_result,
                    scan_id=scan_id,
                )

        tasks: list[asyncio.Task[None]] = []
        for asset in persisted_assets:
            if asset.service_type is not ServiceType.TLS:
                continue

            tls_result = tls_results_by_key.get(_artifact_key_from_asset(asset))
            if tls_result is None or not tls_result.cipher_suite or not tls_result.tls_version:
                continue

            tasks.append(asyncio.create_task(_run_asset(asset, tls_result)))

        if not tasks:
            return

        results = await asyncio.gather(*tasks, return_exceptions=True)
        for asset_task, result in zip(tasks, results, strict=True):
            if not isinstance(result, Exception):
                continue

            # Pull the asset label from the task name context when available.
            _ = asset_task
            if self.runtime_store is not None:
                self.runtime_store.add_event(
                    scan_id,
                    "Asset pipeline failed for one or more assets; continued with remaining assets.",
                    kind="error",
                )
            logger.exception(
                "Per-asset pipeline failure for scan %s.",
                scan_id,
                exc_info=result,
            )

    async def _update_network_graph(self, target: str, assets: Sequence[DiscoveredAsset]) -> None:
        try:
            async with self.session_factory() as session:
                await session.execute(text("LOAD 'age'"))
                await session.execute(text('SET search_path = ag_catalog, "$user", public'))

                query1 = f"SELECT * FROM cypher('aegis_network_graph', $$ MERGE (d:Domain {{name: '{target}'}}) $$) as (v agtype);"
                await session.execute(text(query1))

                for asset in assets:
                    if not asset.ip_address:
                        continue
                    ip = asset.ip_address
                    port = asset.port
                    service = asset.service_type.value if asset.service_type else "unknown"
                    hostname = asset.hostname or target

                    query2 = f"""
                        SELECT * FROM cypher('aegis_network_graph', $$
                            MATCH (d:Domain {{name: '{target}'}})
                            MERGE (h:Domain {{name: '{hostname}'}})
                            MERGE (i:IP {{address: '{ip}'}})
                            MERGE (p:Port {{number: '{port}', service: '{service}'}})
                            MERGE (d)-[\:SUBDOMAIN]->(h)
                            MERGE (h)-[\:RESOLVES_TO]->(i)
                            MERGE (i)-[\:EXPOSES]->(p)
                        $$) as (v agtype);
                    """
                    await session.execute(text(query2))

                await session.commit()
        except Exception:
            logger.exception("Failed to update network graph for %s.", target)

    def _set_runtime_stage(
        self,
        scan_id: uuid.UUID | None,
        *,
        stage: str,
        detail: str | None = None,
        message: str | None = None,
    ) -> None:
        if scan_id is None or self.runtime_store is None:
            return
        self.runtime_store.set_stage(
            scan_id,
            stage=stage,
            detail=detail,
            message=message,
        )

    def _add_runtime_event(
        self,
        scan_id: uuid.UUID | None,
        message: str,
        *,
        kind: str = "info",
        stage: str | None = None,
    ) -> None:
        if scan_id is None or self.runtime_store is None:
            return
        self.runtime_store.add_event(
            scan_id,
            message,
            kind=kind,
            stage=stage,
        )

    def _add_degraded_mode(self, scan_id: uuid.UUID | None, message: str) -> None:
        if scan_id is None or self.runtime_store is None:
            return
        self.runtime_store.add_degraded_mode(scan_id, message)

    async def _transition_scan_to_running(self, scan_id: uuid.UUID) -> None:
        async with self.session_factory() as session:
            repository = ScanJobRepository(session)
            scan_job = await repository.get_by_id(scan_id)
            if scan_job is None:
                raise ScanNotFoundError(f"Scan {scan_id} does not exist.")
            if scan_job.status is ScanStatus.RUNNING:
                raise ScanAlreadyRunningError(f"Scan {scan_id} is already running.")
            if scan_job.status in {ScanStatus.COMPLETED, ScanStatus.FAILED}:
                raise ScanAlreadyTerminalError(
                    f"Scan {scan_id} is already in terminal state {scan_job.status.value}."
                )

            await repository.update(
                scan_id,
                status=ScanStatus.RUNNING,
                completed_at=None,
            )
            await session.commit()

    async def _mark_scan_terminal(
        self,
        *,
        scan_id: uuid.UUID,
        status: ScanStatus,
        completed_at: datetime,
    ) -> None:
        async with self.session_factory() as session:
            repository = ScanJobRepository(session)
            scan_job = await repository.get_by_id(scan_id)
            if scan_job is None:
                return
            await repository.update(
                scan_id,
                status=status,
                completed_at=completed_at,
            )
            await session.commit()

    async def _get_scan_profile(self, scan_id: uuid.UUID) -> str | None:
        async with self.session_factory() as session:
            repository = ScanJobRepository(session)
            scan_job = await repository.get_by_id(scan_id)
            if scan_job is None:
                return None
            return scan_job.scan_profile

    @staticmethod
    def _profile_requests_full_port_scan(scan_profile: str | None) -> bool:
        if not scan_profile:
            return False

        normalized = scan_profile.lower()
        return (
            "full-port" in normalized
            or "full_port" in normalized
            or "full port" in normalized
            or "all-ports" in normalized
            or "all_ports" in normalized
            or "all ports" in normalized
        )

    def _resolve_skip_enumeration(self, scan_profile: str | None) -> bool:
        # Start from global setting and allow per-scan override.
        if not scan_profile:
            return self.settings.SKIP_ENUMERATION

        normalized = scan_profile.lower()
        if "full enumeration" in normalized or "enumeration enabled" in normalized:
            return False
        if "no enumeration" in normalized or "enumeration disabled" in normalized:
            return True
        return self.settings.SKIP_ENUMERATION

    @staticmethod
    def _augment_hostname_candidates(base_domain: str, hostnames: set[str]) -> int:
        before = len(hostnames)
        for prefix in COMMON_ENUMERATION_PREFIXES:
            hostnames.add(f"{prefix}.{base_domain}")
        return len(hostnames) - before

    async def _run_discovery(
        self,
        target: str,
        *,
        scan_id: uuid.UUID | None = None,
        full_port_scan_enabled: bool = False,
        skip_enumeration: bool = False,
    ) -> _DiscoveryExecution:
        scope = AuthorizedScope.from_target(target)
        supports_streaming_enumerator = callable(getattr(self.enumerator, "enumerate_stream", None))
        if scope.scope_type == "domain" and not skip_enumeration and supports_streaming_enumerator:
            return await self._run_discovery_streaming(
                target=target,
                scope=scope,
                scan_id=scan_id,
                full_port_scan_enabled=full_port_scan_enabled,
            )

        validated_hostnames = await self._resolve_hostnames(
            target,
            scope,
            scan_id=scan_id,
            skip_enumeration=skip_enumeration,
        )
        ip_addresses = self._collect_scan_ips(scope, validated_hostnames)
        self._add_runtime_event(
            scan_id,
            f"Prepared {len(ip_addresses)} address(es) for port scanning.",
            kind="info",
            stage="scanning_ports",
        )
        port_findings = await self._scan_ports(
            ip_addresses,
            scan_id=scan_id,
            full_port_scan_enabled=full_port_scan_enabled,
        )
        tls_results = await self._probe_tls_targets(
            scope=scope,
            validated_hostnames=validated_hostnames,
            port_findings=port_findings,
            scan_id=scan_id,
        )

        if len(port_findings) == 0:
            fallback_tls_results = await self._probe_tls_fallback_without_port_findings(
                scope=scope,
                validated_hostnames=validated_hostnames,
                ip_addresses=ip_addresses,
                scan_id=scan_id,
            )
            if fallback_tls_results:
                tls_results.extend(fallback_tls_results)

        # Call optional probes for VPN and API metadata
        vpn_results = []
        for pf in port_findings:
            if pf.service_type == ServiceType.VPN:
                vpn_results.append(self.vpn_probe.probe(pf.ip_address, pf.port, pf.protocol))

        api_tasks = []
        # Check all discovered web-like ports for JWT/mTLS
        for pf in port_findings:
            if pf.port in {80, 443, 8080, 8443}:
                scheme = "https" if pf.port in {443, 8443} else "http"
                target_url = f"{scheme}://{pf.ip_address}:{pf.port}"
                api_tasks.append(self.api_inspector.inspect(URLProbeTarget(url=target_url)))
        api_results = await asyncio.gather(*api_tasks) if api_tasks else []

        aggregated_assets = aggregate_assets(
            target,
            validated_hostnames,
            port_findings,
            tls_results,
            vpn_results,
            api_results,
        )
        self._add_runtime_event(
            scan_id,
            f"Discovery produced {len(aggregated_assets)} aggregated asset candidate(s).",
            kind="success",
            stage="persisting_assets",
        )
        return _DiscoveryExecution(
            aggregated_assets=tuple(aggregated_assets),
            port_findings=tuple(port_findings),
            validated_hostnames=tuple(validated_hostnames),
            tls_results_by_key={
                _artifact_key_from_tls_result(result): result for result in tls_results
            },
        )

    async def _run_discovery_streaming(
        self,
        *,
        target: str,
        scope: AuthorizedScope,
        scan_id: uuid.UUID | None,
        full_port_scan_enabled: bool,
    ) -> _DiscoveryExecution:
        hostnames: set[str] = {scope.domain} if scope.domain else set()
        if scope.domain:
            hostnames.add(f"www.{scope.domain}")
            self._augment_hostname_candidates(scope.domain, hostnames)

        validated_hostnames_stream: dict[str, ValidatedHostname] = {}
        ip_to_hostnames: dict[str, set[str]] = defaultdict(set)
        queued_ips: set[str] = set()
        port_findings: list[PortFinding] = []
        tls_results: list[TLSProbeResult] = []
        seen_port_keys: set[tuple[str, int, str]] = set()
        seen_tls_targets: set[tuple[str | None, str, int, str]] = set()

        tls_semaphore = asyncio.Semaphore(self.tls_probe_concurrency)
        port_semaphore = asyncio.Semaphore(self.port_scan_concurrency)
        lock = asyncio.Lock()
        tls_tasks: set[asyncio.Task[None]] = set()
        port_tasks: set[asyncio.Task[None]] = set()

        async def _probe_tls_target(target_item: TLSScanTarget) -> None:
            async with tls_semaphore:
                try:
                    result = await self.tls_probe.probe(target_item)
                except Exception:
                    logger.exception(
                        "TLS probing failed for %s:%s.",
                        target_item.server_name,
                        target_item.port,
                    )
                    self._add_runtime_event(
                        scan_id,
                        f"TLS probing failed for {target_item.server_name}; continuing with remaining endpoints.",
                        kind="error",
                        stage="probing_tls",
                    )
                    return

            async with lock:
                tls_results.append(result)

        def _schedule_tls_target(target_item: TLSScanTarget) -> None:
            target_key = (
                target_item.hostname,
                target_item.ip_address,
                target_item.port,
                target_item.protocol,
            )
            if target_key in seen_tls_targets:
                return
            seen_tls_targets.add(target_key)
            task = asyncio.create_task(_probe_tls_target(target_item))
            tls_tasks.add(task)
            task.add_done_callback(tls_tasks.discard)

        async def _scan_ip(ip_address: str) -> None:
            async with port_semaphore:
                try:
                    findings = await self._scan_host_with_profile(
                        ip_address,
                        full_port_scan_enabled,
                    )
                except Exception:
                    logger.exception("Port scan failed for %s.", ip_address)
                    self._add_runtime_event(
                        scan_id,
                        f"Port scan failed for {ip_address}; continuing with remaining addresses.",
                        kind="error",
                        stage="scanning_ports",
                    )
                    return

            async with lock:
                known_hostnames = sorted(ip_to_hostnames.get(ip_address, set()))
                for finding in findings:
                    finding_key = (finding.ip_address, finding.port, finding.protocol)
                    if finding_key in seen_port_keys:
                        continue
                    seen_port_keys.add(finding_key)
                    port_findings.append(finding)
                    if finding.service_type is not ServiceType.TLS:
                        continue

                    if known_hostnames:
                        for hostname in known_hostnames:
                            _schedule_tls_target(
                                TLSScanTarget(
                                    hostname=hostname,
                                    ip_address=finding.ip_address,
                                    port=finding.port,
                                    protocol=finding.protocol,
                                )
                            )
                    else:
                        _schedule_tls_target(
                            TLSScanTarget(
                                hostname=None,
                                ip_address=finding.ip_address,
                                port=finding.port,
                                protocol=finding.protocol,
                            )
                        )

        async def _resolve_hostname_streaming(hostname: str, source: str) -> None:
            normalized_hostname = hostname.strip().lower().rstrip(".")
            if not normalized_hostname or not scope.contains(hostname=normalized_hostname):
                return

            try:
                resolved = await asyncio.to_thread(socket.getaddrinfo, normalized_hostname, None)
            except socket.gaierror:
                return

            ip_addresses = tuple(
                sorted({info[4][0] for info in resolved if info and len(info) >= 5 and info[4]})
            )
            if not ip_addresses:
                return

            async with lock:
                validated_hostnames_stream[normalized_hostname] = ValidatedHostname(
                    hostname=normalized_hostname,
                    ip_addresses=ip_addresses,
                    source=source,
                )
                for ip_address in ip_addresses:
                    ip_to_hostnames[ip_address].add(normalized_hostname)
                    if ip_address in queued_ips:
                        continue
                    queued_ips.add(ip_address)
                    scan_task = asyncio.create_task(_scan_ip(ip_address))
                    port_tasks.add(scan_task)
                    scan_task.add_done_callback(port_tasks.discard)

                    self._add_runtime_event(
                        scan_id,
                        f"Discovered {normalized_hostname} -> {ip_address}; queued port scan.",
                        kind="info",
                        stage="scanning_ports",
                    )

                # If this hostname arrived after ports were already found, immediately queue SNI probes.
                for finding in port_findings:
                    if (
                        finding.ip_address not in ip_addresses
                        or finding.service_type is not ServiceType.TLS
                    ):
                        continue
                    _schedule_tls_target(
                        TLSScanTarget(
                            hostname=normalized_hostname,
                            ip_address=finding.ip_address,
                            port=finding.port,
                            protocol=finding.protocol,
                        )
                    )

        self._set_runtime_stage(
            scan_id,
            stage="enumerating_domains",
            detail=target,
            message=f"Enumerating hostnames for {target} with streaming pipeline.",
        )

        hostname_tasks = [
            asyncio.create_task(_resolve_hostname_streaming(candidate, "seed"))
            for candidate in sorted(hostnames)
        ]

        try:
            async for record in self.enumerator.enumerate_stream(target):
                normalized = record.hostname.strip().lower().rstrip(".")
                if not normalized or normalized in hostnames:
                    continue
                hostnames.add(normalized)
                hostname_tasks.append(
                    asyncio.create_task(_resolve_hostname_streaming(normalized, record.source))
                )
        except DNSEnumerationError as exc:
            logger.warning(
                "Domain enumeration unavailable for %s; continuing with streaming seeds. Reason: %s",
                target,
                exc,
            )
            self._add_degraded_mode(
                scan_id,
                f"Domain enumeration unavailable for {target}; continued with deterministic seeds.",
            )
        except Exception:
            logger.exception(
                "Domain enumeration failed for %s; continuing with streaming seeds.",
                target,
            )
            self._add_degraded_mode(
                scan_id,
                f"Domain enumeration failed for {target}; continued with deterministic seeds.",
            )

        if hostname_tasks:
            await asyncio.gather(*hostname_tasks, return_exceptions=True)
        if port_tasks:
            await asyncio.gather(*list(port_tasks), return_exceptions=True)
        if tls_tasks:
            await asyncio.gather(*list(tls_tasks), return_exceptions=True)

        self._set_runtime_stage(
            scan_id,
            stage="validating_dns",
            detail=f"{len(hostnames)} hostname(s)",
            message="Validating DNS resolution for discovered hostnames.",
        )
        validated_hostnames = await self.dns_validator.validate(hostnames)

        if scan_id is not None and validated_hostnames:
            try:
                async with self.session_factory() as session:
                    dns_record_repository = DNSRecordRepository(session)
                    for validated_hostname in validated_hostnames:
                        try:
                            async with session.begin_nested():
                                await dns_record_repository.create(
                                    scan_id=scan_id,
                                    hostname=validated_hostname.hostname,
                                    resolved_ips=list(validated_hostname.ip_addresses),
                                    cnames=list(validated_hostname.cnames),
                                    discovery_source=validated_hostname.source,
                                    is_in_scope=True,
                                )
                        except Exception:
                            logger.exception(
                                "Failed to persist DNS record for scan %s hostname %s.",
                                scan_id,
                                validated_hostname.hostname,
                            )
                    await session.commit()
            except Exception:
                logger.exception(
                    "Failed to persist DNS records for scan %s.",
                    scan_id,
                )

        ip_addresses = sorted(
            {ip for validated in validated_hostnames for ip in validated.ip_addresses}
            | set(queued_ips)
        )

        if len(port_findings) == 0:
            fallback_tls_results = await self._probe_tls_fallback_without_port_findings(
                scope=scope,
                validated_hostnames=validated_hostnames,
                ip_addresses=ip_addresses,
                scan_id=scan_id,
            )
            if fallback_tls_results:
                tls_results.extend(fallback_tls_results)

        vpn_results = []
        for pf in port_findings:
            if pf.service_type == ServiceType.VPN:
                vpn_results.append(self.vpn_probe.probe(pf.ip_address, pf.port, pf.protocol))

        api_tasks = []
        for pf in port_findings:
            if pf.port in {80, 443, 8080, 8443}:
                scheme = "https" if pf.port in {443, 8443} else "http"
                target_url = f"{scheme}://{pf.ip_address}:{pf.port}"
                api_tasks.append(self.api_inspector.inspect(URLProbeTarget(url=target_url)))
        api_results = await asyncio.gather(*api_tasks) if api_tasks else []

        aggregated_assets = aggregate_assets(
            target,
            validated_hostnames,
            port_findings,
            tls_results,
            vpn_results,
            api_results,
        )

        self._add_runtime_event(
            scan_id,
            f"Discovery produced {len(aggregated_assets)} aggregated asset candidate(s).",
            kind="success",
            stage="persisting_assets",
        )
        return _DiscoveryExecution(
            aggregated_assets=tuple(aggregated_assets),
            port_findings=tuple(port_findings),
            validated_hostnames=tuple(validated_hostnames),
            tls_results_by_key={
                _artifact_key_from_tls_result(result): result for result in tls_results
            },
        )

    async def _resolve_hostnames(
        self,
        target: str,
        scope: AuthorizedScope,
        *,
        scan_id: uuid.UUID | None = None,
        skip_enumeration: bool = False,
    ) -> list[ValidatedHostname]:
        if scope.scope_type != "domain" or scope.domain is None:
            self._add_runtime_event(
                scan_id,
                "Target scope does not require domain enumeration; continuing with direct address handling.",
                kind="info",
                stage="validating_dns",
            )
            return []

        hostnames = {scope.domain}
        www_candidate = f"www.{scope.domain}"
        hostnames.add(www_candidate)
        if skip_enumeration:
            self._add_runtime_event(
                scan_id,
                (
                    "Domain enumeration skipped via configuration; "
                    f"using root and www candidate hostnames: {target}, {www_candidate}"
                ),
                kind="info",
                stage="enumerating_domains",
            )
        else:
            self._set_runtime_stage(
                scan_id,
                stage="enumerating_domains",
                detail=target,
                message=f"Enumerating hostnames for {target}.",
            )
            try:
                enumerated = await self.enumerator.enumerate(target)
                hostnames.update(record.hostname for record in enumerated)
                self._add_runtime_event(
                    scan_id,
                    f"Enumeration completed with {len(hostnames)} hostname candidate(s).",
                    kind="success",
                    stage="enumerating_domains",
                )
            except DNSEnumerationError as exc:
                logger.warning(
                    "Domain enumeration unavailable for %s; continuing with root target only. Reason: %s",
                    target,
                    exc,
                )
                self._add_degraded_mode(
                    scan_id,
                    f"Domain enumeration unavailable for {target}; continued with the root target only.",
                )
            except Exception:
                logger.exception(
                    "Domain enumeration failed for %s; continuing with root target only.",
                    target,
                )
                self._add_degraded_mode(
                    scan_id,
                    f"Domain enumeration failed for {target}; continued with the root target only.",
                )

            heuristic_additions = self._augment_hostname_candidates(scope.domain, hostnames)
            if heuristic_additions > 0:
                self._add_runtime_event(
                    scan_id,
                    (
                        "Expanded enumeration scope with "
                        f"{heuristic_additions} deterministic hostname candidates."
                    ),
                    kind="info",
                    stage="enumerating_domains",
                )

        self._set_runtime_stage(
            scan_id,
            stage="validating_dns",
            detail=f"{len(hostnames)} hostname(s)",
            message="Validating DNS resolution for discovered hostnames.",
        )
        validated = await self.dns_validator.validate(hostnames)
        if scan_id is not None and validated:
            try:
                async with self.session_factory() as session:
                    dns_record_repository = DNSRecordRepository(session)
                    for validated_hostname in validated:
                        try:
                            async with session.begin_nested():
                                await dns_record_repository.create(
                                    scan_id=scan_id,
                                    hostname=validated_hostname.hostname,
                                    resolved_ips=list(validated_hostname.ip_addresses),
                                    cnames=list(validated_hostname.cnames),
                                    discovery_source=validated_hostname.source,
                                    is_in_scope=True,
                                )
                        except Exception:
                            logger.exception(
                                "Failed to persist DNS record for scan %s hostname %s.",
                                scan_id,
                                validated_hostname.hostname,
                            )
                    await session.commit()
            except Exception:
                logger.exception(
                    "Failed to persist DNS records for scan %s.",
                    scan_id,
                )
        self._add_runtime_event(
            scan_id,
            f"DNS validation retained {len(validated)} hostname(s) in scope.",
            kind="success",
            stage="validating_dns",
        )
        return validated

    @staticmethod
    def _collect_scan_ips(
        scope: AuthorizedScope,
        validated_hostnames: Sequence[ValidatedHostname],
    ) -> list[str]:
        if scope.scope_type == "domain":
            return sorted(
                {
                    ip_address
                    for validated in validated_hostnames
                    for ip_address in validated.ip_addresses
                }
            )
        if scope.scope_type == "ip" and scope.ip_address is not None:
            return [str(scope.ip_address)]
        if scope.scope_type == "network" and scope.network is not None:
            return [str(ip_address) for ip_address in scope.network.hosts()]
        return []

    async def _scan_ports(
        self,
        ip_addresses: Sequence[str],
        *,
        scan_id: uuid.UUID | None = None,
        full_port_scan_enabled: bool = False,
    ) -> list[PortFinding]:
        findings: list[PortFinding] = []
        if not ip_addresses:
            self._add_runtime_event(
                scan_id,
                "No IP addresses were available for port scanning.",
                kind="info",
                stage="scanning_ports",
            )
            return findings

        stage_message = (
            "Running full TCP scan across all ports (1-65535) and bounded UDP discovery."
            if full_port_scan_enabled
            else "Running bounded TCP/UDP discovery across in-scope addresses."
        )

        self._set_runtime_stage(
            scan_id,
            stage="scanning_ports",
            detail=f"{len(ip_addresses)} address(es)",
            message=stage_message,
        )

        semaphore = asyncio.Semaphore(self.port_scan_concurrency)

        async def _scan_with_limit(ip_address: str) -> list[PortFinding]:
            async with semaphore:
                return await self._scan_host_with_profile(ip_address, full_port_scan_enabled)

        scan_results = await asyncio.gather(
            *(_scan_with_limit(ip_address) for ip_address in ip_addresses),
            return_exceptions=True,
        )
        for ip_address, result in zip(ip_addresses, scan_results, strict=True):
            if isinstance(result, Exception):
                logger.exception("Port scan failed for %s.", ip_address, exc_info=result)
                self._add_runtime_event(
                    scan_id,
                    f"Port scan failed for {ip_address}; continuing with remaining addresses.",
                    kind="error",
                    stage="scanning_ports",
                )
                continue
            findings.extend(result)
        self._add_runtime_event(
            scan_id,
            f"Port scanning completed with {len(findings)} open service finding(s).",
            kind="success",
            stage="scanning_ports",
        )
        return findings

    async def _scan_host_with_profile(
        self,
        ip_address: str,
        full_port_scan_enabled: bool,
    ) -> list[PortFinding]:
        """Call scanner with backward compatibility for older stub signatures."""
        try:
            return await self.port_scanner.scan_host(
                ip_address,
                full_tcp_scan=full_port_scan_enabled,
            )
        except TypeError:
            return await self.port_scanner.scan_host(ip_address)

    async def _probe_tls_targets(
        self,
        *,
        scope: AuthorizedScope,
        validated_hostnames: Sequence[ValidatedHostname],
        port_findings: Sequence[PortFinding],
        scan_id: uuid.UUID | None = None,
    ) -> list[TLSProbeResult]:
        ip_to_hostnames = self._build_ip_hostname_index(scope, validated_hostnames)
        tls_targets: list[TLSScanTarget] = []

        for finding in port_findings:
            if finding.service_type is not ServiceType.TLS:
                continue

            hostnames = sorted(ip_to_hostnames.get(finding.ip_address, set()))
            if hostnames:
                tls_targets.extend(
                    TLSScanTarget(
                        hostname=hostname,
                        ip_address=finding.ip_address,
                        port=finding.port,
                        protocol=finding.protocol,
                    )
                    for hostname in hostnames
                )
            else:
                tls_targets.append(
                    TLSScanTarget(
                        hostname=None,
                        ip_address=finding.ip_address,
                        port=finding.port,
                        protocol=finding.protocol,
                    )
                )

        self._set_runtime_stage(
            scan_id,
            stage="probing_tls",
            detail=f"{len(tls_targets)} TLS endpoint(s)",
            message="Negotiating TLS handshakes and retrieving certificate chains.",
        )
        semaphore = asyncio.Semaphore(self.tls_probe_concurrency)

        async def _probe_with_limit(target: TLSScanTarget) -> TLSProbeResult:
            async with semaphore:
                return await self.tls_probe.probe(target)

        results = await asyncio.gather(
            *(_probe_with_limit(target) for target in tls_targets),
            return_exceptions=True,
        )
        tls_results: list[TLSProbeResult] = []
        for tls_target, result in zip(tls_targets, results, strict=True):
            if isinstance(result, Exception):
                logger.exception(
                    "TLS probing failed for %s:%s.",
                    tls_target.server_name,
                    tls_target.port,
                    exc_info=result,
                )
                self._add_runtime_event(
                    scan_id,
                    f"TLS probing failed for {tls_target.server_name}; continuing with remaining endpoints.",
                    kind="error",
                    stage="probing_tls",
                )
                continue
            tls_results.append(result)
        self._add_runtime_event(
            scan_id,
            f"TLS probing completed with {len(tls_results)} successful handshake result(s).",
            kind="success",
            stage="probing_tls",
        )
        return tls_results

    async def _probe_tls_fallback_without_port_findings(
        self,
        *,
        scope: AuthorizedScope,
        validated_hostnames: Sequence[ValidatedHostname],
        ip_addresses: Sequence[str],
        scan_id: uuid.UUID | None = None,
    ) -> list[TLSProbeResult]:
        """
        Fallback TLS probing path for environments where nmap reports zero open ports.

        This attempts direct TLS handshakes to common HTTPS ports using hostname+SNI.
        """
        common_tls_ports = (443, 8443)
        targets: list[TLSScanTarget] = []
        seen: set[tuple[str | None, str, int]] = set()

        for validated in validated_hostnames:
            normalized_hostname = validated.hostname.strip().lower().rstrip(".")
            if not scope.contains(hostname=normalized_hostname):
                continue
            for ip_address in validated.ip_addresses:
                for port in common_tls_ports:
                    key = (normalized_hostname, ip_address, port)
                    if key in seen:
                        continue
                    seen.add(key)
                    targets.append(
                        TLSScanTarget(
                            hostname=normalized_hostname,
                            ip_address=ip_address,
                            port=port,
                            protocol="tcp",
                        )
                    )

        if not targets and scope.scope_type in {"ip", "network"}:
            for ip_address in ip_addresses:
                for port in common_tls_ports:
                    key = (None, ip_address, port)
                    if key in seen:
                        continue
                    seen.add(key)
                    targets.append(
                        TLSScanTarget(
                            hostname=None,
                            ip_address=ip_address,
                            port=port,
                            protocol="tcp",
                        )
                    )

        if not targets:
            return []

        self._add_runtime_event(
            scan_id,
            (
                "Port scanning yielded 0 open findings; "
                "attempting direct TLS fallback on common HTTPS ports (443, 8443)."
            ),
            kind="degraded",
            stage="probing_tls",
        )

        semaphore = asyncio.Semaphore(self.tls_probe_concurrency)

        async def _probe_with_limit(target: TLSScanTarget) -> TLSProbeResult:
            async with semaphore:
                return await self.tls_probe.probe(target)

        results = await asyncio.gather(
            *(_probe_with_limit(target) for target in targets),
            return_exceptions=True,
        )

        tls_results: list[TLSProbeResult] = []
        for target, result in zip(targets, results, strict=True):
            if isinstance(result, Exception):
                continue
            if not result.cipher_suite or not result.tls_version:
                continue
            tls_results.append(result)

        if tls_results:
            self._add_runtime_event(
                scan_id,
                (
                    "TLS fallback recovered "
                    f"{len(tls_results)} successful handshake result(s) after empty port-scan output."
                ),
                kind="success",
                stage="probing_tls",
            )

        return tls_results

    @staticmethod
    def _build_ip_hostname_index(
        scope: AuthorizedScope,
        validated_hostnames: Sequence[ValidatedHostname],
    ) -> dict[str, set[str]]:
        ip_to_hostnames: dict[str, set[str]] = {}
        for validated in validated_hostnames:
            hostname = validated.hostname.strip().lower().rstrip(".")
            if not scope.contains(hostname=hostname):
                continue
            for ip_address in validated.ip_addresses:
                if scope.scope_type in {"ip", "network"} and not scope.contains(
                    ip_address=ip_address
                ):
                    continue
                ip_to_hostnames.setdefault(ip_address, set()).add(hostname)
        return ip_to_hostnames

    async def _persist_discovered_assets(
        self,
        *,
        scan_id: uuid.UUID,
        aggregated_assets: Sequence[AggregatedAsset],
        port_findings: Sequence[PortFinding] = (),
        validated_hostnames: Sequence[ValidatedHostname] = (),
    ) -> list[DiscoveredAsset]:
        self._set_runtime_stage(
            scan_id,
            stage="persisting_assets",
            detail=f"{len(aggregated_assets)} asset(s)",
            message="Persisting discovered assets and service identities.",
        )
        async with self.session_factory() as session:
            repository = DiscoveredAssetRepository(session)
            persisted_assets: list[DiscoveredAsset] = []
            for asset in aggregated_assets:
                normalized_asset_hostname = (
                    asset.hostname.strip().lower().rstrip(".") if asset.hostname else None
                )
                open_ports = [
                    {
                        "port": port_finding.port,
                        "protocol": port_finding.protocol,
                        "service_name": port_finding.service_name,
                        "state": port_finding.state,
                    }
                    for port_finding in port_findings
                    if port_finding.ip_address == asset.ip_address
                ]
                persisted_assets.append(
                    await repository.create(
                        scan_id=scan_id,
                        hostname=asset.hostname,
                        ip_address=asset.ip_address,
                        port=asset.port,
                        protocol=asset.protocol,
                        service_type=asset.service_type,
                        server_software=asset.server_software,
                        open_ports=open_ports,
                        asset_metadata=await self._build_asset_metadata(asset),
                        discovery_source=(
                            "dnsx"
                            if normalized_asset_hostname is not None
                            and any(
                                validated_hostname.hostname.strip().lower().rstrip(".")
                                == normalized_asset_hostname
                                for validated_hostname in validated_hostnames
                            )
                            else "nmap"
                        ),
                        is_shadow_it=False,
                    )
                )
            await session.commit()
            return persisted_assets

    async def _build_asset_metadata(self, asset: AggregatedAsset) -> dict[str, Any] | None:
        metadata = dict(asset.metadata) if asset.metadata else {}
        metadata["service_type"] = asset.service_type.value

        network_enrichment = await self._enrich_ip(asset.ip_address)
        if network_enrichment:
            metadata["network_enrichment"] = network_enrichment

        if asset.hostname:
            domain_enrichment = await self._enrich_domain(asset.hostname)
            if domain_enrichment:
                metadata["domain_enrichment"] = domain_enrichment

        return metadata or None

    async def _enrich_ip(self, ip_address: str) -> dict[str, Any]:
        normalized = ip_address.strip()
        if normalized in self._ip_enrichment_cache:
            return self._ip_enrichment_cache[normalized]

        enrichment: dict[str, Any] = {}
        try:
            parsed_ip = ipaddress.ip_address(normalized)
            if isinstance(parsed_ip, ipaddress.IPv4Address):
                enrichment["subnet"] = str(ipaddress.ip_network(f"{normalized}/24", strict=False))
            else:
                enrichment["subnet"] = str(ipaddress.ip_network(f"{normalized}/64", strict=False))
        except ValueError:
            enrichment["subnet"] = None

        reverse_dns = await asyncio.to_thread(self._safe_reverse_dns, normalized)
        if reverse_dns:
            enrichment["reverse_dns"] = reverse_dns

        asn_payload = await asyncio.to_thread(self._lookup_asn_cymru, normalized)
        if asn_payload:
            enrichment.update(asn_payload)

        if not enrichment.get("city") or not enrichment.get("country"):
            geo_payload = await asyncio.to_thread(self._lookup_ip_geolocation, normalized)
            if geo_payload:
                for key, value in geo_payload.items():
                    if value and not enrichment.get(key):
                        enrichment[key] = value

        self._ip_enrichment_cache[normalized] = enrichment
        return enrichment

    async def _enrich_domain(self, hostname: str) -> dict[str, Any]:
        normalized = hostname.strip().lower().rstrip(".")
        if normalized in self._domain_enrichment_cache:
            return self._domain_enrichment_cache[normalized]

        labels = normalized.split(".")
        root_domain = ".".join(labels[-2:]) if len(labels) >= 2 else normalized
        payload = {
            "hostname": normalized,
            "root_domain": root_domain,
            "registrar": None,
            "registration_date": None,
            "expiry_date": None,
            "nameservers": [],
        }
        rdap_enrichment = await asyncio.to_thread(self._lookup_domain_rdap, root_domain)
        if rdap_enrichment:
            payload.update(rdap_enrichment)
        self._domain_enrichment_cache[normalized] = payload
        return payload

    def _lookup_domain_rdap(self, domain: str) -> dict[str, Any] | None:
        endpoints = (
            f"https://rdap.org/domain/{domain}",
            f"https://rdap-bootstrap.arin.net/bootstrap/domain/{domain}",
        )
        headers = {
            "Accept": "application/rdap+json, application/json",
            "User-Agent": "Aegis-RDAP/1.0",
        }

        for url in endpoints:
            try:
                request = Request(url, headers=headers)
                with urlopen(request, timeout=3.5) as response:
                    if response.status >= 400:
                        continue
                    body = response.read().decode("utf-8", errors="ignore")
                rdap = json.loads(body)
            except (TimeoutError, URLError, HTTPError, json.JSONDecodeError):
                continue
            except Exception:
                continue

            parsed = self._parse_rdap_payload(rdap)
            if parsed:
                return parsed

        return None

    def _parse_rdap_payload(self, payload: dict[str, Any]) -> dict[str, Any]:
        registration_date: str | None = None
        expiry_date: str | None = None
        registrar: str | None = None
        nameservers: list[str] = []

        for event in payload.get("events", []):
            if not isinstance(event, dict):
                continue
            action = str(event.get("eventAction", "")).strip().lower()
            event_date = self._normalize_rdap_date(event.get("eventDate"))
            if event_date is None:
                continue
            if registration_date is None and action in {"registration", "created"}:
                registration_date = event_date
            if expiry_date is None and action in {"expiration", "expiry", "expired"}:
                expiry_date = event_date

        entities = payload.get("entities", [])
        if isinstance(entities, list):
            for entity in entities:
                if not isinstance(entity, dict):
                    continue
                roles = entity.get("roles", [])
                if not isinstance(roles, list):
                    continue
                normalized_roles = {str(role).strip().lower() for role in roles}
                if "registrar" in normalized_roles:
                    registrar = self._extract_rdap_entity_name(entity)
                    if registrar:
                        break

        raw_nameservers = payload.get("nameservers", [])
        if isinstance(raw_nameservers, list):
            for entry in raw_nameservers:
                if not isinstance(entry, dict):
                    continue
                candidate = entry.get("ldhName") or entry.get("unicodeName")
                if isinstance(candidate, str) and candidate.strip():
                    nameservers.append(candidate.strip().lower())

        if not registration_date and not expiry_date and not registrar and not nameservers:
            return {}

        return {
            "registrar": registrar,
            "registration_date": registration_date,
            "expiry_date": expiry_date,
            "nameservers": sorted(set(nameservers)),
        }

    @staticmethod
    def _extract_rdap_entity_name(entity: dict[str, Any]) -> str | None:
        vcard_array = entity.get("vcardArray")
        if (
            not isinstance(vcard_array, list)
            or len(vcard_array) != 2
            or not isinstance(vcard_array[1], list)
        ):
            return None

        for vcard_field in vcard_array[1]:
            if (
                not isinstance(vcard_field, list)
                or len(vcard_field) < 4
                or str(vcard_field[0]).strip().lower() != "fn"
            ):
                continue
            value = vcard_field[3]
            if isinstance(value, str) and value.strip():
                return value.strip()

        return None

    @staticmethod
    def _normalize_rdap_date(value: Any) -> str | None:
        if not isinstance(value, str) or not value.strip():
            return None

        normalized = value.strip()
        if normalized.endswith("Z"):
            normalized = normalized[:-1] + "+00:00"
        try:
            return datetime.fromisoformat(normalized).date().isoformat()
        except ValueError:
            return None

    @staticmethod
    def _safe_reverse_dns(ip_address: str) -> str | None:
        try:
            host, _, _ = socket.gethostbyaddr(ip_address)
            return host.rstrip(".").lower()
        except Exception:
            return None

    @staticmethod
    def _lookup_asn_cymru(ip_address: str) -> dict[str, Any] | None:
        query = f"begin\nverbose\n{ip_address}\nend\n".encode("utf-8")
        try:
            with socket.create_connection(("whois.cymru.com", 43), timeout=2.5) as sock:
                sock.sendall(query)
                response = sock.recv(8192).decode("utf-8", errors="ignore")
        except Exception:
            return None

        lines = [line.strip() for line in response.splitlines() if line.strip()]
        if len(lines) < 2:
            return None

        # Expected pipe-separated format:
        # AS | IP | BGP Prefix | CC | Registry | Allocated | AS Name
        parts = [part.strip() for part in lines[-1].split("|")]
        if len(parts) < 7:
            return None

        asn = parts[0] if parts[0] and parts[0].isdigit() else None
        as_name = parts[6] or None
        return {
            "asn": f"AS{asn}" if asn else None,
            "netname": as_name,
            "isp": as_name,
            "city": None,
            "country": None,
        }

    @staticmethod
    def _lookup_ip_geolocation(ip_address: str) -> dict[str, Any] | None:
        endpoint = f"https://ipapi.co/{ip_address}/json/"
        request = Request(
            endpoint,
            headers={
                "Accept": "application/json",
                "User-Agent": "Aegis-IP-Enrichment/1.0",
            },
        )
        try:
            with urlopen(request, timeout=2.5) as response:
                if response.status >= 400:
                    return None
                payload = json.loads(response.read().decode("utf-8", errors="ignore"))
        except (TimeoutError, URLError, HTTPError, json.JSONDecodeError):
            return None
        except Exception:
            return None

        if not isinstance(payload, dict):
            return None

        return {
            "city": payload.get("city") or None,
            "country": payload.get("country_name") or None,
            "asn": payload.get("asn") or None,
            "isp": payload.get("org") or None,
        }

    async def _process_tls_asset(
        self,
        *,
        asset_id: uuid.UUID,
        tls_result: TLSProbeResult,
        scan_id: uuid.UUID | None = None,
    ) -> None:
        async with self.session_factory() as session:
            asset_repository = DiscoveredAssetRepository(session)
            certificate_repository = CertificateChainRepository(session)
            assessment_repository = CryptoAssessmentRepository(session)
            cbom_repository = CbomDocumentRepository(session)
            remediation_repository = RemediationBundleRepository(session)
            certificate_store = ComplianceCertificateRepository(session)
            fingerprint_repo = AssetFingerprintRepository(session)

            asset = await asset_repository.get_by_id(asset_id)
            if asset is None:
                raise ScanNotFoundError(f"Asset {asset_id} does not exist.")
            asset_label = f"{asset.hostname or asset.ip_address}:{asset.port}"
            self._set_runtime_stage(
                scan_id,
                stage="assessing_tls_assets",
                detail=asset_label,
                message=f"Analyzing TLS posture for {asset_label}.",
            )

            tls_result = await self._ensure_certificate_chain(
                asset_label=asset_label,
                tls_result=tls_result,
                scan_id=scan_id,
            )
            extracted_certificates = self.certificate_extractor.extract(tls_result)
            analyzed_certificates = self.certificate_analyzer.analyze(extracted_certificates)
            persisted_certificates = []

            for extracted, analyzed in zip(
                extracted_certificates, analyzed_certificates, strict=True
            ):
                persisted_certificates.append(
                    await certificate_repository.create(
                        asset_id=asset.id,
                        cert_level=extracted.cert_level,
                        subject=extracted.subject,
                        issuer=extracted.issuer,
                        public_key_algorithm=extracted.public_key_algorithm,
                        key_size_bits=extracted.key_size_bits,
                        signature_algorithm=extracted.signature_algorithm,
                        quantum_safe=analyzed.quantum_safe,
                        not_before=extracted.not_before,
                        not_after=extracted.not_after,
                    )
                )

            assessment_inputs = self._build_assessment_inputs(
                tls_result=tls_result,
                analyzed_certificates=analyzed_certificates,
            )
            evaluation = self.rules_engine.evaluate(
                ComplianceInput(
                    kex_algorithm=assessment_inputs.kex_algorithm,
                    auth_algorithm=assessment_inputs.auth_algorithm,
                    enc_algorithm=assessment_inputs.enc_algorithm,
                    risk_score=assessment_inputs.risk_score,
                )
            )
            self._add_runtime_event(
                scan_id,
                f"{asset_label} classified as {evaluation.tier.value}.",
                kind="success",
                stage="assessing_tls_assets",
            )
            assessment = await assessment_repository.create(
                asset_id=asset.id,
                tls_version=assessment_inputs.tls_version,
                cipher_suite=assessment_inputs.cipher_suite,
                kex_algorithm=assessment_inputs.kex_algorithm,
                auth_algorithm=assessment_inputs.auth_algorithm,
                enc_algorithm=assessment_inputs.enc_algorithm,
                mac_algorithm=assessment_inputs.mac_algorithm,
                kex_vulnerability=assessment_inputs.kex_vulnerability,
                sig_vulnerability=assessment_inputs.sig_vulnerability,
                sym_vulnerability=assessment_inputs.sym_vulnerability,
                tls_vulnerability=assessment_inputs.tls_vulnerability,
                risk_score=assessment_inputs.risk_score,
                score_explanation=assessment_inputs.score_explanation,
            )
            try:
                async with session.begin_nested():
                    canonical_key = build_asset_fingerprint_key(asset)
                    if canonical_key is None:
                        raise ValueError(
                            f"Cannot derive canonical fingerprint key for asset {asset.id}."
                        )
                    q_score = round(100 - (assessment_inputs.risk_score or 50))
                    now = datetime.now(UTC)
                    score_snapshot = {
                        "scan_id": str(scan_id),
                        "q_score": q_score,
                        "scanned_at": now.isoformat(),
                    }
                    existing = await fingerprint_repo.get_by_canonical_key(canonical_key)
                    if existing:
                        new_history = list(existing.q_score_history or []) + [score_snapshot]
                        await fingerprint_repo.update(
                            existing.id,
                            last_seen_scan_id=scan_id,
                            last_seen_at=now,
                            appearance_count=existing.appearance_count + 1,
                            q_score_history=new_history,
                            latest_q_score=q_score,
                            latest_compliance_tier=evaluation.tier,
                        )
                    else:
                        await fingerprint_repo.create(
                            canonical_key=canonical_key,
                            first_seen_scan_id=scan_id,
                            last_seen_scan_id=scan_id,
                            first_seen_at=now,
                            last_seen_at=now,
                            appearance_count=1,
                            q_score_history=[score_snapshot],
                            latest_q_score=q_score,
                            latest_compliance_tier=evaluation.tier,
                        )
            except Exception:
                logger.exception(
                    "Failed to persist asset fingerprint for asset %s.",
                    asset.id,
                )

            cbom_document = await self.cbom_mapper.persist_cbom(
                bundle=AssetCbomBundle(
                    asset=asset,
                    assessment=assessment,
                    certificates=persisted_certificates,
                    compliance=evaluation,
                ),
                cbom_repository=cbom_repository,
            )

            remediation_bundle = None
            if evaluation.tier is not ComplianceTier.FULLY_QUANTUM_SAFE:
                self._set_runtime_stage(
                    scan_id,
                    stage="generating_remediation",
                    detail=asset_label,
                    message=f"Generating remediation guidance for {asset_label}.",
                )
                try:
                    remediation_bundle = await self.rag_orchestrator.generate_and_persist(
                        remediation_input=RemediationInput(
                            asset=asset,
                            assessment=assessment,
                            cbom_document=cbom_document,
                            compliance_tier=evaluation.tier,
                        ),
                        remediation_repository=remediation_repository,
                        certificates=persisted_certificates,
                    )
                    if remediation_bundle is not None:
                        remediation_actions: list[dict[str, Any]] = []
                        if (
                            assessment_inputs.kex_vulnerability is not None
                            and assessment_inputs.kex_vulnerability >= 1.0
                        ):
                            remediation_actions.append(
                                {
                                    "priority": RemediationPriority.P1,
                                    "finding": (
                                        "Quantum-vulnerable key exchange: "
                                        f"{assessment_inputs.kex_algorithm}"
                                    ),
                                    "action": "Replace with X25519MLKEM768 hybrid or pure ML-KEM-768",
                                    "effort": RemediationEffort.HIGH,
                                    "category": "key_exchange",
                                }
                            )
                        if (
                            assessment_inputs.sig_vulnerability is not None
                            and assessment_inputs.sig_vulnerability >= 1.0
                        ):
                            remediation_actions.append(
                                {
                                    "priority": RemediationPriority.P1,
                                    "finding": (
                                        "Quantum-vulnerable signature algorithm: "
                                        f"{assessment_inputs.auth_algorithm}"
                                    ),
                                    "action": "Migrate certificate to ML-DSA-65",
                                    "effort": RemediationEffort.HIGH,
                                    "category": "certificate",
                                }
                            )
                        if (
                            assessment_inputs.tls_vulnerability is not None
                            and assessment_inputs.tls_vulnerability >= 0.4
                            and assessment_inputs.tls_version is not None
                            and "1.3" not in assessment_inputs.tls_version
                        ):
                            remediation_actions.append(
                                {
                                    "priority": RemediationPriority.P2,
                                    "finding": f"Legacy TLS version: {assessment_inputs.tls_version}",
                                    "action": "Enforce TLS 1.3 only",
                                    "effort": RemediationEffort.LOW,
                                    "category": "tls_version",
                                }
                            )
                        if (
                            assessment_inputs.sym_vulnerability is not None
                            and assessment_inputs.sym_vulnerability >= 0.5
                        ):
                            remediation_actions.append(
                                {
                                    "priority": RemediationPriority.P3,
                                    "finding": "Symmetric cipher has reduced post-quantum security",
                                    "action": "Prefer AES-256-GCM or ChaCha20-Poly1305",
                                    "effort": RemediationEffort.LOW,
                                    "category": "cipher_strength",
                                }
                            )
                        for remediation_action in remediation_actions:
                            try:
                                async with session.begin_nested():
                                    session.add(
                                        RemediationAction(
                                            asset_id=asset.id,
                                            remediation_bundle_id=remediation_bundle.id,
                                            priority=remediation_action["priority"].value,
                                            finding=remediation_action["finding"],
                                            action=remediation_action["action"],
                                            effort=remediation_action["effort"].value,
                                            status=RemediationStatus.NOT_STARTED.value,
                                            category=remediation_action["category"],
                                        )
                                    )
                                    await session.flush()
                            except Exception:
                                logger.exception(
                                    "Failed to persist remediation action for asset %s.",
                                    asset.id,
                                )
                        self._add_runtime_event(
                            scan_id,
                            f"Generated remediation artifacts for {asset_label}.",
                            kind="success",
                            stage="generating_remediation",
                        )
                        # Enrich CBOM with HNDL info
                        hndl = remediation_bundle.hndl_timeline
                        if hndl:
                            urgency = hndl.get("urgency")
                            entries = hndl.get("entries", [])
                            break_year = min((e["breakYear"] for e in entries), default=None)

                            updated_json = dict(cbom_document.cbom_json)
                            updated_json["quantumRiskSummary"]["hndlUrgency"] = urgency
                            updated_json["quantumRiskSummary"]["estimatedBreakYear"] = break_year

                            await cbom_repository.update(cbom_document.id, cbom_json=updated_json)
                except Exception:
                    logger.exception(
                        "Remediation generation failed for asset %s (%s:%s).",
                        asset.id,
                        asset.hostname or asset.ip_address,
                        asset.port,
                    )
                    self._add_runtime_event(
                        scan_id,
                        f"Remediation generation failed for {asset_label}; certificate issuance will continue if possible.",
                        kind="error",
                        stage="generating_remediation",
                    )
            else:
                self._add_runtime_event(
                    scan_id,
                    f"{asset_label} is fully quantum safe; remediation was skipped.",
                    kind="info",
                    stage="assessing_tls_assets",
                )

            await session.commit()

            self._set_runtime_stage(
                scan_id,
                stage="issuing_certificates",
                detail=asset_label,
                message=f"Issuing compliance certificate for {asset_label}.",
            )
            certificate_record = await self.certificate_signer.issue_and_persist(
                certificate_request=CertificateRequest(
                    asset=asset,
                    assessment=assessment,
                    remediation_bundle=remediation_bundle,
                ),
                compliance_certificate_repository=certificate_store,
            )
            if certificate_record.signing_algorithm != "ML-DSA-65":
                self._add_degraded_mode(
                    scan_id,
                    f"{asset_label} used {certificate_record.signing_algorithm} certificate signing fallback.",
                )
            self._add_runtime_event(
                scan_id,
                f"Issued {certificate_record.signing_algorithm} compliance certificate for {asset_label}.",
                kind="success",
                stage="issuing_certificates",
            )

            await session.commit()

    async def _ensure_certificate_chain(
        self,
        *,
        asset_label: str,
        tls_result: TLSProbeResult,
        scan_id: uuid.UUID | None = None,
    ) -> TLSProbeResult:
        """Recover a PEM certificate chain when the initial probe returned none."""
        if tls_result.certificate_chain_pem:
            return tls_result

        recovered_chain = await self._recover_certificate_chain_with_showcerts(tls_result)
        if not recovered_chain:
            self._add_degraded_mode(
                scan_id,
                f"No certificate chain could be recovered for {asset_label}; certificate-chain persistence was skipped.",
            )
            return tls_result

        self._add_runtime_event(
            scan_id,
            f"Recovered {len(recovered_chain)} certificate(s) for {asset_label} using showcerts fallback.",
            kind="success",
            stage="assessing_tls_assets",
        )
        return TLSProbeResult(
            hostname=tls_result.hostname,
            ip_address=tls_result.ip_address,
            port=tls_result.port,
            protocol=tls_result.protocol,
            tls_version=tls_result.tls_version,
            cipher_suite=tls_result.cipher_suite,
            certificate_chain_pem=recovered_chain,
            server_software=tls_result.server_software,
            metadata=dict(tls_result.metadata),
        )

    async def _recover_certificate_chain_with_showcerts(
        self,
        tls_result: TLSProbeResult,
    ) -> tuple[str, ...]:
        """Use openssl s_client -showcerts as a fallback chain source."""
        command = [
            "/usr/local/bin/openssl-oqs",
            "s_client",
            "-connect",
            f"{tls_result.ip_address}:{tls_result.port}",
            "-showcerts",
        ]
        if tls_result.hostname:
            command.extend(["-servername", tls_result.hostname])

        env = os.environ.copy()
        env["OPENSSL_CONF"] = "/opt/openssl/ssl/openssl.cnf"

        try:
            process = await asyncio.create_subprocess_exec(
                *command,
                stdin=asyncio.subprocess.PIPE,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                env=env,
            )
            stdout, stderr = await asyncio.wait_for(
                process.communicate(input=b"\n"),
                timeout=self.tls_probe.timeout_seconds,
            )
        except Exception:
            logger.exception(
                "Certificate-chain fallback probe failed for %s:%s.",
                tls_result.hostname or tls_result.ip_address,
                tls_result.port,
            )
            return ()

        output = b"".join((stdout or b"", stderr or b"")).decode("utf-8", errors="ignore")
        pem_blocks = re.findall(
            r"-----BEGIN CERTIFICATE-----.*?-----END CERTIFICATE-----",
            output,
            flags=re.DOTALL,
        )
        return tuple(f"{block.strip()}\n" for block in pem_blocks)

    def _build_assessment_inputs(
        self,
        *,
        tls_result: TLSProbeResult,
        analyzed_certificates: Sequence[Any],
    ) -> _AssessmentInputs:
        if not tls_result.cipher_suite:
            # HANDSHAKE FAILURE CASE: Return max risk 100.0
            risk = calculate_risk_score(
                kex_vulnerability=1.0,
                sig_vulnerability=1.0,
                sym_vulnerability=1.0,
                tls_vulnerability=1.0,
            )
            score_explanation = generate_score_explanation(
                kex_vulnerability=1.0,
                sig_vulnerability=1.0,
                sym_vulnerability=1.0,
                tls_vulnerability=1.0,
                kex_algorithm="UNKNOWN",
                auth_algorithm="UNKNOWN",
                enc_algorithm="UNKNOWN",
                tls_version="Handshake Failed",
                risk_score=100.0,
            )
            return _AssessmentInputs(
                tls_version="Handshake Failed",
                cipher_suite="BROKEN",
                kex_algorithm="UNKNOWN",
                auth_algorithm="UNKNOWN",
                enc_algorithm="UNKNOWN",
                mac_algorithm="UNKNOWN",
                kex_vulnerability=1.0,
                sig_vulnerability=1.0,
                sym_vulnerability=1.0,
                tls_vulnerability=1.0,
                risk_score=100.0,
                score_explanation=score_explanation,
            )

        tls_version = tls_result.tls_version
        if tls_version and "1.3" in tls_version:
            return self._build_tls13_assessment_inputs(
                tls_result=tls_result,
                analyzed_certificates=analyzed_certificates,
            )

        parsed = parse_tls12_cipher_suite(tls_result.cipher_suite)
        metadata = dict(tls_result.metadata)
        metadata_kex = self._first_non_unknown(
            metadata.get("kex_algorithm"),
            metadata.get("negotiated_group"),
            metadata.get("group_name"),
            metadata.get("key_exchange"),
            metadata.get("curve_name"),
        )
        resolved_kex_algorithm = parsed.kex_algorithm
        if self._is_unknown_token(resolved_kex_algorithm) and metadata_kex is not None:
            resolved_kex_algorithm = canonicalize_algorithm("kex", str(metadata_kex))

        risk = calculate_risk_score(
            kex_vulnerability=self._safe_lookup_vulnerability("kex", resolved_kex_algorithm),
            sig_vulnerability=parsed.sig_vulnerability,
            sym_vulnerability=parsed.sym_vulnerability,
            tls_version=tls_result.tls_version,
        )
        score_explanation = generate_score_explanation(
            kex_vulnerability=risk.kex_vulnerability,
            sig_vulnerability=parsed.sig_vulnerability,
            sym_vulnerability=parsed.sym_vulnerability,
            tls_vulnerability=risk.tls_vulnerability,
            kex_algorithm=resolved_kex_algorithm,
            auth_algorithm=parsed.auth_algorithm,
            enc_algorithm=parsed.enc_algorithm,
            tls_version=tls_result.tls_version,
            risk_score=risk.score,
        )
        return _AssessmentInputs(
            tls_version=tls_result.tls_version,
            cipher_suite=tls_result.cipher_suite,
            kex_algorithm=resolved_kex_algorithm,
            auth_algorithm=parsed.auth_algorithm,
            enc_algorithm=parsed.enc_algorithm,
            mac_algorithm=parsed.mac_algorithm,
            kex_vulnerability=risk.kex_vulnerability,
            sig_vulnerability=parsed.sig_vulnerability,
            sym_vulnerability=parsed.sym_vulnerability,
            tls_vulnerability=risk.tls_vulnerability,
            risk_score=risk.score,
            score_explanation=score_explanation,
        )

    def _build_tls13_assessment_inputs(
        self,
        *,
        tls_result: TLSProbeResult,
        analyzed_certificates: Sequence[Any],
    ) -> _AssessmentInputs:
        leaf_certificate = next(
            (
                certificate
                for certificate in analyzed_certificates
                if certificate.cert_level is CertLevel.LEAF
            ),
            analyzed_certificates[0] if analyzed_certificates else None,
        )
        metadata = dict(tls_result.metadata)
        metadata.setdefault("tls_version", tls_result.tls_version)
        if leaf_certificate is not None:
            metadata.setdefault(
                "certificate",
                {
                    "public_key_algorithm": leaf_certificate.public_key_algorithm,
                    "signature_algorithm": leaf_certificate.signature_algorithm,
                },
            )

        try:
            resolved = resolve_tls13_handshake_metadata(metadata)
            kex_algorithm = resolved.kex_algorithm
            auth_algorithm = resolved.auth_algorithm
            if self._is_unknown_token(kex_algorithm) or self._is_unknown_token(auth_algorithm):
                raise HandshakeMetadataResolutionError(
                    "Resolved TLS 1.3 metadata contains unusable UNKNOWN values."
                )
        except HandshakeMetadataResolutionError:
            auth_algorithm = canonicalize_algorithm(
                "sig",
                getattr(leaf_certificate, "public_key_algorithm", None)
                or getattr(leaf_certificate, "signature_algorithm", None),
            )
            group_name = self._first_non_unknown(
                metadata.get("kex_algorithm"),
                metadata.get("negotiated_group"),
                metadata.get("group_name"),
                metadata.get("key_exchange"),
                metadata.get("curve_name"),
                "X25519",
            )
            kex_algorithm = canonicalize_algorithm("kex", str(group_name))

        enc_algorithm, mac_algorithm = self._parse_tls13_cipher_suite(tls_result.cipher_suite or "")
        kex_vulnerability = self._safe_lookup_vulnerability("kex", kex_algorithm)
        sig_vulnerability = self._safe_lookup_vulnerability("sig", auth_algorithm)
        sym_vulnerability = self._safe_lookup_vulnerability("sym", enc_algorithm)
        risk = calculate_risk_score(
            kex_vulnerability=kex_vulnerability,
            sig_vulnerability=sig_vulnerability,
            sym_vulnerability=sym_vulnerability,
            tls_version=tls_result.tls_version,
        )
        score_explanation = generate_score_explanation(
            kex_vulnerability=kex_vulnerability,
            sig_vulnerability=sig_vulnerability,
            sym_vulnerability=sym_vulnerability,
            tls_vulnerability=risk.tls_vulnerability,
            kex_algorithm=kex_algorithm,
            auth_algorithm=auth_algorithm,
            enc_algorithm=enc_algorithm,
            tls_version=tls_result.tls_version,
            risk_score=risk.score,
        )
        return _AssessmentInputs(
            tls_version=tls_result.tls_version,
            cipher_suite=tls_result.cipher_suite,
            kex_algorithm=kex_algorithm,
            auth_algorithm=auth_algorithm,
            enc_algorithm=enc_algorithm,
            mac_algorithm=mac_algorithm,
            kex_vulnerability=kex_vulnerability,
            sig_vulnerability=sig_vulnerability,
            sym_vulnerability=sym_vulnerability,
            tls_vulnerability=risk.tls_vulnerability,
            risk_score=risk.score,
            score_explanation=score_explanation,
        )

    @staticmethod
    def _parse_tls13_cipher_suite(cipher_suite: str) -> tuple[str | None, str | None]:
        normalized = cipher_suite.strip().upper()
        if not normalized.startswith("TLS_"):
            return None, None
        tokens = [token for token in normalized[4:].split("_") if token]
        if len(tokens) < 2:
            return None, None
        return "_".join(tokens[:-1]), tokens[-1]

    @staticmethod
    def _safe_lookup_vulnerability(category: str, algorithm: str | None) -> float:
        if algorithm is None:
            return 1.0
        try:
            return lookup_vulnerability(category, algorithm)
        except KeyError:
            return 1.0

    @staticmethod
    def _is_unknown_token(value: str | None) -> bool:
        if value is None:
            return True
        normalized = str(value).strip().upper()
        return normalized in {"", "UNKNOWN", "N/A", "NONE", "NULL"}

    @classmethod
    def _first_non_unknown(cls, *candidates: object) -> str | None:
        for candidate in candidates:
            if candidate is None:
                continue
            as_text = str(candidate).strip()
            if cls._is_unknown_token(as_text):
                continue
            return as_text
        return None


class ScanReadService:
    """Read-side helpers for scan status, compiled results, and artifact retrieval."""

    def __init__(
        self,
        *,
        session_factory: async_sessionmaker[AsyncSession] | None = None,
        runtime_store: ScanRuntimeStore | None = None,
    ) -> None:
        self.session_factory = session_factory or async_session_factory
        self.runtime_store = runtime_store

    async def get_scan_status(self, *, scan_id: uuid.UUID) -> dict[str, Any]:
        bundle = await self._load_scan_bundle(scan_id=scan_id)
        payload = {
            "scan_id": bundle["scan"].id,
            "target": bundle["scan"].target,
            "status": bundle["scan"].status,
            "created_at": bundle["scan"].created_at,
            "completed_at": bundle["scan"].completed_at,
            "progress": bundle["progress"],
            "summary": bundle["summary"],
        }
        payload.update(self._build_runtime_payload(bundle))
        return payload

    async def get_scan_results(self, *, scan_id: uuid.UUID) -> dict[str, Any]:
        bundle = await self._load_scan_bundle(scan_id=scan_id)
        assets_payload = []
        for asset in bundle["assets"]:
            assets_payload.append(
                {
                    "asset_id": asset.id,
                    "hostname": asset.hostname,
                    "ip_address": asset.ip_address,
                    "port": asset.port,
                    "protocol": asset.protocol,
                    "service_type": asset.service_type,
                    "server_software": asset.server_software,
                    "open_ports": asset.open_ports,
                    "asset_metadata": asset.asset_metadata,
                    "is_shadow_it": asset.is_shadow_it,
                    "discovery_source": asset.discovery_source,
                    "assessment": serialize_assessment(bundle["assessments"].get(asset.id)),
                    "cbom": serialize_cbom(bundle["cboms"].get(asset.id)),
                    "remediation": serialize_remediation(bundle["remediations"].get(asset.id)),
                    "certificate": serialize_asset_certificate(
                        bundle["leaf_certificates"].get(asset.id)
                    ),
                    "compliance_certificate": serialize_certificate(
                        bundle["certificates"].get(asset.id),
                        include_pem=False,
                    ),
                    "leaf_certificate": serialize_leaf_certificate(
                        bundle["leaf_certificates"].get(asset.id)
                    ),
                    "remediation_actions": [
                        serialize_remediation_action(action)
                        for action in bundle["remediation_actions"].get(asset.id, [])
                    ],
                    "asset_fingerprint": serialize_asset_fingerprint(
                        bundle["asset_fingerprints"].get(asset.id)
                    ),
                }
            )

        payload = {
            "scan_id": bundle["scan"].id,
            "target": bundle["scan"].target,
            "status": bundle["scan"].status,
            "created_at": bundle["scan"].created_at,
            "completed_at": bundle["scan"].completed_at,
            "progress": bundle["progress"],
            "summary": bundle["summary"],
            "dns_records": [serialize_dns_record(record) for record in bundle["dns_records"]],
            "assets": assets_payload,
        }
        payload.update(self._build_runtime_payload(bundle))
        return payload

    async def get_mission_control_overview(
        self,
        *,
        recent_limit: int = 10,
        priority_limit: int = 5,
    ) -> dict[str, Any]:
        async with self.session_factory() as session:
            scan_repository = ScanJobRepository(session)
            scans = list(await scan_repository.get_recent(limit=recent_limit))

        bundles = [await self._load_scan_bundle(scan_id=scan.id) for scan in scans]
        recent_scans = [self._serialize_recent_scan(bundle) for bundle in bundles]
        priority_findings = self._build_priority_findings(
            bundles=bundles,
            priority_limit=priority_limit,
        )

        completed_scans = sum(
            1 for bundle in bundles if bundle["scan"].status is ScanStatus.COMPLETED
        )
        running_scans = sum(
            1
            for bundle in bundles
            if bundle["scan"].status in {ScanStatus.PENDING, ScanStatus.RUNNING}
        )
        failed_scans = sum(1 for bundle in bundles if bundle["scan"].status is ScanStatus.FAILED)
        degraded_counts = [len(bundle["runtime"]["degraded_modes"]) for bundle in bundles]

        return {
            "portfolio_summary": {
                "completed_scans": completed_scans,
                "running_scans": running_scans,
                "failed_scans": failed_scans,
                "vulnerable_assets": sum(
                    bundle["summary"]["vulnerable_assets"] for bundle in bundles
                ),
                "transitioning_assets": sum(
                    bundle["summary"]["transitioning_assets"] for bundle in bundles
                ),
                "compliant_assets": sum(
                    bundle["summary"]["fully_quantum_safe_assets"] for bundle in bundles
                ),
                "certificates_issued": sum(
                    bundle["progress"]["certificates_created"] for bundle in bundles
                ),
                "remediation_bundles_generated": sum(
                    bundle["progress"]["remediations_created"] for bundle in bundles
                ),
                "degraded_scan_count": sum(1 for count in degraded_counts if count > 0),
            },
            "recent_scans": recent_scans,
            "priority_findings": priority_findings,
            "system_health": {
                "backend_status": "reachable",
                "degraded_runtime_notice_count": sum(degraded_counts),
            },
        }

    async def get_scan_history(
        self,
        *,
        limit: int | None = None,
        target: str | None = None,
    ) -> dict[str, Any]:
        async with self.session_factory() as session:
            scan_repository = ScanJobRepository(session)
            scans = list(await scan_repository.get_recent(limit=limit, target=target))

        bundles = [await self._load_scan_bundle(scan_id=scan.id) for scan in scans]
        return {
            "items": [self._serialize_recent_scan(bundle) for bundle in bundles],
        }

    async def get_recent_activity(
        self,
        *,
        limit: int = 25,
    ) -> dict[str, Any]:
        async with self.session_factory() as session:
            rows = (
                await session.execute(
                    select(ScanEvent, ScanJob)
                    .join(ScanJob, ScanEvent.scan_id == ScanJob.id)
                    .order_by(ScanEvent.timestamp.desc(), ScanEvent.id.desc())
                    .limit(limit)
                )
            ).all()

        items: list[dict[str, Any]] = []
        for event, scan in rows:
            message = event.message
            lowered = message.lower()
            route = None
            if "cbom" in lowered:
                route = "/dashboard/cbom"
            elif "certificate" in lowered:
                route = "/dashboard/discovery?tab=ssl"
            elif "remediation" in lowered or "vulnerable" in lowered:
                route = "/dashboard/remediation/action-plan"
            elif "discovered" in lowered or "dns" in lowered:
                route = "/dashboard/discovery"

            items.append(
                {
                    "timestamp": event.timestamp,
                    "kind": event.kind,
                    "message": message,
                    "stage": event.stage,
                    "scan_id": scan.id,
                    "target": scan.target,
                    "status": scan.status,
                    "route": route,
                }
            )

        return {"items": items}

    async def get_network_graph(
        self,
        *,
        scan_id: uuid.UUID | None = None,
        limit: int = 150,
    ) -> dict[str, list[Any]]:
        async with self.session_factory() as session:
            if scan_id is not None:
                scan_row = (
                    await session.execute(select(ScanJob).where(ScanJob.id == scan_id))
                ).scalar_one_or_none()
                if scan_row is None:
                    raise ScanNotFoundError(f"Scan {scan_id} does not exist.")
                selected_scan_id = scan_row.id
            else:
                selected_scan_id = (
                    await session.execute(
                        select(ScanJob.id)
                        .where(ScanJob.status == ScanStatus.COMPLETED)
                        .order_by(
                            ScanJob.completed_at.desc().nullslast(),
                            ScanJob.created_at.desc(),
                        )
                        .limit(1)
                    )
                ).scalar_one_or_none()

            if selected_scan_id is None:
                return {"nodes": [], "edges": []}

            assets = (
                (
                    await session.execute(
                        select(DiscoveredAsset)
                        .where(DiscoveredAsset.scan_id == selected_scan_id)
                        .order_by(DiscoveredAsset.hostname.asc(), DiscoveredAsset.port.asc())
                        .limit(limit)
                    )
                )
                .scalars()
                .all()
            )
            if not assets:
                return {"nodes": [], "edges": []}

            asset_ids = [asset.id for asset in assets]
            assessments = (
                (
                    await session.execute(
                        select(CryptoAssessment).where(CryptoAssessment.asset_id.in_(asset_ids))
                    )
                )
                .scalars()
                .all()
            )
            assessments_by_asset_id = {
                assessment.asset_id: assessment for assessment in assessments
            }

        status_rank = {
            "critical": 4,
            "unknown": 3,
            "vulnerable": 2,
            "transitioning": 1,
            "elite-pqc": 0,
        }

        def combine_status(current: str | None, incoming: str) -> str:
            if current is None:
                return incoming
            return incoming if status_rank[incoming] > status_rank[current] else current

        def map_asset_status(assessment: CryptoAssessment | None) -> str:
            if assessment is None:
                return "unknown"
            if assessment.compliance_tier is ComplianceTier.FULLY_QUANTUM_SAFE:
                return "elite-pqc"
            if assessment.compliance_tier is ComplianceTier.PQC_TRANSITIONING:
                return "transitioning"
            risk_score = assessment.risk_score or 0.0
            if risk_score >= 70:
                return "critical"
            if risk_score >= 40:
                return "vulnerable"
            return "transitioning"

        domain_to_ips: dict[str, list[str]] = {}
        ip_to_ports: dict[str, list[tuple[str, str]]] = {}
        domain_statuses: dict[str, str] = {}
        ip_statuses: dict[str, str] = {}
        port_statuses: dict[str, str] = {}

        for asset in assets:
            domain = (asset.hostname or asset.ip_address or "unknown").strip().lower()
            ip = (asset.ip_address or domain).strip().lower()
            port = str(asset.port)
            port_id = f"{ip}:{port}"
            status = map_asset_status(assessments_by_asset_id.get(asset.id))

            domain_to_ips.setdefault(domain, [])
            if ip not in domain_to_ips[domain]:
                domain_to_ips[domain].append(ip)

            ip_to_ports.setdefault(ip, [])
            port_tuple = (port_id, port)
            if port_tuple not in ip_to_ports[ip]:
                ip_to_ports[ip].append(port_tuple)

            domain_statuses[domain] = combine_status(domain_statuses.get(domain), status)
            ip_statuses[ip] = combine_status(ip_statuses.get(ip), status)
            port_statuses[port_id] = combine_status(port_statuses.get(port_id), status)

        nodes: list[dict[str, Any]] = []
        edges: list[list[str]] = []
        seen_edges: set[tuple[str, str]] = set()

        domain_positions: dict[str, float] = {}
        ip_positions: dict[str, float] = {}
        port_positions: dict[str, tuple[float, str]] = {}

        sorted_domains = sorted(domain_to_ips.keys())
        domain_y_step = 320 / max(len(sorted_domains), 1)
        for domain_index, domain in enumerate(sorted_domains):
            domain_positions[domain] = 20 + domain_y_step * (domain_index + 0.5)

        sorted_ips = sorted(ip_to_ports.keys())
        ip_y_step = 320 / max(len(sorted_ips), 1)
        for ip_index, ip in enumerate(sorted_ips):
            ip_positions[ip] = 20 + ip_y_step * (ip_index + 0.5)

        for ip in sorted_ips:
            ip_y = ip_positions[ip]
            ports = sorted(ip_to_ports.get(ip, []), key=lambda item: int(item[1]))
            for port_index, (port_id, port_label) in enumerate(ports):
                if port_id not in port_positions:
                    port_y = max(16.0, min(344.0, ip_y - 12 + (port_index * 12)))
                    port_positions[port_id] = (port_y, port_label)

        for domain in sorted_domains:
            nodes.append(
                {
                    "id": domain,
                    "label": domain,
                    "status": domain_statuses.get(domain, "unknown"),
                    "x": 120,
                    "y": round(domain_positions[domain], 2),
                    "r": 18,
                }
            )

        for ip in sorted_ips:
            nodes.append(
                {
                    "id": ip,
                    "label": ip,
                    "status": ip_statuses.get(ip, "unknown"),
                    "x": 320,
                    "y": round(ip_positions[ip], 2),
                    "r": 14,
                }
            )

        for port_id, (port_y, port_label) in sorted(port_positions.items()):
            nodes.append(
                {
                    "id": port_id,
                    "label": port_label,
                    "status": port_statuses.get(port_id, "unknown"),
                    "x": 500,
                    "y": round(port_y, 2),
                    "r": 9,
                }
            )

        for domain in sorted_domains:
            for ip in sorted(domain_to_ips[domain]):
                edge = (domain, ip)
                if edge not in seen_edges:
                    seen_edges.add(edge)
                    edges.append([domain, ip])

        for ip in sorted_ips:
            for port_id, _port_label in sorted(
                ip_to_ports.get(ip, []), key=lambda item: int(item[1])
            ):
                edge = (ip, port_id)
                if edge not in seen_edges:
                    seen_edges.add(edge)
                    edges.append([ip, port_id])

        return {"nodes": nodes, "edges": edges}

    async def get_latest_cbom(self, *, asset_id: uuid.UUID) -> dict[str, Any]:
        async with self.session_factory() as session:
            repository = CbomDocumentRepository(session)
            cbom = select_latest_cbom(await repository.get_by_asset_id(asset_id))
            if cbom is None:
                raise ScanNotFoundError(f"No CBOM found for asset {asset_id}.")
            return serialize_cbom(cbom)

    async def get_latest_certificate(self, *, asset_id: uuid.UUID) -> dict[str, Any]:
        async with self.session_factory() as session:
            repository = ComplianceCertificateRepository(session)
            certificate = select_latest_certificate(await repository.get_by_asset_id(asset_id))
            if certificate is None:
                raise ScanNotFoundError(f"No certificate found for asset {asset_id}.")
            return serialize_certificate(certificate, include_pem=True)

    async def get_latest_remediation(self, *, asset_id: uuid.UUID) -> dict[str, Any]:
        async with self.session_factory() as session:
            repository = RemediationBundleRepository(session)
            remediation = select_latest_remediation(await repository.get_by_asset_id(asset_id))
            if remediation is None:
                raise ScanNotFoundError(f"No remediation found for asset {asset_id}.")
            return serialize_remediation(remediation)

    async def _load_scan_bundle(self, *, scan_id: uuid.UUID) -> dict[str, Any]:
        async with self.session_factory() as session:
            return await self._load_scan_bundle_from_session(session=session, scan_id=scan_id)

    async def _load_scan_bundle_from_session(
        self,
        *,
        session: AsyncSession,
        scan_id: uuid.UUID,
    ) -> dict[str, Any]:
        scan_repository = ScanJobRepository(session)
        asset_repository = DiscoveredAssetRepository(session)
        assessment_repository = CryptoAssessmentRepository(session)
        cbom_repository = CbomDocumentRepository(session)
        remediation_repository = RemediationBundleRepository(session)
        certificate_repository = ComplianceCertificateRepository(session)
        fingerprint_repository = AssetFingerprintRepository(session)
        dns_record_repository = DNSRecordRepository(session)
        scan_event_repository = ScanEventRepository(session)

        scan = await scan_repository.get_by_id(scan_id)
        if scan is None:
            raise ScanNotFoundError(f"Scan {scan_id} does not exist.")

        assets = list(await asset_repository.get_by_scan_id(scan_id))
        dns_records = list(await dns_record_repository.get_by_scan_id(scan_id))
        scan_events = list(await scan_event_repository.get_by_scan_id(scan_id))
        assessments: dict[uuid.UUID, CryptoAssessment] = {}
        cboms: dict[uuid.UUID, Any] = {}
        remediations: dict[uuid.UUID, Any] = {}
        certificates: dict[uuid.UUID, Any] = {}
        leaf_certificates: dict[uuid.UUID, CertificateChain] = {}
        remediation_actions: dict[uuid.UUID, list[RemediationAction]] = {}
        asset_fingerprints: dict[uuid.UUID, AssetFingerprint] = {}

        asset_ids = [asset.id for asset in assets]
        if asset_ids:
            canonical_keys_by_asset_id = {
                asset.id: canonical_key
                for asset in assets
                for canonical_key in [build_asset_fingerprint_key(asset)]
                if canonical_key is not None
            }
            if canonical_keys_by_asset_id:
                fingerprint_rows = await fingerprint_repository.get_by_canonical_keys(
                    tuple(canonical_keys_by_asset_id.values())
                )
                fingerprints_by_key = {
                    fingerprint.canonical_key: fingerprint for fingerprint in fingerprint_rows
                }
                asset_fingerprints = {
                    asset_id: fingerprints_by_key[canonical_key]
                    for asset_id, canonical_key in canonical_keys_by_asset_id.items()
                    if canonical_key in fingerprints_by_key
                }

            leaf_certificate_rows = (
                (
                    await session.execute(
                        select(CertificateChain).where(
                            CertificateChain.asset_id.in_(asset_ids),
                            CertificateChain.cert_level == CertLevel.LEAF,
                        )
                    )
                )
                .scalars()
                .all()
            )
            for certificate_chain in leaf_certificate_rows:
                leaf_certificates[certificate_chain.asset_id] = certificate_chain

            remediation_action_rows = (
                (
                    await session.execute(
                        select(RemediationAction).where(RemediationAction.asset_id.in_(asset_ids))
                    )
                )
                .scalars()
                .all()
            )
            for remediation_action in remediation_action_rows:
                remediation_actions.setdefault(remediation_action.asset_id, []).append(
                    remediation_action
                )

        for asset in assets:
            assessment_rows = await assessment_repository.get_by_asset_id(asset.id)
            if assessment_rows:
                assessments[asset.id] = select_latest(
                    assessment_rows,
                    timestamp_getter=lambda record: None,
                )

            cbom = select_latest_cbom(await cbom_repository.get_by_asset_id(asset.id))
            if cbom is not None:
                cboms[asset.id] = cbom

            remediation = select_latest_remediation(
                await remediation_repository.get_by_asset_id(asset.id)
            )
            if remediation is not None:
                remediations[asset.id] = remediation

            certificate = select_latest_certificate(
                await certificate_repository.get_by_asset_id(asset.id)
            )
            if certificate is not None:
                certificates[asset.id] = certificate

        tier_counts = {
            ComplianceTier.FULLY_QUANTUM_SAFE: 0,
            ComplianceTier.PQC_TRANSITIONING: 0,
            ComplianceTier.QUANTUM_VULNERABLE: 0,
        }
        critical_assets = 0
        unknown_assets = 0
        q_scores = []
        risk_scores = []
        for asset in assets:
            assessment = assessments.get(asset.id)
            if assessment is None:
                unknown_assets += 1
                continue

            if assessment.compliance_tier in tier_counts:
                tier_counts[assessment.compliance_tier] += 1
            else:
                unknown_assets += 1

            if assessment.risk_score is not None:
                risk_scores.append(assessment.risk_score)
                q_scores.append(max(0.0, min(100.0, 100.0 - assessment.risk_score)))
                if assessment.risk_score > 70:
                    critical_assets += 1
        tls_assets = sum(1 for asset in assets if asset.service_type is ServiceType.TLS)

        bundle = {
            "scan": scan,
            "assets": assets,
            "dns_records": dns_records,
            "scan_events": scan_events,
            "assessments": assessments,
            "cboms": cboms,
            "remediations": remediations,
            "certificates": certificates,
            "leaf_certificates": leaf_certificates,
            "remediation_actions": remediation_actions,
            "asset_fingerprints": asset_fingerprints,
            "progress": {
                "assets_discovered": len(assets),
                "assessments_created": len(assessments),
                "cboms_created": len(cboms),
                "remediations_created": len(remediations),
                "certificates_created": len(certificates),
            },
            "summary": {
                "total_assets": len(assets),
                "tls_assets": tls_assets,
                "non_tls_assets": len(assets) - tls_assets,
                "fully_quantum_safe_assets": tier_counts[ComplianceTier.FULLY_QUANTUM_SAFE],
                "transitioning_assets": tier_counts[ComplianceTier.PQC_TRANSITIONING],
                "vulnerable_assets": tier_counts[ComplianceTier.QUANTUM_VULNERABLE],
                "critical_assets": critical_assets,
                "unknown_assets": unknown_assets,
                "average_q_score": round(sum(q_scores) / len(q_scores), 1) if q_scores else None,
                "highest_risk_score": max(risk_scores) if risk_scores else None,
            },
        }
        bundle["runtime"] = self._build_runtime_payload(bundle)
        return bundle

    def _serialize_recent_scan(self, bundle: dict[str, Any]) -> dict[str, Any]:
        return {
            "scan_id": bundle["scan"].id,
            "target": bundle["scan"].target,
            "status": bundle["scan"].status,
            "created_at": bundle["scan"].created_at,
            "completed_at": bundle["scan"].completed_at,
            "summary": {
                "total_assets": bundle["summary"]["total_assets"],
                "tls_assets": bundle["summary"]["tls_assets"],
                "non_tls_assets": bundle["summary"]["non_tls_assets"],
                "vulnerable_assets": bundle["summary"]["vulnerable_assets"],
                "transitioning_assets": bundle["summary"]["transitioning_assets"],
                "fully_quantum_safe_assets": bundle["summary"]["fully_quantum_safe_assets"],
                "critical_assets": bundle["summary"]["critical_assets"],
                "unknown_assets": bundle["summary"]["unknown_assets"],
                "average_q_score": bundle["summary"]["average_q_score"],
                "highest_risk_score": bundle["summary"]["highest_risk_score"],
            },
            "progress": bundle["progress"],
            "scan_profile": bundle["scan"].scan_profile,
            "initiated_by": bundle["scan"].initiated_by,
            "degraded_mode_count": len(bundle["runtime"]["degraded_modes"]),
        }

    def _build_priority_findings(
        self,
        *,
        bundles: Sequence[dict[str, Any]],
        priority_limit: int,
    ) -> list[dict[str, Any]]:
        findings: list[dict[str, Any]] = []
        for bundle in bundles:
            if bundle["scan"].status is not ScanStatus.COMPLETED:
                continue

            for asset in bundle["assets"]:
                assessment = bundle["assessments"].get(asset.id)
                findings.append(
                    {
                        "scan_id": bundle["scan"].id,
                        "asset_id": asset.id,
                        "target": bundle["scan"].target,
                        "asset_label": asset.hostname or asset.ip_address or str(asset.id),
                        "port": asset.port,
                        "service_type": asset.service_type,
                        "tier": getattr(assessment, "compliance_tier", None),
                        "risk_score": getattr(assessment, "risk_score", None),
                    }
                )

        tier_rank = {
            ComplianceTier.QUANTUM_VULNERABLE: 0,
            ComplianceTier.PQC_TRANSITIONING: 1,
            ComplianceTier.FULLY_QUANTUM_SAFE: 2,
            None: 3,
        }
        findings.sort(
            key=lambda finding: (
                tier_rank.get(finding["tier"], 3),
                -(
                    finding["risk_score"]
                    if isinstance(finding["risk_score"], (float, int))
                    else -1.0
                ),
                str(finding["scan_id"]),
                str(finding["asset_id"]),
            )
        )
        return findings[:priority_limit]

    def _build_runtime_payload(self, bundle: dict[str, Any]) -> dict[str, Any]:
        runtime_snapshot = None
        if self.runtime_store is not None:
            runtime_snapshot = self.runtime_store.get_snapshot(bundle["scan"].id)

        completed_at = bundle["scan"].completed_at
        end_time = completed_at or datetime.now(UTC)
        created_at = bundle["scan"].created_at
        elapsed_seconds = None
        if created_at is not None:
            elapsed_seconds = max((end_time - created_at).total_seconds(), 0.0)

        stage = runtime_snapshot.stage if runtime_snapshot is not None else None
        if stage is None:
            stage = (
                "queued"
                if bundle["scan"].status is ScanStatus.PENDING
                else bundle["scan"].status.value
            )

        persisted_events = [
            serialize_persisted_scan_event(event)
            for event in sorted(
                bundle.get("scan_events", []),
                key=lambda event: (
                    getattr(event, "timestamp", None) or datetime.min.replace(tzinfo=UTC),
                    str(getattr(event, "id", "")),
                ),
            )
        ]
        runtime_events = (
            [serialize_runtime_event(event) for event in runtime_snapshot.events]
            if runtime_snapshot is not None
            else persisted_events
        )
        degraded_modes = (
            list(runtime_snapshot.degraded_modes)
            if runtime_snapshot is not None
            else [event["message"] for event in persisted_events if event["kind"] == "degraded"]
        )

        return {
            "stage": stage,
            "stage_detail": runtime_snapshot.stage_detail if runtime_snapshot is not None else None,
            "stage_started_at": runtime_snapshot.stage_started_at
            if runtime_snapshot is not None
            else None,
            "elapsed_seconds": elapsed_seconds,
            "events": runtime_events,
            "degraded_modes": degraded_modes,
        }


def select_latest_cbom(records: Sequence[Any]) -> Any | None:
    """Return the latest CBOM using created_at desc then id desc."""
    return select_latest(
        records,
        timestamp_getter=lambda record: getattr(record, "created_at", None),
    )


def select_latest_certificate(records: Sequence[Any]) -> Any | None:
    """Return the latest certificate using valid_from desc then id desc."""
    return select_latest(
        records,
        timestamp_getter=lambda record: getattr(record, "valid_from", None),
    )


def select_latest_remediation(records: Sequence[Any]) -> Any | None:
    """Return the latest remediation using created_at desc then id desc."""
    return select_latest(
        records,
        timestamp_getter=lambda record: getattr(record, "created_at", None),
    )


def select_latest(
    records: Sequence[Any],
    *,
    timestamp_getter: Callable[[Any], datetime | None],
) -> Any | None:
    """Return the deterministic latest record using timestamp then id."""
    if not records:
        return None
    minimum = datetime.min.replace(tzinfo=UTC)
    return max(
        records,
        key=lambda record: (
            timestamp_getter(record) or minimum,
            str(getattr(record, "id", "")),
        ),
    )


def serialize_assessment(assessment: CryptoAssessment | None) -> dict[str, Any] | None:
    if assessment is None:
        return None
    return {
        "id": assessment.id,
        "tls_version": assessment.tls_version,
        "cipher_suite": assessment.cipher_suite,
        "kex_algorithm": assessment.kex_algorithm,
        "auth_algorithm": assessment.auth_algorithm,
        "enc_algorithm": assessment.enc_algorithm,
        "mac_algorithm": assessment.mac_algorithm,
        "risk_score": assessment.risk_score,
        "score_explanation": assessment.score_explanation,
        "compliance_tier": assessment.compliance_tier,
        "kex_vulnerability": assessment.kex_vulnerability,
        "sig_vulnerability": assessment.sig_vulnerability,
        "sym_vulnerability": assessment.sym_vulnerability,
        "tls_vulnerability": assessment.tls_vulnerability,
    }


def serialize_cbom(cbom_document: Any | None) -> dict[str, Any] | None:
    if cbom_document is None:
        return None
    return {
        "id": cbom_document.id,
        "serial_number": cbom_document.serial_number,
        "created_at": cbom_document.created_at,
        "cbom_json": cbom_document.cbom_json,
    }


def serialize_remediation(remediation_bundle: Any | None) -> dict[str, Any] | None:
    if remediation_bundle is None:
        return None
    return {
        "id": remediation_bundle.id,
        "created_at": remediation_bundle.created_at,
        "hndl_timeline": remediation_bundle.hndl_timeline,
        "patch_config": remediation_bundle.patch_config,
        "migration_roadmap": remediation_bundle.migration_roadmap,
        "source_citations": remediation_bundle.source_citations,
    }


def serialize_certificate(
    certificate: Any | None,
    *,
    include_pem: bool,
) -> dict[str, Any] | None:
    if certificate is None:
        return None
    payload = {
        "id": certificate.id,
        "tier": certificate.tier,
        "signing_algorithm": certificate.signing_algorithm,
        "valid_from": certificate.valid_from,
        "valid_until": certificate.valid_until,
        "extensions_json": certificate.extensions_json,
        "remediation_bundle_id": certificate.remediation_bundle_id,
    }
    if include_pem:
        payload["certificate_pem"] = certificate.certificate_pem
    return payload


def serialize_leaf_certificate(certificate_chain: CertificateChain | None) -> dict[str, Any] | None:
    if certificate_chain is None:
        return None
    now = datetime.now(UTC)
    not_after = certificate_chain.not_after
    return {
        "subject_cn": extract_subject_cn(certificate_chain.subject),
        "issuer": certificate_chain.issuer,
        "public_key_algorithm": certificate_chain.public_key_algorithm,
        "key_size_bits": certificate_chain.key_size_bits,
        "signature_algorithm": certificate_chain.signature_algorithm,
        "quantum_safe": certificate_chain.quantum_safe,
        "not_before": certificate_chain.not_before,
        "not_after": not_after,
        "days_remaining": (not_after - now).days if not_after is not None else None,
    }


def serialize_asset_certificate(
    certificate_chain: CertificateChain | None,
) -> dict[str, Any] | None:
    """Build frontend-facing TLS certificate summary from the leaf certificate row."""
    if certificate_chain is None:
        return None

    summary = serialize_leaf_certificate(certificate_chain)
    if summary is None:
        return None

    public_key_algorithm = (summary.get("public_key_algorithm") or "").upper()
    if "ML-DSA" in public_key_algorithm:
        key_type = "ML-DSA"
    elif "SLH-DSA" in public_key_algorithm:
        key_type = "SLH-DSA"
    elif "ECDSA" in public_key_algorithm or "EC" in public_key_algorithm:
        key_type = "ECDSA"
    else:
        key_type = "RSA"

    subject_cn = summary.get("subject_cn") or "unknown"
    issuer = summary.get("issuer") or "Unknown"

    return {
        "subject_cn": subject_cn,
        "subject_alt_names": [subject_cn] if subject_cn != "unknown" else [],
        "issuer": issuer,
        "certificate_authority": issuer,
        "signature_algorithm": summary.get("signature_algorithm") or "unknown",
        "key_type": key_type,
        "key_size": summary.get("key_size_bits") or 0,
        "valid_from": summary.get("not_before"),
        "valid_until": summary.get("not_after"),
        "days_remaining": summary.get("days_remaining"),
        "sha256_fingerprint": "",
    }


def serialize_asset_fingerprint_history_entry(
    entry: Any,
) -> dict[str, Any] | None:
    if not isinstance(entry, dict):
        return None

    scan_id = entry.get("scan_id")
    parsed_scan_id: uuid.UUID | None = None
    if isinstance(scan_id, uuid.UUID):
        parsed_scan_id = scan_id
    elif isinstance(scan_id, str):
        try:
            parsed_scan_id = uuid.UUID(scan_id)
        except ValueError:
            parsed_scan_id = None

    q_score = entry.get("q_score")
    parsed_q_score: int | None = None
    if isinstance(q_score, bool):
        parsed_q_score = None
    elif isinstance(q_score, (int, float)):
        parsed_q_score = int(round(q_score))
    elif isinstance(q_score, str):
        try:
            parsed_q_score = int(round(float(q_score)))
        except ValueError:
            parsed_q_score = None

    scanned_at = entry.get("scanned_at")
    parsed_scanned_at: datetime | None = None
    if isinstance(scanned_at, datetime):
        parsed_scanned_at = scanned_at
    elif isinstance(scanned_at, str):
        normalized_scanned_at = scanned_at.replace("Z", "+00:00")
        try:
            parsed_scanned_at = datetime.fromisoformat(normalized_scanned_at)
        except ValueError:
            parsed_scanned_at = None
    if parsed_scanned_at is not None and parsed_scanned_at.tzinfo is None:
        parsed_scanned_at = parsed_scanned_at.replace(tzinfo=UTC)

    if parsed_scan_id is None and parsed_q_score is None and parsed_scanned_at is None:
        return None

    return {
        "scan_id": parsed_scan_id,
        "q_score": parsed_q_score,
        "scanned_at": parsed_scanned_at,
    }


def serialize_asset_fingerprint(
    fingerprint: AssetFingerprint | None,
) -> dict[str, Any] | None:
    if fingerprint is None:
        return None

    history_entries = []
    for entry in fingerprint.q_score_history or []:
        serialized_entry = serialize_asset_fingerprint_history_entry(entry)
        if serialized_entry is not None:
            history_entries.append(serialized_entry)

    minimum = datetime.min.replace(tzinfo=UTC)
    history_entries.sort(
        key=lambda entry: (
            entry["scanned_at"] or minimum,
            str(entry["scan_id"] or ""),
        )
    )

    return {
        "canonical_key": fingerprint.canonical_key,
        "appearance_count": fingerprint.appearance_count,
        "latest_q_score": fingerprint.latest_q_score,
        "latest_compliance_tier": fingerprint.latest_compliance_tier,
        "first_seen_at": fingerprint.first_seen_at,
        "last_seen_at": fingerprint.last_seen_at,
        "first_seen_scan_id": fingerprint.first_seen_scan_id,
        "last_seen_scan_id": fingerprint.last_seen_scan_id,
        "q_score_history": history_entries,
    }


def serialize_remediation_action(remediation_action: RemediationAction) -> dict[str, Any]:
    return {
        "priority": remediation_action.priority.value,
        "finding": remediation_action.finding,
        "action": remediation_action.action,
        "effort": remediation_action.effort.value,
        "status": remediation_action.status.value,
        "category": remediation_action.category,
        "nist_reference": remediation_action.nist_reference,
    }


def serialize_dns_record(dns_record: DNSRecord) -> dict[str, Any]:
    return {
        "hostname": dns_record.hostname,
        "resolved_ips": list(dns_record.resolved_ips or []),
        "cnames": list(dns_record.cnames or []),
        "discovery_source": dns_record.discovery_source,
        "is_in_scope": dns_record.is_in_scope,
        "discovered_at": dns_record.discovered_at,
    }


def serialize_runtime_event(event: ScanRuntimeEvent) -> dict[str, Any]:
    return {
        "timestamp": event.timestamp,
        "kind": event.kind,
        "message": event.message,
        "stage": event.stage,
    }


def serialize_persisted_scan_event(event: ScanEvent) -> dict[str, Any]:
    return {
        "timestamp": event.timestamp,
        "kind": event.kind,
        "message": event.message,
        "stage": event.stage,
    }


def _artifact_key_from_tls_result(
    tls_result: TLSProbeResult,
) -> tuple[str | None, str, int, str, str]:
    return (
        _normalize_hostname(tls_result.hostname),
        tls_result.ip_address,
        tls_result.port,
        tls_result.protocol.lower(),
        ServiceType.TLS.value,
    )


def _artifact_key_from_asset(asset: DiscoveredAsset) -> tuple[str | None, str, int, str, str]:
    return (
        _normalize_hostname(asset.hostname),
        asset.ip_address or "",
        asset.port,
        asset.protocol.lower(),
        asset.service_type.value if asset.service_type else "",
    )


def build_asset_fingerprint_key(asset: DiscoveredAsset) -> str | None:
    asset_label = _normalize_hostname(asset.hostname) or (asset.ip_address or "").strip()
    if not asset_label:
        return None
    return f"{asset_label}:{asset.port}/{asset.protocol.lower()}"


def _normalize_hostname(hostname: str | None) -> str | None:
    if hostname is None:
        return None
    normalized = hostname.strip().lower().rstrip(".")
    return normalized or None


def extract_subject_cn(subject: str | None) -> str | None:
    if not subject:
        return None
    match = re.search(r"(?:^|,)CN=([^,]+)", subject)
    if match is None:
        return None
    return match.group(1).strip() or None
