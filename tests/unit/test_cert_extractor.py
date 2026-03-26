"""
Unit tests for TLS certificate chain extraction.
"""

from __future__ import annotations

from backend.discovery.cert_extractor import CertificateExtractor
from backend.discovery.types import TLSProbeResult
from backend.models.enums import CertLevel
from tests.unit._certificate_helpers import build_rsa_certificate_chain


def test_extract_parses_leaf_and_root_certificate_metadata() -> None:
    """Extract structured metadata from a PEM certificate chain."""
    leaf_pem, root_pem = build_rsa_certificate_chain()
    extractor = CertificateExtractor()

    certificates = extractor.extract(
        TLSProbeResult(
            hostname="testssl.sh",
            ip_address="104.21.64.1",
            port=443,
            protocol="tcp",
            tls_version="1.2",
            cipher_suite="TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384",
            certificate_chain_pem=(leaf_pem, root_pem),
        )
    )

    assert len(certificates) == 2
    assert certificates[0].cert_level is CertLevel.LEAF
    assert certificates[0].subject is not None and "CN=testssl.sh" in certificates[0].subject
    assert certificates[0].issuer is not None and "Aegis Test Root CA" in certificates[0].issuer
    assert certificates[0].public_key_algorithm == "RSA"
    assert certificates[0].key_size_bits == 2048
    assert certificates[0].signature_algorithm == "sha256WithRSAEncryption"
    assert certificates[0].quantum_safe is False
    assert certificates[0].not_before is not None
    assert certificates[0].not_after is not None
    assert certificates[1].cert_level is CertLevel.ROOT
    assert certificates[1].key_size_bits == 3072
    assert certificates[1].signature_algorithm == "sha384WithRSAEncryption"


def test_infer_level_marks_middle_certificate_as_intermediate() -> None:
    """Classify non-endpoint certificates as intermediates."""
    assert CertificateExtractor._infer_level(0, 3) is CertLevel.LEAF
    assert CertificateExtractor._infer_level(1, 3) is CertLevel.INTERMEDIATE
    assert CertificateExtractor._infer_level(2, 3) is CertLevel.ROOT
