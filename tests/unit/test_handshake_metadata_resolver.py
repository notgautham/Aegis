"""
Unit tests for TLS 1.3 handshake metadata resolution.
"""

import pytest

from backend.analysis.handshake_metadata_resolver import (
    HandshakeMetadataResolutionError,
    resolve_tls13_handshake_metadata,
)


def test_resolve_tls13_handshake_metadata_from_nested_fields() -> None:
    """Extract TLS 1.3 kex/auth from nested handshake metadata."""
    resolved = resolve_tls13_handshake_metadata(
        {
            "tls_version": "TLSv1.3",
            "handshake": {
                "group_name": "X25519_MLKEM768",
                "peer_signature_algorithm": "ML-DSA-65",
            },
        }
    )

    assert resolved.tls_version == "1.3"
    assert resolved.kex_algorithm == "X25519_MLKEM768"
    assert resolved.auth_algorithm == "MLDSA65"


def test_resolve_tls13_handshake_metadata_from_certificate_fields() -> None:
    """Fall back to certificate metadata when auth is not in the top-level handshake fields."""
    resolved = resolve_tls13_handshake_metadata(
        {
            "version": "TLS 1.3",
            "session": {"key_exchange": "ML-KEM-768"},
            "certificate": {"signature_algorithm": "ML-DSA-65"},
        }
    )

    assert resolved.kex_algorithm == "MLKEM768"
    assert resolved.auth_algorithm == "MLDSA65"


def test_reject_non_tls13_metadata() -> None:
    """Reject metadata that is not TLS 1.3."""
    with pytest.raises(HandshakeMetadataResolutionError):
        resolve_tls13_handshake_metadata({"tls_version": "TLSv1.2", "key_exchange": "ECDHE"})
