"""
Shared helpers for Phase 8 orchestrator and API tests.
"""

from __future__ import annotations

import uuid
from pathlib import Path
from typing import Iterable

from qdrant_client import QdrantClient

from backend.core.config import Settings
from backend.discovery.types import EnumeratedHostname, PortFinding, TLSProbeResult, ValidatedHostname
from backend.intelligence import RagOrchestrator, RetrievalService, create_embedding_provider
from backend.models.enums import ServiceType
from backend.pipeline import PipelineOrchestrator, ScanRuntimeStore
from tests.unit._certificate_helpers import build_rsa_certificate_chain
from tests.unit._phase6_helpers import write_sample_corpus
from tests.unit._phase7_helpers import unavailable_oqs_capability
from backend.cert import CertificateSigner


class StubEnumerator:
    def __init__(self, hostnames: Iterable[str] = (), *, should_fail: bool = False) -> None:
        self.hostnames = tuple(hostnames)
        self.should_fail = should_fail

    async def enumerate(self, target: str) -> list[EnumeratedHostname]:
        if self.should_fail:
            raise RuntimeError("enumeration failed")
        return [EnumeratedHostname(hostname=hostname) for hostname in self.hostnames]


class StubDNSValidator:
    def __init__(self, records: Iterable[ValidatedHostname], *, should_fail: bool = False) -> None:
        self.records = tuple(records)
        self.should_fail = should_fail

    async def validate(self, hostnames: Iterable[str]) -> list[ValidatedHostname]:
        if self.should_fail:
            raise RuntimeError("dns validation failed")
        return list(self.records)


class StubPortScanner:
    def __init__(self, findings_by_ip: dict[str, list[PortFinding]]) -> None:
        self.findings_by_ip = findings_by_ip

    async def scan_host(self, ip_address: str) -> list[PortFinding]:
        return list(self.findings_by_ip.get(ip_address, []))


class StubTLSProbe:
    def __init__(
        self,
        results_by_target: dict[tuple[str | None, str, int], TLSProbeResult],
        *,
        failing_targets: Iterable[tuple[str | None, str, int]] = (),
    ) -> None:
        self.results_by_target = results_by_target
        self.failing_targets = set(failing_targets)

    async def probe(self, target) -> TLSProbeResult:
        key = (target.hostname, target.ip_address, target.port)
        if key in self.failing_targets:
            raise RuntimeError("tls probe failed")
        return self.results_by_target[key]


def build_tls_result(
    *,
    hostname: str | None,
    ip_address: str,
    port: int = 443,
    tls_version: str = "1.2",
    cipher_suite: str = "TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384",
    server_software: str = "nginx",
    metadata: dict[str, object] | None = None,
) -> TLSProbeResult:
    leaf_pem, root_pem = build_rsa_certificate_chain()
    return TLSProbeResult(
        hostname=hostname,
        ip_address=ip_address,
        port=port,
        protocol="tcp",
        tls_version=tls_version,
        cipher_suite=cipher_suite,
        certificate_chain_pem=(leaf_pem, root_pem),
        server_software=server_software,
        metadata=metadata or {},
    )


def build_phase8_orchestrator(
    *,
    session_factory,
    tmp_path: Path,
    validated_hostnames: list[ValidatedHostname],
    port_findings_by_ip: dict[str, list[PortFinding]],
    tls_results_by_target: dict[tuple[str | None, str, int], TLSProbeResult],
    enumerated_hostnames: Iterable[str] = (),
    failing_tls_targets: Iterable[tuple[str | None, str, int]] = (),
    runtime_store: ScanRuntimeStore | None = None,
) -> PipelineOrchestrator:
    collection_name = f"phase8_{uuid.uuid4().hex}"
    retrieval_service = RetrievalService(
        client=QdrantClient(":memory:"),
        collection_name=collection_name,
        embedding_provider=create_embedding_provider(Settings()),
        default_top_k=5,
    )
    retrieval_service.ingest_source_directory(write_sample_corpus(tmp_path / collection_name))
    signer = CertificateSigner(runtime_dir=tmp_path / f"cert-runtime-{uuid.uuid4().hex[:8]}")
    signer._detect_oqs_capability = lambda: unavailable_oqs_capability()  # type: ignore[attr-defined]
    return PipelineOrchestrator(
        session_factory=session_factory,
        runtime_store=runtime_store,
        enumerator=StubEnumerator(enumerated_hostnames),
        dns_validator=StubDNSValidator(validated_hostnames),
        port_scanner=StubPortScanner(port_findings_by_ip),
        tls_probe=StubTLSProbe(tls_results_by_target, failing_targets=failing_tls_targets),
        rag_orchestrator=RagOrchestrator(retrieval_service=retrieval_service),
        certificate_signer=signer,
    )


def make_tls_port(ip_address: str, port: int = 443) -> PortFinding:
    return PortFinding(
        ip_address=ip_address,
        port=port,
        protocol="tcp",
        service_type=ServiceType.TLS,
    )


def make_vpn_port(ip_address: str, port: int = 500) -> PortFinding:
    return PortFinding(
        ip_address=ip_address,
        port=port,
        protocol="udp",
        service_type=ServiceType.VPN,
    )
