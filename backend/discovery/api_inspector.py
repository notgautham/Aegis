"""
Optional API inspection for JWT algorithm hints.
"""

from __future__ import annotations

import base64
import json
from typing import Iterable

import httpx

from backend.discovery.types import APIInspectionResult, URLProbeTarget


class APIInspector:
    """Inspect accessible API endpoints for JWT algorithm metadata and mTLS hints."""

    def __init__(self, timeout_seconds: float = 10.0) -> None:
        self.timeout_seconds = timeout_seconds

    async def inspect(
        self,
        target: URLProbeTarget,
        sample_tokens: Iterable[str] = (),
    ) -> APIInspectionResult:
        """Inspect an endpoint and decode any provided sample JWT headers."""
        jwt_algorithms = sorted(
            {
                algorithm
                for token in sample_tokens
                for algorithm in [self._extract_jwt_alg(token)]
                if algorithm
            }
        )

        async with httpx.AsyncClient(timeout=self.timeout_seconds, follow_redirects=True) as client:
            try:
                response = await client.get(target.url)
                mtls_required = response.status_code == 400 and "certificate" in response.text.lower()
                headers = {key.lower(): value for key, value in response.headers.items()}
                return APIInspectionResult(
                    url=target.url,
                    jwt_algorithms=tuple(jwt_algorithms),
                    mtls_required=mtls_required,
                    status_code=response.status_code,
                    reachable=True,
                    headers=headers,
                    metadata={"module_status": "optional"}
                )
            except httpx.HTTPError:
                return APIInspectionResult(
                    url=target.url,
                    jwt_algorithms=tuple(jwt_algorithms),
                    mtls_required=False,
                    status_code=None,
                    reachable=False,
                    headers={},
                    metadata={"module_status": "optional"}
                )

    @staticmethod
    def _extract_jwt_alg(token: str) -> str | None:
        """Decode the JOSE header of an unsigned/signed JWT without verification."""
        parts = token.split(".")
        if len(parts) < 2:
            return None

        header_segment = parts[0]
        padding = "=" * (-len(header_segment) % 4)
        try:
            decoded = base64.urlsafe_b64decode(header_segment + padding)
            header = json.loads(decoded.decode("utf-8"))
        except (ValueError, json.JSONDecodeError, UnicodeDecodeError):
            return None
        algorithm = header.get("alg")
        return str(algorithm) if algorithm else None
