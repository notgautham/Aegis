"""
DNS validation and resolution using DNSx with a stdlib fallback.
"""

from __future__ import annotations

import asyncio
import json
import shutil
import socket
from typing import Iterable

from backend.discovery.types import ValidatedHostname


class DNSValidationError(RuntimeError):
    """Raised when DNS validation cannot be completed."""


class DNSxValidator:
    """Validate hostnames and resolve them to live IP addresses."""

    def __init__(self, binary: str = "dnsx", timeout_seconds: int = 120) -> None:
        self.binary = binary
        self.timeout_seconds = timeout_seconds

    async def validate(self, hostnames: Iterable[str]) -> list[ValidatedHostname]:
        """Validate the provided hostnames using DNSx or a Python fallback."""
        normalized_hostnames = sorted(
            {
                hostname.strip().lower().rstrip(".")
                for hostname in hostnames
                if hostname and hostname.strip()
            }
        )
        if not normalized_hostnames:
            return []

        if shutil.which(self.binary):
            return await self._validate_with_dnsx(normalized_hostnames)
        return await self._validate_with_socket(normalized_hostnames)

    async def _validate_with_dnsx(self, hostnames: list[str]) -> list[ValidatedHostname]:
        """Run DNSx in JSON mode and parse its results."""
        process = await asyncio.create_subprocess_exec(
            self.binary,
            "-silent",
            "-resp",
            "-a",
            "-json",
            stdin=asyncio.subprocess.PIPE,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )

        payload = ("\n".join(hostnames) + "\n").encode("utf-8")
        try:
            stdout, stderr = await asyncio.wait_for(
                process.communicate(payload),
                timeout=self.timeout_seconds,
            )
        except asyncio.TimeoutError as exc:
            process.kill()
            await process.communicate()
            raise DNSValidationError(
                f"DNSx validation timed out after {self.timeout_seconds} seconds."
            ) from exc

        if process.returncode != 0:
            raise DNSValidationError(stderr.decode("utf-8", errors="ignore").strip())

        records: dict[str, ValidatedHostname] = {}
        for line in stdout.decode("utf-8", errors="ignore").splitlines():
            line = line.strip()
            if not line:
                continue

            try:
                parsed = json.loads(line)
            except json.JSONDecodeError:
                continue

            hostname = (
                str(parsed.get("host") or parsed.get("hostname") or parsed.get("input") or "")
                .strip()
                .lower()
                .rstrip(".")
            )
            answers = parsed.get("a") or parsed.get("answers") or parsed.get("ip") or []
            cnames = parsed.get("cname") or []

            ip_addresses = self._normalize_answer_list(answers)
            cname_values = tuple(
                sorted(
                    {
                        str(value).strip().lower().rstrip(".")
                        for value in self._normalize_answer_list(cnames)
                        if value
                    }
                )
            )

            if hostname and ip_addresses:
                records[hostname] = ValidatedHostname(
                    hostname=hostname,
                    ip_addresses=ip_addresses,
                    cnames=cname_values,
                )

        return sorted(records.values(), key=lambda record: record.hostname)

    async def _validate_with_socket(self, hostnames: list[str]) -> list[ValidatedHostname]:
        """Resolve hostnames using socket.getaddrinfo when DNSx is unavailable."""
        results = await asyncio.gather(
            *(self._resolve_hostname(hostname) for hostname in hostnames),
        )
        validated = [result for result in results if result is not None]
        return sorted(validated, key=lambda record: record.hostname)

    async def _resolve_hostname(self, hostname: str) -> ValidatedHostname | None:
        """Resolve a single hostname in a worker thread."""
        try:
            infos = await asyncio.to_thread(
                socket.getaddrinfo, hostname, None, proto=socket.IPPROTO_TCP
            )
        except socket.gaierror:
            return None

        ip_addresses = tuple(
            sorted({info[4][0] for info in infos if info and len(info) >= 5 and info[4]})
        )
        if not ip_addresses:
            return None
        return ValidatedHostname(hostname=hostname, ip_addresses=ip_addresses, source="socket")

    @staticmethod
    def _normalize_answer_list(value: object) -> tuple[str, ...]:
        """Convert DNSx answer fields into a tuple of strings."""
        if isinstance(value, str):
            return (value,)
        if isinstance(value, list):
            return tuple(str(item) for item in value)
        return ()
