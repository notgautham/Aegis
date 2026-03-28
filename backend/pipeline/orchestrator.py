"""
Phase 8 pipeline orchestration and compiled read models.
"""

from __future__ import annotations

import asyncio
import logging
import uuid
from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import Any, Callable, Sequence

from qdrant_client import QdrantClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from backend.analysis import (
    CertificateAnalyzer,
    HandshakeMetadataResolutionError,
    calculate_risk_score,
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
    aggregate_assets,
)
from backend.discovery.dns_enumerator import DNSEnumerationError
from backend.intelligence import (
    RagOrchestrator,
    RemediationInput,
    RetrievalService,
    create_embedding_provider,
)
from backend.models.crypto_assessment import CryptoAssessment
from backend.models.discovered_asset import DiscoveredAsset
from backend.models.enums import CertLevel, ComplianceTier, ScanStatus, ServiceType
from backend.repositories import (
    CbomDocumentRepository,
    CertificateChainRepository,
    ComplianceCertificateRepository,
    CryptoAssessmentRepository,
    DiscoveredAssetRepository,
    RemediationBundleRepository,
    ScanJobRepository,
)

logger = logging.getLogger(__name__)
MAX_SCAN_RUNTIME_EVENTS = 60


class ScanNotFoundError(RuntimeError):
    """Raised when a requested scan cannot be found."""


class ScanAlreadyRunningError(RuntimeError):
    """Raised when the same scan is dispatched twice while still running."""


class ScanAlreadyTerminalError(RuntimeError):
    """Raised when a terminal scan is dispatched again."""


@dataclass(frozen=True, slots=True)
class _DiscoveryExecution:
    aggregated_assets: tuple[AggregatedAsset, ...]
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
        settings = get_settings()
        self.session_factory = session_factory or async_session_factory
        self.runtime_store = runtime_store
        self.enumerator = enumerator or AmassEnumerator()
        self.dns_validator = dns_validator or DNSxValidator()
        self.port_scanner = port_scanner or PortScanner()
        self.tls_probe = tls_probe or TLSProbe()
        self.certificate_extractor = certificate_extractor or CertificateExtractor()
        self.certificate_analyzer = certificate_analyzer or CertificateAnalyzer()
        self.rules_engine = rules_engine or RulesEngine()
        self.cbom_mapper = cbom_mapper or CycloneDxMapper()
        self.certificate_signer = certificate_signer or CertificateSigner()
        self.rag_orchestrator = rag_orchestrator or RagOrchestrator(
            retrieval_service=RetrievalService(
                client=QdrantClient(url=settings.QDRANT_URL),
                collection_name=settings.QDRANT_COLLECTION_NAME,
                embedding_provider=create_embedding_provider(settings),
                default_top_k=settings.RAG_TOP_K,
            )
        )

    async def run_scan(self, *, scan_id: uuid.UUID, target: str) -> None:
        """Run the full Phase 3-to-7 pipeline for one existing scan job."""
        terminal_status: ScanStatus | None = None
        terminal_timestamp: datetime | None = None

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
            discovery = await self._run_discovery(target, scan_id=scan_id)
            persisted_assets = await self._persist_discovered_assets(
                scan_id=scan_id,
                aggregated_assets=discovery.aggregated_assets,
            )
            if self.runtime_store is not None:
                self.runtime_store.add_event(
                    scan_id,
                    f"Persisted {len(persisted_assets)} discovered assets.",
                    kind="success",
                )

            for asset in persisted_assets:
                if asset.service_type is not ServiceType.TLS:
                    continue

                tls_result = discovery.tls_results_by_key.get(_artifact_key_from_asset(asset))
                if tls_result is None or not tls_result.cipher_suite or not tls_result.tls_version:
                    continue

                try:
                    await self._process_tls_asset(
                        asset_id=asset.id,
                        tls_result=tls_result,
                        scan_id=scan_id,
                    )
                except Exception:
                    if self.runtime_store is not None:
                        self.runtime_store.add_event(
                            scan_id,
                            (
                                f"Asset pipeline failed for {asset.hostname or asset.ip_address}:"
                                f"{asset.port}; continuing with remaining assets."
                            ),
                            kind="error",
                        )
                    logger.exception(
                        "Per-asset pipeline failure for scan %s asset %s (%s:%s).",
                        scan_id,
                        asset.id,
                        asset.hostname or asset.ip_address,
                        asset.port,
                    )

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

    async def _run_discovery(self, target: str, *, scan_id: uuid.UUID | None = None) -> _DiscoveryExecution:
        scope = AuthorizedScope.from_target(target)
        validated_hostnames = await self._resolve_hostnames(target, scope, scan_id=scan_id)
        ip_addresses = self._collect_scan_ips(scope, validated_hostnames)
        self._add_runtime_event(
            scan_id,
            f"Prepared {len(ip_addresses)} address(es) for port scanning.",
            kind="info",
            stage="scanning_ports",
        )
        port_findings = await self._scan_ports(ip_addresses, scan_id=scan_id)
        tls_results = await self._probe_tls_targets(
            scope=scope,
            validated_hostnames=validated_hostnames,
            port_findings=port_findings,
            scan_id=scan_id,
        )
        aggregated_assets = aggregate_assets(
            target,
            validated_hostnames,
            port_findings,
            tls_results,
        )
        self._add_runtime_event(
            scan_id,
            f"Discovery produced {len(aggregated_assets)} aggregated asset candidate(s).",
            kind="success",
            stage="persisting_assets",
        )
        return _DiscoveryExecution(
            aggregated_assets=tuple(aggregated_assets),
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

        self._set_runtime_stage(
            scan_id,
            stage="validating_dns",
            detail=f"{len(hostnames)} hostname(s)",
            message="Validating DNS resolution for discovered hostnames.",
        )
        validated = await self.dns_validator.validate(hostnames)
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

        self._set_runtime_stage(
            scan_id,
            stage="scanning_ports",
            detail=f"{len(ip_addresses)} address(es)",
            message="Running bounded TCP/UDP discovery across in-scope addresses.",
        )

        scan_results = await asyncio.gather(
            *(self.port_scanner.scan_host(ip_address) for ip_address in ip_addresses),
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
        results = await asyncio.gather(
            *(self.tls_probe.probe(target) for target in tls_targets),
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
                if scope.scope_type in {"ip", "network"} and not scope.contains(ip_address=ip_address):
                    continue
                ip_to_hostnames.setdefault(ip_address, set()).add(hostname)
        return ip_to_hostnames

    async def _persist_discovered_assets(
        self,
        *,
        scan_id: uuid.UUID,
        aggregated_assets: Sequence[AggregatedAsset],
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
                persisted_assets.append(
                    await repository.create(
                        scan_id=scan_id,
                        hostname=asset.hostname,
                        ip_address=asset.ip_address,
                        port=asset.port,
                        protocol=asset.protocol,
                        service_type=asset.service_type,
                        server_software=asset.server_software,
                    )
                )
            await session.commit()
            return persisted_assets

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

            extracted_certificates = self.certificate_extractor.extract(tls_result)
            analyzed_certificates = self.certificate_analyzer.analyze(extracted_certificates)
            persisted_certificates = []

            for extracted, analyzed in zip(extracted_certificates, analyzed_certificates, strict=True):
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
                        self._add_runtime_event(
                            scan_id,
                            f"Generated remediation artifacts for {asset_label}.",
                            kind="success",
                            stage="generating_remediation",
                        )
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

    def _build_assessment_inputs(
        self,
        *,
        tls_result: TLSProbeResult,
        analyzed_certificates: Sequence[Any],
    ) -> _AssessmentInputs:
        if not tls_result.cipher_suite:
            raise ValueError("TLS result is missing a cipher suite.")

        tls_version = tls_result.tls_version
        if tls_version and "1.3" in tls_version:
            return self._build_tls13_assessment_inputs(
                tls_result=tls_result,
                analyzed_certificates=analyzed_certificates,
            )

        parsed = parse_tls12_cipher_suite(tls_result.cipher_suite)
        risk = calculate_risk_score(
            kex_vulnerability=parsed.kex_vulnerability,
            sig_vulnerability=parsed.sig_vulnerability,
            sym_vulnerability=parsed.sym_vulnerability,
            tls_version=tls_result.tls_version,
        )
        return _AssessmentInputs(
            tls_version=tls_result.tls_version,
            cipher_suite=tls_result.cipher_suite,
            kex_algorithm=parsed.kex_algorithm,
            auth_algorithm=parsed.auth_algorithm,
            enc_algorithm=parsed.enc_algorithm,
            mac_algorithm=parsed.mac_algorithm,
            kex_vulnerability=parsed.kex_vulnerability,
            sig_vulnerability=parsed.sig_vulnerability,
            sym_vulnerability=parsed.sym_vulnerability,
            tls_vulnerability=risk.tls_vulnerability,
            risk_score=risk.score,
        )

    def _build_tls13_assessment_inputs(
        self,
        *,
        tls_result: TLSProbeResult,
        analyzed_certificates: Sequence[Any],
    ) -> _AssessmentInputs:
        leaf_certificate = next(
            (certificate for certificate in analyzed_certificates if certificate.cert_level is CertLevel.LEAF),
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
        except HandshakeMetadataResolutionError:
            auth_algorithm = canonicalize_algorithm(
                "sig",
                getattr(leaf_certificate, "public_key_algorithm", None)
                or getattr(leaf_certificate, "signature_algorithm", None),
            )
            group_name = (
                metadata.get("group_name")
                or metadata.get("key_exchange")
                or metadata.get("curve_name")
                or "X25519"
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
                    "assessment": serialize_assessment(bundle["assessments"].get(asset.id)),
                    "cbom": serialize_cbom(bundle["cboms"].get(asset.id)),
                    "remediation": serialize_remediation(bundle["remediations"].get(asset.id)),
                    "certificate": serialize_certificate(
                        bundle["certificates"].get(asset.id),
                        include_pem=False,
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
        failed_scans = sum(
            1 for bundle in bundles if bundle["scan"].status is ScanStatus.FAILED
        )
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
        limit: int = 10,
        target: str | None = None,
    ) -> dict[str, Any]:
        async with self.session_factory() as session:
            scan_repository = ScanJobRepository(session)
            scans = list(await scan_repository.get_recent(limit=limit, target=target))

        bundles = [await self._load_scan_bundle(scan_id=scan.id) for scan in scans]
        return {
            "items": [self._serialize_recent_scan(bundle) for bundle in bundles],
        }

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

        scan = await scan_repository.get_by_id(scan_id)
        if scan is None:
            raise ScanNotFoundError(f"Scan {scan_id} does not exist.")

        assets = list(await asset_repository.get_by_scan_id(scan_id))
        assessments: dict[uuid.UUID, CryptoAssessment] = {}
        cboms: dict[uuid.UUID, Any] = {}
        remediations: dict[uuid.UUID, Any] = {}
        certificates: dict[uuid.UUID, Any] = {}

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
        risk_scores = []
        for assessment in assessments.values():
            if assessment.compliance_tier in tier_counts:
                tier_counts[assessment.compliance_tier] += 1
            if assessment.risk_score is not None:
                risk_scores.append(assessment.risk_score)
        tls_assets = sum(1 for asset in assets if asset.service_type is ServiceType.TLS)

        bundle = {
            "scan": scan,
            "assets": assets,
            "assessments": assessments,
            "cboms": cboms,
            "remediations": remediations,
            "certificates": certificates,
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
                "vulnerable_assets": bundle["summary"]["vulnerable_assets"],
                "transitioning_assets": bundle["summary"]["transitioning_assets"],
                "fully_quantum_safe_assets": bundle["summary"]["fully_quantum_safe_assets"],
                "highest_risk_score": bundle["summary"]["highest_risk_score"],
            },
            "progress": bundle["progress"],
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

        return {
            "stage": stage,
            "stage_detail": runtime_snapshot.stage_detail if runtime_snapshot is not None else None,
            "stage_started_at": runtime_snapshot.stage_started_at if runtime_snapshot is not None else None,
            "elapsed_seconds": elapsed_seconds,
            "events": [
                serialize_runtime_event(event)
                for event in (runtime_snapshot.events if runtime_snapshot is not None else [])
            ],
            "degraded_modes": list(runtime_snapshot.degraded_modes) if runtime_snapshot is not None else [],
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


def serialize_runtime_event(event: ScanRuntimeEvent) -> dict[str, Any]:
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


def _normalize_hostname(hostname: str | None) -> str | None:
    if hostname is None:
        return None
    normalized = hostname.strip().lower().rstrip(".")
    return normalized or None
