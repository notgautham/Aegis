"""
Amass-backed subdomain enumeration.
"""

from __future__ import annotations

import asyncio
import json
import shutil
import subprocess
from urllib.error import HTTPError, URLError
from urllib.request import urlopen

from backend.discovery.aggregator import AuthorizedScope
from backend.discovery.types import EnumeratedHostname


class DNSEnumerationError(RuntimeError):
    """Raised when enumeration cannot be completed."""


class AmassEnumerator:
    """Thin async wrapper around Amass passive enumeration."""

    def __init__(
        self,
        binary: str = "amass",
        timeout_seconds: int = 120,
        fallback_max_hostnames: int = 300,
    ) -> None:
        self.binary = binary
        self.timeout_seconds = timeout_seconds
        self.fallback_max_hostnames = fallback_max_hostnames

    async def enumerate(self, target: str) -> list[EnumeratedHostname]:
        """Enumerate hostnames for a domain target using Amass passive mode."""
        scope = AuthorizedScope.from_target(target)
        if scope.scope_type != "domain" or scope.domain is None:
            return []

        if shutil.which(self.binary) is None:
            fallback = await self._enumerate_with_crtsh(scope.domain)
            if fallback:
                return fallback
            raise DNSEnumerationError(f"Amass binary not found: {self.binary}")

        def _run_amass() -> subprocess.CompletedProcess[str]:
            return subprocess.run(
                [
                    self.binary,
                    "enum",
                    "-passive",
                    "-timeout",
                    "2",
                    "-d",
                    scope.domain,
                ],
                capture_output=True,
                text=True,
                timeout=self.timeout_seconds,
                check=False,
            )

        try:
            completed = await asyncio.to_thread(_run_amass)
        except subprocess.TimeoutExpired as exc:
            fallback = await self._enumerate_with_crtsh(scope.domain)
            if fallback:
                return fallback
            raise DNSEnumerationError(
                f"Amass enumeration timed out after {self.timeout_seconds} seconds."
            ) from exc

        if completed.returncode != 0:
            fallback = await self._enumerate_with_crtsh(scope.domain)
            if fallback:
                return fallback
            raise DNSEnumerationError((completed.stderr or "").strip())

        records: dict[str, EnumeratedHostname] = {}
        for line in (completed.stdout or "").splitlines():
            hostname = line.strip().lower().rstrip(".")
            if not hostname:
                continue
            if hostname == scope.domain or hostname.endswith(f".{scope.domain}"):
                records[hostname] = EnumeratedHostname(hostname=hostname, source="amass-passive")

        return sorted(records.values(), key=lambda record: record.hostname)

    async def _enumerate_with_crtsh(self, domain: str) -> list[EnumeratedHostname]:
        """Fallback hostname discovery using Certificate Transparency data."""
        url = f"https://crt.sh/?q=%25.{domain}&output=json"

        def _fetch() -> bytes:
            with urlopen(url, timeout=self.timeout_seconds) as response:
                return response.read()

        try:
            payload = await asyncio.wait_for(
                asyncio.to_thread(_fetch),
                timeout=self.timeout_seconds,
            )
        except (TimeoutError, asyncio.TimeoutError, HTTPError, URLError, ValueError):
            return []

        try:
            parsed = json.loads(payload.decode("utf-8", errors="ignore"))
        except json.JSONDecodeError:
            return []

        records: dict[str, EnumeratedHostname] = {}
        if not isinstance(parsed, list):
            return []

        for entry in parsed:
            if not isinstance(entry, dict):
                continue

            names_blob = str(entry.get("name_value") or "").strip().lower()
            if not names_blob:
                continue

            for candidate in names_blob.splitlines():
                hostname = candidate.strip().lstrip("*.").rstrip(".")
                if not hostname:
                    continue
                if hostname == domain or hostname.endswith(f".{domain}"):
                    records[hostname] = EnumeratedHostname(hostname=hostname, source="crt.sh")
                    if len(records) >= self.fallback_max_hostnames:
                        break

            if len(records) >= self.fallback_max_hostnames:
                break

        return sorted(records.values(), key=lambda record: record.hostname)
