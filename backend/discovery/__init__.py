"""
Aegis Discovery Engine package.

Phase 3 modules for DNS enumeration, validation, port scanning,
TLS probing, certificate extraction, scope validation, and
asset aggregation.
"""

from backend.discovery.aggregator import (
    AuthorizedScope,
    aggregate_assets,
    is_asset_in_scope,
)
from backend.discovery.api_inspector import APIInspector
from backend.discovery.cert_extractor import CertificateExtractor
from backend.discovery.dns_enumerator import AmassEnumerator
from backend.discovery.dns_validator import DNSxValidator
from backend.discovery.port_scanner import PortScanner
from backend.discovery.tls_probe import TLSProbe
from backend.discovery.types import (
    APIInspectionResult,
    AggregatedAsset,
    EnumeratedHostname,
    ExtractedCertificate,
    PortFinding,
    TLSProbeResult,
    TLSScanTarget,
    URLProbeTarget,
    ValidatedHostname,
    VPNProbeResult,
)
from backend.discovery.vpn_probe import VPNProbe

__all__ = [
    "APIInspectionResult",
    "APIInspector",
    "AggregatedAsset",
    "AmassEnumerator",
    "AuthorizedScope",
    "CertificateExtractor",
    "DNSxValidator",
    "EnumeratedHostname",
    "ExtractedCertificate",
    "PortFinding",
    "PortScanner",
    "TLSProbe",
    "TLSProbeResult",
    "TLSScanTarget",
    "URLProbeTarget",
    "ValidatedHostname",
    "VPNProbe",
    "VPNProbeResult",
    "aggregate_assets",
    "is_asset_in_scope",
]
