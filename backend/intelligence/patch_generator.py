"""
Deterministic server-specific PQC patch generation for Phase 6.
"""

from __future__ import annotations

from dataclasses import dataclass

from backend.analysis.constants import canonicalize_algorithm

from .types import PatchArtifact


@dataclass(frozen=True, slots=True)
class _PatchTemplate:
    server_type: str
    hybrid_directive: str
    config_lines: tuple[str, ...]


class PatchGenerator:
    """Generate auditable server patches without LLM involvement."""

    _ALIASES = {
        "openresty": "nginx",
        "apache2": "apache",
        "httpd": "apache",
    }

    _TEMPLATES = {
        "nginx": _PatchTemplate(
            server_type="nginx",
            hybrid_directive="ssl_ecdh_curve X25519MLKEM768:X25519;",
            config_lines=(
                "ssl_protocols TLSv1.3;",
                "ssl_ciphers TLS_AES_256_GCM_SHA384:TLS_CHACHA20_POLY1305_SHA256;",
                "ssl_prefer_server_ciphers off;",
            ),
        ),
        "apache": _PatchTemplate(
            server_type="apache",
            hybrid_directive="SSLOpenSSLConfCmd Curves X25519MLKEM768:X25519",
            config_lines=(
                "SSLProtocol TLSv1.3",
                "SSLCipherSuite TLS_AES_256_GCM_SHA384:TLS_CHACHA20_POLY1305_SHA256",
                "SSLHonorCipherOrder off",
            ),
        ),
        "generic": _PatchTemplate(
            server_type="generic",
            hybrid_directive="Groups = X25519MLKEM768:X25519",
            config_lines=(
                "CipherString = TLS_AES_256_GCM_SHA384:TLS_CHACHA20_POLY1305_SHA256",
                "MinProtocol = TLSv1.3",
            ),
        ),
    }

    def generate(
        self,
        *,
        server_software: str | None,
        enc_algorithm: str | None,
    ) -> PatchArtifact:
        """Generate a server-aware PQC patch that preserves AES-256-GCM."""
        template_key = self._normalize_server_type(server_software)
        template = self._TEMPLATES[template_key]
        preserved_cipher = canonicalize_algorithm("sym", enc_algorithm) or "AES256GCM"
        if preserved_cipher == "AES256GCM":
            symmetric_cipher_comment = "# Preserve quantum-acceptable symmetric cipher: AES256GCM"
        elif preserved_cipher in {"AES128", "AES128GCM"}:
            symmetric_cipher_comment = (
                "# Upgrade symmetric cipher: AES128GCM -> AES256GCM recommended"
            )
        else:
            symmetric_cipher_comment = (
                f"# Preserve quantum-acceptable symmetric cipher: {preserved_cipher}"
            )
        patch_lines = [
            "# Requires OQS-provider-enabled OpenSSL build",
            symmetric_cipher_comment,
            *template.config_lines,
            template.hybrid_directive,
        ]
        return PatchArtifact(
            server_type=template.server_type,
            hybrid_directive=template.hybrid_directive,
            patch="\n".join(patch_lines),
            preserved_cipher=preserved_cipher,
            prerequisite_notes=(
                "Install an OpenSSL build with the OQS provider enabled.",
                "Retain AES-256-GCM suites during the hybrid rollout.",
            ),
        )

    def _normalize_server_type(self, server_software: str | None) -> str:
        if not server_software or not server_software.strip():
            return "generic"

        normalized = server_software.strip().lower()
        normalized = self._ALIASES.get(normalized, normalized)
        if normalized in self._TEMPLATES:
            return normalized
        return "generic"
