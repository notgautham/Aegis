"""
Unit tests for discovery asset aggregation and scope validation.
"""

from backend.discovery.aggregator import AuthorizedScope, aggregate_assets, is_asset_in_scope
from backend.discovery.types import PortFinding, TLSProbeResult, ValidatedHostname
from backend.models.enums import ServiceType


def test_domain_scope_accepts_root_and_subdomains_only() -> None:
    """Domain scopes should accept exact hosts and proper subdomains."""
    scope = AuthorizedScope.from_target("example.com")

    assert scope.contains(hostname="example.com")
    assert scope.contains(hostname="api.example.com")
    assert not scope.contains(hostname="api.example.com.evil.com")
    assert not scope.contains(hostname="example.org")


def test_ip_and_cidr_scope_validation() -> None:
    """IP and CIDR targets should validate only matching addresses."""
    assert is_asset_in_scope("203.0.113.10", ip_address="203.0.113.10")
    assert not is_asset_in_scope("203.0.113.10", ip_address="203.0.113.11")

    network_scope = AuthorizedScope.from_target("10.0.0.0/24")
    assert network_scope.contains(ip_address="10.0.0.1")
    assert not network_scope.contains(ip_address="10.0.1.1")


def test_aggregate_assets_deduplicates_duplicate_findings() -> None:
    """Duplicate hostname/IP/port combinations should collapse into one asset."""
    validated = [
        ValidatedHostname(hostname="api.example.com", ip_addresses=("203.0.113.10",)),
        ValidatedHostname(hostname="api.example.com", ip_addresses=("203.0.113.10",)),
    ]
    ports = [
        PortFinding(
            ip_address="203.0.113.10",
            port=443,
            protocol="tcp",
            service_type=ServiceType.TLS,
        ),
        PortFinding(
            ip_address="203.0.113.10",
            port=443,
            protocol="tcp",
            service_type=ServiceType.TLS,
        ),
    ]
    tls_results = [
        TLSProbeResult(
            hostname="api.example.com",
            ip_address="203.0.113.10",
            port=443,
            protocol="tcp",
            tls_version="TLSv1.3",
            cipher_suite="TLS_AES_256_GCM_SHA384",
            certificate_chain_pem=(),
            server_software="nginx",
        )
    ]

    assets = aggregate_assets("example.com", validated, ports, tls_results)

    assert len(assets) == 1
    assert assets[0].hostname == "api.example.com"
    assert assets[0].server_software == "nginx"
    assert assets[0].tls_version == "TLSv1.3"


def test_aggregate_assets_preserves_multiple_hostnames_on_shared_ip() -> None:
    """Distinct virtual hosts on one IP must remain distinct assets."""
    validated = [
        ValidatedHostname(hostname="api.example.com", ip_addresses=("203.0.113.10",)),
        ValidatedHostname(hostname="www.example.com", ip_addresses=("203.0.113.10",)),
    ]
    ports = [
        PortFinding(
            ip_address="203.0.113.10",
            port=443,
            protocol="tcp",
            service_type=ServiceType.TLS,
        )
    ]

    assets = aggregate_assets("example.com", validated, ports)

    assert len(assets) == 2
    assert {asset.hostname for asset in assets} == {"api.example.com", "www.example.com"}


def test_aggregate_assets_skips_out_of_scope_domain_assets() -> None:
    """Port findings without an in-scope hostname should be ignored for domain targets."""
    validated = [
        ValidatedHostname(hostname="api.example.com", ip_addresses=("203.0.113.10",)),
    ]
    ports = [
        PortFinding(
            ip_address="198.51.100.77",
            port=443,
            protocol="tcp",
            service_type=ServiceType.TLS,
        )
    ]

    assets = aggregate_assets("example.com", validated, ports)

    assert assets == []


def test_aggregate_assets_keeps_raw_ip_assets_for_network_targets() -> None:
    """Network scans should keep IP-based assets even without hostname enrichment."""
    ports = [
        PortFinding(
            ip_address="10.0.0.10",
            port=500,
            protocol="udp",
            service_type=ServiceType.VPN,
        )
    ]

    assets = aggregate_assets("10.0.0.0/24", [], ports)

    assert len(assets) == 1
    assert assets[0].hostname is None
    assert assets[0].ip_address == "10.0.0.10"
    assert assets[0].service_type == ServiceType.VPN
