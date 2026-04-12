"""
Phase 3 Live Validation Script
Tests the Discovery Engine components against a safe public target (testssl.sh).
Run this inside or outside docker (does not require DB).
"""

import asyncio
import sys
from pathlib import Path

# Add backend to path so imports work when run directly
sys.path.append(str(Path(__file__).parent.parent.parent))

from backend.discovery.aggregator import aggregate_assets
from backend.discovery.cert_extractor import CertificateExtractor
from backend.discovery.dns_validator import DNSxValidator
from backend.discovery.port_scanner import PortScanner
from backend.discovery.tls_probe import TLSProbe
from backend.discovery.types import TLSScanTarget

TARGET = "testssl.sh"


async def validate_phase3():
    print(f"🚀 Validating Phase 3 Discovery Engine against: {TARGET}\n")

    # 1. DNS Validation
    print("⏳ Running DNS Validation...")
    validator = DNSxValidator(timeout_seconds=10)
    validated_hostnames = await validator.validate([TARGET, f"www.{TARGET}"])

    if not validated_hostnames:
        print("❌ DNS Validation returned no results. Check network connection.")
        return

    for vh in validated_hostnames:
        print(f"  ✅ Resolved {vh.hostname} -> {vh.ip_addresses}")

    # Use an IPv4 address if available to avoid Docker IPv6 routing failures
    ips = validated_hostnames[0].ip_addresses
    target_ip = next((ip for ip in ips if "." in ip), ips[0])

    # 2. Port Scanning
    print(f"\n⏳ Running Port Scan against {target_ip}...")
    scanner = PortScanner(tcp_ports=[443, 8443], udp_ports=[])
    port_findings = await scanner.scan_host(target_ip)

    for pf in port_findings:
        print(f"  ✅ Found open {pf.protocol.upper()} port: {pf.port} ({pf.service_type.name})")

    # 3. TLS Probing
    print(f"\n⏳ Running TLS Probe against {TARGET}:443...")
    tls_probe = TLSProbe(timeout_seconds=10)
    scan_target = TLSScanTarget(hostname=TARGET, ip_address=target_ip, port=443, protocol="tcp")

    tls_results = []
    try:
        result = await tls_probe.probe(scan_target)
        tls_results.append(result)
        print(
            f"  ✅ Handshake successful. Negotiated TLS version: {result.tls_version or 'Unknown'}"
        )
        print(f"  ✅ Cipher Suite: {result.cipher_suite or 'Unknown'}")
        print(f"  ✅ Extracted {len(result.certificate_chain_pem)} certificates from chain")

        # 4. Certificate Extraction
        extractor = CertificateExtractor()
        certs = extractor.extract(result)
        for cert in certs:
            safe_flag = "🛡️ PQC Safe" if cert.quantum_safe else "⚠️ Classical"
            print(
                f"      - [{cert.cert_level.name}] {cert.public_key_algorithm} ({cert.signature_algorithm}) -> {safe_flag}"
            )

    except Exception as e:
        print(f"  ❌ TLS Probe failed: {e}")

    # 5. Aggregation
    print("\n⏳ Testing Aggregator...")
    aggregated = aggregate_assets(
        target=TARGET,
        validated_hostnames=validated_hostnames,
        port_findings=port_findings,
        tls_probe_results=tls_results,
    )

    print(f"  ✅ Aggregator compiled {len(aggregated)} final in-scope assets.")
    for asset in aggregated:
        cert_info = (
            f" (Has {len(asset.certificate_chain_pem)} certs)"
            if asset.certificate_chain_pem
            else ""
        )
        print(
            f"      - {asset.hostname or '<IP Only>'} ({asset.ip_address}:{asset.port}/{asset.protocol}) -> {asset.service_type.name}{cert_info}"
        )

    print(
        "\n✅ Phase 3 Validation Complete! If you see the aggregated assets above, the core discovery logic is flawless."
    )


if __name__ == "__main__":
    asyncio.run(validate_phase3())
