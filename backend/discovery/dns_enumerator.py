"""
Amass-backed subdomain enumeration.
"""

from __future__ import annotations

import asyncio
import shutil

from backend.discovery.aggregator import AuthorizedScope
from backend.discovery.types import EnumeratedHostname


class DNSEnumerationError(RuntimeError):
    """Raised when enumeration cannot be completed."""


class AmassEnumerator:
    """Thin async wrapper around Amass passive enumeration."""

    def __init__(self, binary: str = "amass", timeout_seconds: int = 300) -> None:
        self.binary = binary
        self.timeout_seconds = timeout_seconds

    async def enumerate(self, target: str) -> list[EnumeratedHostname]:
        """Enumerate hostnames for a domain target using Amass passive mode."""
        scope = AuthorizedScope.from_target(target)
        if scope.scope_type != "domain" or scope.domain is None:
            return []

        if shutil.which(self.binary) is None:
            raise DNSEnumerationError(f"Amass binary not found: {self.binary}")

        process = await asyncio.create_subprocess_exec(
            self.binary,
            "enum",
            "-passive",
            "-d",
            scope.domain,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )

        try:
            stdout, stderr = await asyncio.wait_for(
                process.communicate(),
                timeout=self.timeout_seconds,
            )
        except asyncio.TimeoutError as exc:
            process.kill()
            await process.communicate()
            raise DNSEnumerationError(
                f"Amass enumeration timed out after {self.timeout_seconds} seconds."
            ) from exc

        if process.returncode != 0:
            raise DNSEnumerationError(stderr.decode("utf-8", errors="ignore").strip())

        records: dict[str, EnumeratedHostname] = {}
        for line in stdout.decode("utf-8", errors="ignore").splitlines():
            hostname = line.strip().lower().rstrip(".")
            if not hostname:
                continue
            if hostname == scope.domain or hostname.endswith(f".{scope.domain}"):
                records[hostname] = EnumeratedHostname(hostname=hostname, source="amass-passive")

        return sorted(records.values(), key=lambda record: record.hostname)
