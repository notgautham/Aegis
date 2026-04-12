"""
Amass-backed subdomain enumeration.
"""

from __future__ import annotations

import asyncio
import json
import shutil
from collections.abc import AsyncIterator
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
        records: dict[str, EnumeratedHostname] = {}
        async for record in self.enumerate_stream(target):
            records[record.hostname] = record
        return sorted(records.values(), key=lambda record: record.hostname)

    async def enumerate_stream(self, target: str) -> AsyncIterator[EnumeratedHostname]:
        """Yield hostnames progressively as Amass emits results."""
        scope = AuthorizedScope.from_target(target)
        if scope.scope_type != "domain" or scope.domain is None:
            return

        if shutil.which(self.binary) is None:
            fallback = await self._enumerate_with_crtsh(scope.domain)
            if fallback:
                for record in fallback:
                    yield record
                return
            raise DNSEnumerationError(f"Amass binary not found: {self.binary}")

        process = await asyncio.create_subprocess_exec(
            self.binary,
            "enum",
            "-passive",
            "-timeout",
            "2",
            "-d",
            scope.domain,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )

        seen: set[str] = set()
        deadline = asyncio.get_running_loop().time() + self.timeout_seconds
        try:
            assert process.stdout is not None
            while True:
                remaining = deadline - asyncio.get_running_loop().time()
                if remaining <= 0:
                    raise asyncio.TimeoutError()
                line = await asyncio.wait_for(process.stdout.readline(), timeout=remaining)
                if not line:
                    break
                hostname = line.decode("utf-8", errors="ignore").strip().lower().rstrip(".")
                if not hostname:
                    continue
                if hostname != scope.domain and not hostname.endswith(f".{scope.domain}"):
                    continue
                if hostname in seen:
                    continue
                seen.add(hostname)
                yield EnumeratedHostname(hostname=hostname, source="amass-passive")

            remaining = max(1, int(deadline - asyncio.get_running_loop().time()))
            return_code = await asyncio.wait_for(process.wait(), timeout=remaining)
        except (TimeoutError, asyncio.TimeoutError) as exc:
            process.kill()
            await process.communicate()
            if seen:
                return
            fallback = await self._enumerate_with_crtsh(scope.domain)
            if fallback:
                for record in fallback:
                    yield record
                return
            raise DNSEnumerationError(
                f"Amass enumeration timed out after {self.timeout_seconds} seconds."
            ) from exc

        if return_code != 0 and not seen:
            stderr = b""
            if process.stderr is not None:
                stderr = await process.stderr.read()
            fallback = await self._enumerate_with_crtsh(scope.domain)
            if fallback:
                for record in fallback:
                    yield record
                return
            raise DNSEnumerationError(stderr.decode("utf-8", errors="ignore").strip())

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
