"""
Optional partial VPN detection.
"""

from __future__ import annotations

from backend.discovery.types import VPNProbeResult
from backend.models.enums import ServiceType


class VPNProbe:
    """Perform lightweight VPN protocol classification from known service ports."""

    def probe(self, ip_address: str, port: int, protocol: str) -> VPNProbeResult:
        """Return a partial VPN classification based on well-known ports."""
        detected_protocol: str | None = None
        details: dict[str, object] = {}

        if protocol.lower() == "udp" and port in {500, 4500}:
            detected_protocol = "ikev2"
            details["phase"] = "SA_INIT candidate"
        elif port == 1194:
            detected_protocol = "openvpn"
            details["transport"] = protocol.lower()

        return VPNProbeResult(
            ip_address=ip_address,
            port=port,
            protocol=protocol.lower(),
            service_type=ServiceType.VPN,
            detected_protocol=detected_protocol,
            details=details,
        )
