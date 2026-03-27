"""
Unit tests for Phase 3 port scanning configuration and result extraction.
"""

from __future__ import annotations

import sys
import types

import pytest

from backend.discovery.port_scanner import PortScanner, PortScannerError


def test_scan_host_uses_bounded_nmap_arguments(monkeypatch: pytest.MonkeyPatch) -> None:
    captured_calls: list[tuple[str, str]] = []

    class FakePortScanner:
        def scan(self, *, hosts: str, arguments: str) -> None:
            captured_calls.append((hosts, arguments))

        def all_hosts(self) -> list[str]:
            return ["198.51.100.10"]

        def __getitem__(self, ip_address: str):
            return {
                "tcp": {443: {"state": "open", "name": "https"}},
                "udp": {500: {"state": "open", "name": "isakmp"}},
            }

    fake_module = types.SimpleNamespace(PortScanner=FakePortScanner)
    monkeypatch.setitem(sys.modules, "nmap", fake_module)

    scanner = PortScanner(
        tcp_ports=[443],
        udp_ports=[500],
        host_timeout_seconds=30,
        max_retries=1,
    )
    findings = scanner._scan_host_sync("198.51.100.10")

    assert len(captured_calls) == 2
    assert captured_calls[0] == (
        "198.51.100.10",
        "-Pn -n -T4 --max-retries 1 --host-timeout 30s -sS -p 443",
    )
    assert captured_calls[1] == (
        "198.51.100.10",
        "-Pn -n -T4 --max-retries 1 --host-timeout 30s -sU -p 500",
    )
    assert {(finding.protocol, finding.port) for finding in findings} == {
        ("tcp", 443),
        ("udp", 500),
    }


def test_scan_host_wraps_nmap_errors(monkeypatch: pytest.MonkeyPatch) -> None:
    class FakePortScanner:
        def scan(self, *, hosts: str, arguments: str) -> None:
            raise RuntimeError("nmap timed out")

    fake_module = types.SimpleNamespace(PortScanner=FakePortScanner)
    monkeypatch.setitem(sys.modules, "nmap", fake_module)

    scanner = PortScanner(tcp_ports=[443], udp_ports=[])

    with pytest.raises(PortScannerError, match="Port scan failed for 198.51.100.10"):
        scanner._scan_host_sync("198.51.100.10")
