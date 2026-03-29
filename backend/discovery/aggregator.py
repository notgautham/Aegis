"""
Asset aggregation, deduplication, and scope validation logic.

This module contains the deterministic discovery logic that turns
validated hostnames, port findings, and TLS probe outputs into a
deduplicated list of in-scope cryptographic surfaces.
"""

from __future__ import annotations

import ipaddress
from collections import defaultdict
from dataclasses import dataclass
from typing import Iterable
from urllib.parse import urlsplit

from backend.discovery.types import (
    APIInspectionResult,
    AggregatedAsset,
    PortFinding,
    TLSProbeResult,
    VPNProbeResult,
    ValidatedHostname,
)
from backend.models.enums import ServiceType


def _normalize_hostname(hostname: str | None) -> str | None:
    """Normalize hostnames for comparisons and deduplication."""
    if hostname is None:
        return None
    normalized = hostname.strip().lower().rstrip(".")
    return normalized or None


def _normalize_ip(ip_address: str | None) -> str | None:
    """Normalize IP strings using the stdlib IP parser."""
    if ip_address is None:
        return None
    return str(ipaddress.ip_address(ip_address.strip()))


def _strip_target(target: str) -> str:
    """Normalize raw target input into a hostname/IP/network string."""
    cleaned = target.strip()
    if not cleaned:
        raise ValueError("Target cannot be empty.")

    # Preserve raw CIDR notation; url parsing would incorrectly split the suffix.
    if "/" in cleaned and "://" not in cleaned:
        return cleaned.lower()

    parsed = urlsplit(cleaned if "://" in cleaned else f"//{cleaned}", scheme="")
    if parsed.hostname:
        return parsed.hostname.rstrip(".").lower()
    return cleaned.rstrip(".").lower()


@dataclass(frozen=True, slots=True)
class AuthorizedScope:
    """Parsed representation of an authorized target scope."""

    scope_type: str
    raw_target: str
    domain: str | None = None
    ip_address: ipaddress.IPv4Address | ipaddress.IPv6Address | None = None
    network: ipaddress.IPv4Network | ipaddress.IPv6Network | None = None

    @classmethod
    def from_target(cls, target: str) -> "AuthorizedScope":
        """Parse a target string into a domain, IP, or CIDR scope."""
        normalized = _strip_target(target)

        try:
            ip_value = ipaddress.ip_address(normalized)
        except ValueError:
            ip_value = None

        if ip_value is not None:
            return cls(scope_type="ip", raw_target=normalized, ip_address=ip_value)

        try:
            network_value = ipaddress.ip_network(normalized, strict=False)
        except ValueError:
            network_value = None

        if network_value is not None and "/" in normalized:
            return cls(scope_type="network", raw_target=normalized, network=network_value)

        return cls(scope_type="domain", raw_target=normalized, domain=normalized)

    def contains(self, *, hostname: str | None = None, ip_address: str | None = None) -> bool:
        """Return True when the supplied hostname/IP is authorized by this scope."""
        normalized_hostname = _normalize_hostname(hostname)
        normalized_ip = _normalize_ip(ip_address)

        if self.scope_type == "domain":
            if normalized_hostname is None or self.domain is None:
                return False
            return normalized_hostname == self.domain or normalized_hostname.endswith(
                f".{self.domain}"
            )

        if normalized_ip is None:
            return False

        ip_value = ipaddress.ip_address(normalized_ip)
        if self.scope_type == "ip":
            return ip_value == self.ip_address
        if self.scope_type == "network":
            return ip_value in self.network
        return False


def is_asset_in_scope(target: str, *, hostname: str | None = None, ip_address: str | None = None) -> bool:
    """Convenience helper for validating a discovered surface against target scope."""
    return AuthorizedScope.from_target(target).contains(hostname=hostname, ip_address=ip_address)


def _asset_key(
    hostname: str | None,
    ip_address: str,
    port: int,
    protocol: str,
    service_type: ServiceType,
) -> tuple[str | None, str, int, str, str]:
    """Create a stable deduplication key for aggregated assets."""
    return (
        _normalize_hostname(hostname),
        _normalize_ip(ip_address) or ip_address,
        port,
        protocol.lower(),
        service_type.value,
    )


def _build_ip_hostname_index(
    scope: AuthorizedScope,
    validated_hostnames: Iterable[ValidatedHostname],
) -> dict[str, set[str]]:
    """Map IPs to in-scope validated hostnames."""
    ip_to_hostnames: dict[str, set[str]] = defaultdict(set)
    for validated in validated_hostnames:
        normalized_hostname = _normalize_hostname(validated.hostname)
        if not scope.contains(hostname=normalized_hostname):
            continue
        for ip_address in validated.ip_addresses:
            normalized_ip = _normalize_ip(ip_address)
            if normalized_ip is None:
                continue
            if scope.scope_type in {"ip", "network"} and not scope.contains(ip_address=normalized_ip):
                continue
            ip_to_hostnames[normalized_ip].add(normalized_hostname or validated.hostname)
    return ip_to_hostnames


def aggregate_assets(
    target: str,
    validated_hostnames: Iterable[ValidatedHostname],
    port_findings: Iterable[PortFinding],
    tls_probe_results: Iterable[TLSProbeResult] = (),
    vpn_probe_results: Iterable[VPNProbeResult] = (),
    api_inspection_results: Iterable[APIInspectionResult] = (),
) -> list[AggregatedAsset]:
    """
    Build a deduplicated list of in-scope cryptographic surfaces.

    Domain targets preserve distinct hostname+port assets because
    multiple virtual hosts can share a single IP address while
    terminating different certificates and cipher configurations.
    """

    scope = AuthorizedScope.from_target(target)
    ip_to_hostnames = _build_ip_hostname_index(scope, validated_hostnames)
    assets: dict[tuple[str | None, str, int, str, str], AggregatedAsset] = {}

    for port_finding in port_findings:
        normalized_ip = _normalize_ip(port_finding.ip_address)
        if normalized_ip is None:
            continue

        matching_hostnames = sorted(ip_to_hostnames.get(normalized_ip, set()))
        if matching_hostnames:
            for hostname in matching_hostnames:
                key = _asset_key(
                    hostname,
                    normalized_ip,
                    port_finding.port,
                    port_finding.protocol,
                    port_finding.service_type,
                )
                assets[key] = AggregatedAsset(
                    hostname=hostname,
                    ip_address=normalized_ip,
                    port=port_finding.port,
                    protocol=port_finding.protocol.lower(),
                    service_type=port_finding.service_type,
                )
            continue

        if scope.contains(ip_address=normalized_ip):
            key = _asset_key(
                None,
                normalized_ip,
                port_finding.port,
                port_finding.protocol,
                port_finding.service_type,
            )
            assets[key] = AggregatedAsset(
                hostname=None,
                ip_address=normalized_ip,
                port=port_finding.port,
                protocol=port_finding.protocol.lower(),
                service_type=port_finding.service_type,
            )

    for tls_result in tls_probe_results:
        normalized_ip = _normalize_ip(tls_result.ip_address)
        normalized_hostname = _normalize_hostname(tls_result.hostname)
        if normalized_ip is None:
            continue

        hostnames_for_asset = (
            [normalized_hostname]
            if normalized_hostname and scope.contains(hostname=normalized_hostname, ip_address=normalized_ip)
            else sorted(ip_to_hostnames.get(normalized_ip, set()))
        )

        if not hostnames_for_asset and scope.contains(ip_address=normalized_ip):
            hostnames_for_asset = [None]

        for hostname in hostnames_for_asset:
            key = _asset_key(
                hostname,
                normalized_ip,
                tls_result.port,
                tls_result.protocol,
                ServiceType.TLS,
            )
            existing = assets.get(key)
            assets[key] = AggregatedAsset(
                hostname=hostname,
                ip_address=normalized_ip,
                port=tls_result.port,
                protocol=tls_result.protocol.lower(),
                service_type=existing.service_type if existing else ServiceType.TLS,
                server_software=tls_result.server_software or (existing.server_software if existing else None),
                tls_version=tls_result.tls_version or (existing.tls_version if existing else None),
                cipher_suite=tls_result.cipher_suite or (existing.cipher_suite if existing else None),
                certificate_chain_pem=(
                    tls_result.certificate_chain_pem
                    or (existing.certificate_chain_pem if existing else ())
                ),
                metadata=dict(tls_result.metadata),
            )

    for vpn_result in vpn_probe_results:
        normalized_ip = _normalize_ip(vpn_result.ip_address)
        if normalized_ip is None:
            continue
        key = _asset_key(None, normalized_ip, vpn_result.port, vpn_result.protocol, ServiceType.VPN)
        existing = assets.get(key)
        assets[key] = AggregatedAsset(
            hostname=existing.hostname if existing else None,
            ip_address=normalized_ip,
            port=vpn_result.port,
            protocol=vpn_result.protocol,
            service_type=ServiceType.VPN,
            metadata=dict(vpn_result.details),
        )

    for api_result in api_inspection_results:
        # API results are often tied to web ports (80/443)
        # We try to find a matching asset based on URL components
        parsed = urlsplit(api_result.url)
        port = parsed.port or (443 if parsed.scheme == "https" else 80)
        host = parsed.hostname
        if not host:
            continue
        
        # This is a heuristic match
        for key, asset in assets.items():
            if asset.port == port and (asset.hostname == host or asset.ip_address == host):
                asset.metadata.update(api_result.metadata)
                asset.metadata["jwt_algorithms"] = api_result.jwt_algorithms
                asset.metadata["mtls_required"] = api_result.mtls_required

    return sorted(
        assets.values(),
        key=lambda asset: (
            asset.hostname or "",
            asset.ip_address,
            asset.port,
            asset.protocol,
            asset.service_type.value,
        ),
    )
