"""
Port scanning using python-nmap.
"""

from __future__ import annotations

import asyncio
from collections.abc import Iterable

from backend.discovery.types import PortFinding
from backend.models.enums import ServiceType


DEFAULT_TCP_PORTS = (443, 8443, 4443)
DEFAULT_UDP_PORTS = (500, 4500, 1194)


class PortScannerError(RuntimeError):
    """Raised when a port scan cannot be completed."""


class PortScanner:
    """Scan cryptographic service ports using python-nmap."""

    def __init__(
        self,
        tcp_ports: Iterable[int] = DEFAULT_TCP_PORTS,
        udp_ports: Iterable[int] = DEFAULT_UDP_PORTS,
        *,
        host_timeout_seconds: int = 45,
        max_retries: int = 1,
    ) -> None:
        self.tcp_ports = tuple(sorted(set(tcp_ports)))
        self.udp_ports = tuple(sorted(set(udp_ports)))
        self.host_timeout_seconds = max(1, int(host_timeout_seconds))
        self.max_retries = max(0, int(max_retries))

    async def scan_host(
        self,
        ip_address: str,
        *,
        full_tcp_scan: bool = False,
    ) -> list[PortFinding]:
        """Scan a single IP for relevant TCP and UDP ports."""
        return await asyncio.to_thread(
            self._scan_host_sync,
            ip_address,
            full_tcp_scan,
        )

    def _scan_host_sync(self, ip_address: str, full_tcp_scan: bool = False) -> list[PortFinding]:
        """Run the actual nmap scans synchronously."""
        try:
            import nmap
        except ImportError as exc:
            raise PortScannerError("python-nmap is required for port scanning.") from exc

        scanner = nmap.PortScanner()
        findings: dict[tuple[str, int, str], PortFinding] = {}

        if self.tcp_ports:
            # Always run bounded scan first so critical TLS ports are captured quickly.
            tcp_arguments = self._build_scan_arguments(
                scan_type="-sS",
                ports=self.tcp_ports,
                full_scan=False,
            )
            self._run_scan(scanner, ip_address, tcp_arguments)
            self._collect_findings(scanner, ip_address, "tcp", findings)

            # Full mode augments (does not replace) bounded scan findings.
            if full_tcp_scan:
                tcp_full_arguments = self._build_scan_arguments(
                    scan_type="-sS",
                    ports=self.tcp_ports,
                    full_scan=True,
                    host_timeout_seconds_override=self.host_timeout_seconds * 4,
                )
                self._run_scan(scanner, ip_address, tcp_full_arguments)
                self._collect_findings(scanner, ip_address, "tcp", findings)

        if self.udp_ports:
            udp_arguments = self._build_scan_arguments(
                scan_type="-sU",
                ports=self.udp_ports,
            )
            self._run_scan(scanner, ip_address, udp_arguments)
            self._collect_findings(scanner, ip_address, "udp", findings)

        return sorted(findings.values(), key=lambda finding: (finding.protocol, finding.port))

    def _build_scan_arguments(
        self,
        *,
        scan_type: str,
        ports: tuple[int, ...],
        full_scan: bool = False,
        host_timeout_seconds_override: int | None = None,
    ) -> str:
        timeout_seconds = host_timeout_seconds_override or self.host_timeout_seconds
        host_timeout = f"{max(1, int(timeout_seconds))}s"
        ports_arg = "-" if full_scan and scan_type == "-sS" else ",".join(str(port) for port in ports)
        return (
            f"-Pn -n -T4 --max-retries {self.max_retries} "
            f"--host-timeout {host_timeout} {scan_type} -p {ports_arg}"
        )

    @staticmethod
    def _run_scan(scanner, ip_address: str, arguments: str) -> None:
        try:
            scanner.scan(hosts=ip_address, arguments=arguments)
        except Exception as exc:
            raise PortScannerError(f"Port scan failed for {ip_address}: {exc}") from exc

    def _collect_findings(
        self,
        scanner,
        ip_address: str,
        protocol: str,
        findings: dict[tuple[str, int, str], PortFinding],
    ) -> None:
        """Extract open ports from an nmap scan result."""
        if ip_address not in scanner.all_hosts():
            return

        protocol_results = scanner[ip_address].get(protocol, {})
        for port, metadata in protocol_results.items():
            if metadata.get("state") != "open":
                continue
            key = (ip_address, port, protocol)
            findings[key] = PortFinding(
                ip_address=ip_address,
                port=int(port),
                protocol=protocol,
                service_type=self._infer_service_type(int(port), protocol),
                service_name=metadata.get("name"),
            )

    @staticmethod
    def _infer_service_type(port: int, protocol: str) -> ServiceType:
        """Infer the broad service category from the protocol and port."""
        if protocol == "udp" and port in {500, 4500, 1194}:
            return ServiceType.VPN
        if protocol == "tcp" and port in {443, 8443, 4443, 1194}:
            return ServiceType.TLS
        return ServiceType.API
