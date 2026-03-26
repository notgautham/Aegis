"""
TLS 1.2 cipher suite parsing.
"""

from __future__ import annotations

from dataclasses import dataclass

from backend.analysis.constants import lookup_vulnerability


class CipherParseError(ValueError):
    """Raised when a TLS 1.2 cipher suite cannot be parsed."""


@dataclass(frozen=True, slots=True)
class ParsedCipherSuite:
    """Parsed TLS cipher suite components and vulnerability values."""

    raw_cipher_suite: str
    kex_algorithm: str
    auth_algorithm: str
    enc_algorithm: str
    mac_algorithm: str
    kex_vulnerability: float
    sig_vulnerability: float
    sym_vulnerability: float


def parse_tls12_cipher_suite(cipher_suite: str) -> ParsedCipherSuite:
    """
    Parse a TLS 1.2 cipher string into kex/auth/enc/mac components.

    TLS 1.3 cipher strings must be handled by handshake_metadata_resolver.py.
    """

    normalized = cipher_suite.strip().upper()
    if not normalized:
        raise CipherParseError("Cipher suite cannot be empty.")

    if normalized.startswith("TLS_AES_") or normalized.startswith("TLS_CHACHA20_"):
        raise CipherParseError(
            "TLS 1.3 cipher suites do not expose kex/auth; use handshake metadata resolver."
        )

    if not normalized.startswith("TLS_") or "_WITH_" not in normalized:
        raise CipherParseError(f"Unsupported TLS 1.2 cipher suite format: {cipher_suite}")

    left_side, right_side = normalized[4:].split("_WITH_", maxsplit=1)
    left_tokens = [token for token in left_side.split("_") if token]
    right_tokens = [token for token in right_side.split("_") if token]

    if not left_tokens or len(right_tokens) < 2:
        raise CipherParseError(f"Incomplete TLS 1.2 cipher suite: {cipher_suite}")

    if len(left_tokens) == 1:
        kex_algorithm = left_tokens[0]
        auth_algorithm = left_tokens[0]
    else:
        kex_algorithm = "_".join(left_tokens[:-1])
        auth_algorithm = left_tokens[-1]

    enc_algorithm = "_".join(right_tokens[:-1])
    mac_algorithm = right_tokens[-1]

    return ParsedCipherSuite(
        raw_cipher_suite=normalized,
        kex_algorithm=kex_algorithm,
        auth_algorithm=auth_algorithm,
        enc_algorithm=enc_algorithm,
        mac_algorithm=mac_algorithm,
        kex_vulnerability=lookup_vulnerability("kex", kex_algorithm),
        sig_vulnerability=lookup_vulnerability("sig", auth_algorithm),
        sym_vulnerability=lookup_vulnerability("sym", enc_algorithm),
    )
