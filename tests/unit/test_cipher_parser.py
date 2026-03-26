"""
Unit tests for TLS 1.2 cipher suite parsing.
"""

import pytest

from backend.analysis.cipher_parser import CipherParseError, parse_tls12_cipher_suite


def test_parse_standard_tls12_cipher_suite() -> None:
    """Parse the documented TLS 1.2 example correctly."""
    parsed = parse_tls12_cipher_suite("TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384")

    assert parsed.kex_algorithm == "ECDHE"
    assert parsed.auth_algorithm == "RSA"
    assert parsed.enc_algorithm == "AES_256_GCM"
    assert parsed.mac_algorithm == "SHA384"
    assert parsed.kex_vulnerability == 1.0
    assert parsed.sig_vulnerability == 1.0
    assert parsed.sym_vulnerability == 0.05


def test_parse_hybrid_pqc_cipher_suite() -> None:
    """Preserve hybrid PQC key exchange tokens as a single kex algorithm."""
    parsed = parse_tls12_cipher_suite("TLS_X25519_MLKEM768_RSA_WITH_AES_256_GCM_SHA384")

    assert parsed.kex_algorithm == "X25519_MLKEM768"
    assert parsed.auth_algorithm == "RSA"
    assert parsed.kex_vulnerability == 0.30


@pytest.mark.parametrize(
    "cipher_suite",
    [
        "",
        "TLS_AES_256_GCM_SHA384",
        "ECDHE_RSA_WITH_AES_256_GCM_SHA384",
        "TLS_ECDHE_RSA",
    ],
)
def test_parse_invalid_tls12_cipher_strings(cipher_suite: str) -> None:
    """Reject malformed or TLS 1.3 cipher suite strings."""
    with pytest.raises(CipherParseError):
        parse_tls12_cipher_suite(cipher_suite)
