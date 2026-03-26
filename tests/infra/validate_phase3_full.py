"""
Comprehensive Phase 3 validation runner.

This script combines:
- import / wiring checks for every Phase 3 module
- deterministic unit-style checks for scope validation and aggregation
- lightweight checks for optional helpers
- live discovery checks against a safe public target

The output is a pass/fail/skip report so Phase 3 readiness is easy to
evaluate before moving on to Phase 4.

Run examples:
    python tests/infra/validate_phase3_full.py
    python tests/infra/validate_phase3_full.py --target testssl.sh
    python tests/infra/validate_phase3_full.py --offline
"""

from __future__ import annotations

import argparse
import asyncio
import importlib
import shutil
import sys
import traceback
from dataclasses import dataclass
from pathlib import Path
from typing import Awaitable, Callable


sys.path.append(str(Path(__file__).parent.parent.parent))


CheckFn = Callable[[], None | Awaitable[None]]


@dataclass(slots=True)
class CheckResult:
    """Result for a single validation check."""

    name: str
    status: str
    detail: str


class SkipCheck(Exception):
    """Raised when a check cannot run in the current environment."""


def _print_header(title: str) -> None:
    print(f"\n{'=' * 78}\n{title}\n{'=' * 78}")


async def _run_check(name: str, fn: CheckFn) -> CheckResult:
    """Run a sync or async check and normalize the result."""
    try:
        outcome = fn()
        if asyncio.iscoroutine(outcome):
            await outcome
        return CheckResult(name=name, status="PASS", detail="ok")
    except SkipCheck as exc:
        return CheckResult(name=name, status="SKIP", detail=str(exc))
    except Exception as exc:  # noqa: BLE001
        return CheckResult(name=name, status="FAIL", detail=f"{exc.__class__.__name__}: {exc}")


def _print_result(result: CheckResult) -> None:
    """Print a formatted result line."""
    print(f"[{result.status:<4}] {result.name} :: {result.detail}")


def _assert(condition: bool, message: str) -> None:
    """Small assertion helper with readable failures."""
    if not condition:
        raise AssertionError(message)


def _check_module_imports() -> None:
    """Ensure every Phase 3 module imports successfully."""
    modules = [
        "backend.discovery",
        "backend.discovery.types",
        "backend.discovery.dns_enumerator",
        "backend.discovery.dns_validator",
        "backend.discovery.port_scanner",
        "backend.discovery.tls_probe",
        "backend.discovery.cert_extractor",
        "backend.discovery.aggregator",
        "backend.discovery.api_inspector",
        "backend.discovery.vpn_probe",
    ]
    for module_name in modules:
        importlib.import_module(module_name)


def _check_scope_validation() -> None:
    """Verify domain, IP, and CIDR scope handling."""
    from backend.discovery.aggregator import AuthorizedScope, is_asset_in_scope

    domain_scope = AuthorizedScope.from_target("example.com")
    _assert(domain_scope.contains(hostname="example.com"), "root domain should match")
    _assert(domain_scope.contains(hostname="api.example.com"), "subdomain should match")
    _assert(
        not domain_scope.contains(hostname="api.example.com.evil.test"),
        "nested foreign domain must not match",
    )

    _assert(
        is_asset_in_scope("203.0.113.10", ip_address="203.0.113.10"),
        "exact IP target should match itself",
    )
    _assert(
        not is_asset_in_scope("203.0.113.10", ip_address="203.0.113.11"),
        "different IP must not match",
    )

    cidr_scope = AuthorizedScope.from_target("10.0.0.0/24")
    _assert(cidr_scope.contains(ip_address="10.0.0.9"), "CIDR in-range IP should match")
    _assert(not cidr_scope.contains(ip_address="10.0.1.9"), "CIDR out-of-range IP must fail")


def _check_aggregator_deduplication() -> None:
    """Verify duplicate findings collapse into one aggregated asset."""
    from backend.discovery.aggregator import aggregate_assets
    from backend.discovery.types import PortFinding, TLSProbeResult, ValidatedHostname
    from backend.models.enums import ServiceType

    validated = [
        ValidatedHostname(hostname="api.example.com", ip_addresses=("203.0.113.10",)),
        ValidatedHostname(hostname="api.example.com", ip_addresses=("203.0.113.10",)),
    ]
    ports = [
        PortFinding("203.0.113.10", 443, "tcp", ServiceType.TLS),
        PortFinding("203.0.113.10", 443, "tcp", ServiceType.TLS),
    ]
    tls = [
        TLSProbeResult(
            hostname="api.example.com",
            ip_address="203.0.113.10",
            port=443,
            protocol="tcp",
            tls_version="TLSv1.3",
            cipher_suite="TLS_AES_256_GCM_SHA384",
            server_software="nginx",
        )
    ]

    assets = aggregate_assets("example.com", validated, ports, tls)
    _assert(len(assets) == 1, f"expected 1 deduplicated asset, got {len(assets)}")
    _assert(assets[0].server_software == "nginx", "TLS metadata should be merged onto asset")


def _check_aggregator_shared_ip_behavior() -> None:
    """Verify virtual hosts on the same IP remain separate for domain targets."""
    from backend.discovery.aggregator import aggregate_assets
    from backend.discovery.types import PortFinding, ValidatedHostname
    from backend.models.enums import ServiceType

    validated = [
        ValidatedHostname(hostname="api.example.com", ip_addresses=("203.0.113.10",)),
        ValidatedHostname(hostname="www.example.com", ip_addresses=("203.0.113.10",)),
    ]
    ports = [PortFinding("203.0.113.10", 443, "tcp", ServiceType.TLS)]

    assets = aggregate_assets("example.com", validated, ports)
    hostnames = {asset.hostname for asset in assets}
    _assert(len(assets) == 2, f"expected 2 assets, got {len(assets)}")
    _assert(hostnames == {"api.example.com", "www.example.com"}, "both virtual hosts must remain")


def _check_aggregator_network_target_behavior() -> None:
    """Verify raw IP assets are retained for network targets."""
    from backend.discovery.aggregator import aggregate_assets
    from backend.discovery.types import PortFinding
    from backend.models.enums import ServiceType

    assets = aggregate_assets(
        "10.0.0.0/24",
        [],
        [PortFinding("10.0.0.10", 500, "udp", ServiceType.VPN)],
    )
    _assert(len(assets) == 1, f"expected 1 IP asset, got {len(assets)}")
    _assert(assets[0].hostname is None, "network target asset should be IP-only")
    _assert(assets[0].service_type == ServiceType.VPN, "service type should remain VPN")


def _check_api_inspector_jwt_parsing() -> None:
    """Verify JWT alg extraction works for a sample token header."""
    from backend.discovery.api_inspector import APIInspector

    token = "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.payload.signature"
    alg = APIInspector._extract_jwt_alg(token)
    _assert(alg == "RS256", f"expected RS256, got {alg}")


def _check_vpn_probe_classification() -> None:
    """Verify VPN probe classifies IKEv2 and OpenVPN candidate ports."""
    from backend.discovery.vpn_probe import VPNProbe

    probe = VPNProbe()
    ike = probe.probe("203.0.113.10", 500, "udp")
    ovpn = probe.probe("203.0.113.10", 1194, "tcp")
    _assert(ike.detected_protocol == "ikev2", "UDP/500 should classify as IKEv2")
    _assert(ovpn.detected_protocol == "openvpn", "1194 should classify as OpenVPN")


def _check_port_service_inference() -> None:
    """Verify service type inference on well-known Phase 3 ports."""
    from backend.discovery.port_scanner import PortScanner
    from backend.models.enums import ServiceType

    _assert(
        PortScanner._infer_service_type(443, "tcp") == ServiceType.TLS,
        "443/tcp should classify as TLS",
    )
    _assert(
        PortScanner._infer_service_type(500, "udp") == ServiceType.VPN,
        "500/udp should classify as VPN",
    )


async def _check_live_dns_validation(target: str) -> None:
    """Run live DNS validation against the target."""
    from backend.discovery.dns_validator import DNSxValidator

    validator = DNSxValidator(timeout_seconds=10)
    validated = await validator.validate([target, f"www.{target}"])
    _assert(validated, "DNS validation returned no results")


async def _check_live_amass_enumerator(target: str) -> None:
    """Run live Amass enumeration when the binary is available."""
    from backend.discovery.dns_enumerator import AmassEnumerator

    if shutil.which("amass") is None:
        raise SkipCheck("amass binary not available")

    enumerator = AmassEnumerator(timeout_seconds=300)
    results = await enumerator.enumerate(target)
    _assert(isinstance(results, list), "amass enumeration should return a list")


async def _check_live_port_scan(target: str) -> None:
    """Run a live port scan against the resolved target."""
    from backend.discovery.dns_validator import DNSxValidator
    from backend.discovery.port_scanner import PortScanner

    validator = DNSxValidator(timeout_seconds=10)
    validated = await validator.validate([target])
    _assert(validated, "could not resolve target before scanning")
    ips = validated[0].ip_addresses
    target_ip = next((ip for ip in ips if "." in ip), ips[0])

    scanner = PortScanner(tcp_ports=[443, 8443], udp_ports=[])
    findings = await scanner.scan_host(target_ip)
    _assert(isinstance(findings, list), "port scan should return a list")
    _assert(any(f.port == 443 for f in findings), "expected 443/tcp to be open on target")


async def _check_live_tls_probe_and_certs(target: str) -> None:
    """Run a live TLS probe and certificate extraction."""
    from backend.discovery.cert_extractor import CertificateExtractor
    from backend.discovery.dns_validator import DNSxValidator
    from backend.discovery.tls_probe import TLSProbe
    from backend.discovery.types import TLSScanTarget

    validator = DNSxValidator(timeout_seconds=10)
    validated = await validator.validate([target])
    _assert(validated, "could not resolve target before TLS probing")
    ips = validated[0].ip_addresses
    target_ip = next((ip for ip in ips if "." in ip), ips[0])

    probe = TLSProbe(timeout_seconds=10)
    result = await probe.probe(
        TLSScanTarget(
            hostname=target,
            ip_address=target_ip,
            port=443,
            protocol="tcp",
        )
    )
    _assert(result.tls_version is not None, "TLS version should be present")
    _assert(result.cipher_suite is not None, "cipher suite should be present")
    _assert(result.certificate_chain_pem, "certificate chain should not be empty")

    extractor = CertificateExtractor()
    certs = extractor.extract(result)
    _assert(certs, "certificate extractor should return at least one certificate")


async def _check_live_aggregator_end_to_end(target: str) -> None:
    """Run an end-to-end discovery aggregation check."""
    from backend.discovery.aggregator import aggregate_assets
    from backend.discovery.dns_validator import DNSxValidator
    from backend.discovery.port_scanner import PortScanner
    from backend.discovery.tls_probe import TLSProbe
    from backend.discovery.types import TLSScanTarget

    validator = DNSxValidator(timeout_seconds=10)
    validated = await validator.validate([target, f"www.{target}"])
    _assert(validated, "DNS validation returned no results")

    ips = validated[0].ip_addresses
    target_ip = next((ip for ip in ips if "." in ip), ips[0])

    scanner = PortScanner(tcp_ports=[443, 8443], udp_ports=[])
    port_findings = await scanner.scan_host(target_ip)

    probe = TLSProbe(timeout_seconds=10)
    tls_results = []
    try:
        tls_results.append(
            await probe.probe(
                TLSScanTarget(
                    hostname=target,
                    ip_address=target_ip,
                    port=443,
                    protocol="tcp",
                )
            )
        )
    except Exception as exc:  # noqa: BLE001
        raise AssertionError(f"TLS probe failed during aggregation check: {exc}") from exc

    aggregated = aggregate_assets(
        target=target,
        validated_hostnames=validated,
        port_findings=port_findings,
        tls_probe_results=tls_results,
    )
    _assert(aggregated, "aggregator returned no final assets")


async def main() -> int:
    """Run all configured checks and print a summary."""
    parser = argparse.ArgumentParser(description="Validate Phase 3 Discovery Engine.")
    parser.add_argument("--target", default="testssl.sh", help="safe public target for live checks")
    parser.add_argument(
        "--offline",
        action="store_true",
        help="run deterministic checks only and skip all live network checks",
    )
    args = parser.parse_args()

    results: list[CheckResult] = []

    deterministic_checks: list[tuple[str, CheckFn]] = [
        ("Import all Phase 3 modules", _check_module_imports),
        ("Scope validation logic", _check_scope_validation),
        ("Aggregator deduplication", _check_aggregator_deduplication),
        ("Aggregator shared-IP behavior", _check_aggregator_shared_ip_behavior),
        ("Aggregator network-target behavior", _check_aggregator_network_target_behavior),
        ("API inspector JWT parsing", _check_api_inspector_jwt_parsing),
        ("VPN probe classification", _check_vpn_probe_classification),
        ("Port service inference", _check_port_service_inference),
    ]

    live_checks: list[tuple[str, CheckFn]] = [
        (f"Live DNS validation against {args.target}", lambda: _check_live_dns_validation(args.target)),
        (f"Live Amass enumeration against {args.target}", lambda: _check_live_amass_enumerator(args.target)),
        (f"Live port scan against {args.target}", lambda: _check_live_port_scan(args.target)),
        (f"Live TLS probe and cert extraction against {args.target}", lambda: _check_live_tls_probe_and_certs(args.target)),
        (f"Live end-to-end aggregation against {args.target}", lambda: _check_live_aggregator_end_to_end(args.target)),
    ]

    _print_header("Phase 3 Deterministic Checks")
    for name, fn in deterministic_checks:
        result = await _run_check(name, fn)
        results.append(result)
        _print_result(result)

    _print_header("Phase 3 Live Checks")
    if args.offline:
        for name, _ in live_checks:
            result = CheckResult(name=name, status="SKIP", detail="offline mode requested")
            results.append(result)
            _print_result(result)
    else:
        for name, fn in live_checks:
            result = await _run_check(name, fn)
            results.append(result)
            _print_result(result)

    passed = sum(result.status == "PASS" for result in results)
    failed = sum(result.status == "FAIL" for result in results)
    skipped = sum(result.status == "SKIP" for result in results)

    _print_header("Phase 3 Summary")
    print(f"PASS   : {passed}")
    print(f"FAIL   : {failed}")
    print(f"SKIP   : {skipped}")

    if failed:
        print("\nPhase 3 is NOT fully validated yet. Review the failed checks above.")
        return 1

    print("\nPhase 3 validation completed with no failures.")
    if skipped:
        print("Some checks were skipped due to environment/tool availability.")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(asyncio.run(main()))
    except KeyboardInterrupt:
        print("\nValidation interrupted by user.")
        raise SystemExit(130)
