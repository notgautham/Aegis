"""
Shared typed data structures for the discovery engine.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime

from backend.models.enums import CertLevel, ServiceType


@dataclass(frozen=True, slots=True)
class EnumeratedHostname:
    """Hostname discovered during enumeration."""

    hostname: str
    source: str = "amass"


@dataclass(frozen=True, slots=True)
class ValidatedHostname:
    """Hostname validated via DNS resolution."""

    hostname: str
    ip_addresses: tuple[str, ...]
    cnames: tuple[str, ...] = ()
    source: str = "dnsx"


@dataclass(frozen=True, slots=True)
class PortFinding:
    """Open port discovered on an IP address."""

    ip_address: str
    port: int
    protocol: str
    service_type: ServiceType
    state: str = "open"
    service_name: str | None = None


@dataclass(frozen=True, slots=True)
class TLSScanTarget:
    """Target used by the TLS probe."""

    hostname: str | None
    ip_address: str
    port: int
    protocol: str = "tcp"

    @property
    def server_name(self) -> str:
        """Return the preferred name for TLS SNI / logging."""
        return self.hostname or self.ip_address


@dataclass(frozen=True, slots=True)
class TLSProbeResult:
    """Negotiated TLS metadata and raw certificate chain."""

    hostname: str | None
    ip_address: str
    port: int
    protocol: str
    tls_version: str | None
    cipher_suite: str | None
    certificate_chain_pem: tuple[str, ...] = ()
    server_software: str | None = None
    metadata: dict[str, object] = field(default_factory=dict)


@dataclass(frozen=True, slots=True)
class ExtractedCertificate:
    """Certificate metadata extracted from a TLS chain."""

    cert_level: CertLevel
    subject: str | None
    issuer: str | None
    public_key_algorithm: str | None
    key_size_bits: int | None
    signature_algorithm: str | None
    quantum_safe: bool
    not_before: datetime | None
    not_after: datetime | None
    pem: str


@dataclass(frozen=True, slots=True)
class AggregatedAsset:
    """Deduplicated discovery result ready for downstream analysis."""

    hostname: str | None
    ip_address: str
    port: int
    protocol: str
    service_type: ServiceType
    server_software: str | None = None
    tls_version: str | None = None
    cipher_suite: str | None = None
    certificate_chain_pem: tuple[str, ...] = ()


@dataclass(frozen=True, slots=True)
class URLProbeTarget:
    """HTTP endpoint optionally inspected for JWT metadata."""

    url: str
    hostname: str | None = None


@dataclass(frozen=True, slots=True)
class APIInspectionResult:
    """Result of inspecting an API endpoint for JWT / mTLS hints."""

    url: str
    jwt_algorithms: tuple[str, ...]
    mtls_required: bool
    status_code: int | None
    reachable: bool
    headers: dict[str, str] = field(default_factory=dict)


@dataclass(frozen=True, slots=True)
class VPNProbeResult:
    """Partial VPN detection result."""

    ip_address: str
    port: int
    protocol: str
    service_type: ServiceType
    detected_protocol: str | None
    details: dict[str, object] = field(default_factory=dict)
