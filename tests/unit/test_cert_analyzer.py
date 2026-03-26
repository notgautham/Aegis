"""
Unit tests for certificate metric analysis.
"""

from __future__ import annotations

from datetime import UTC, datetime

from backend.analysis.cert_analyzer import CertificateAnalyzer
from backend.discovery.types import ExtractedCertificate
from backend.models.enums import CertLevel


def test_analyze_extracted_certificates_recomputes_quantum_safety() -> None:
    """Normalize extracted certificate objects for downstream rules usage."""
    analyzer = CertificateAnalyzer()
    certificates = [
        ExtractedCertificate(
            cert_level=CertLevel.LEAF,
            subject="CN=testssl.sh",
            issuer="CN=Aegis Test Root CA",
            public_key_algorithm="RSA",
            key_size_bits=2048,
            signature_algorithm="sha256WithRSAEncryption",
            quantum_safe=True,
            not_before=datetime(2026, 1, 1, tzinfo=UTC),
            not_after=datetime(2026, 4, 1, tzinfo=UTC),
            pem="leaf-pem",
        ),
        ExtractedCertificate(
            cert_level=CertLevel.ROOT,
            subject="CN=PQC Root",
            issuer="CN=PQC Root",
            public_key_algorithm="ML-DSA-65",
            key_size_bits=None,
            signature_algorithm="ML-DSA-65",
            quantum_safe=False,
            not_before=datetime(2026, 1, 1, tzinfo=UTC),
            not_after=datetime(2027, 1, 1, tzinfo=UTC),
            pem="root-pem",
        ),
    ]

    analyses = analyzer.analyze(certificates)

    assert [analysis.cert_level for analysis in analyses] == [CertLevel.LEAF, CertLevel.ROOT]
    assert analyses[0].public_key_algorithm == "RSA"
    assert analyses[0].quantum_safe is False
    assert analyses[1].signature_algorithm == "ML-DSA-65"
    assert analyses[1].quantum_safe is True


def test_analyze_mapping_certificates_supports_dictionary_inputs() -> None:
    """Accept mapping-based certificate payloads from future pipeline persistence layers."""
    analyzer = CertificateAnalyzer()

    analyses = analyzer.analyze(
        [
            {
                "cert_level": CertLevel.INTERMEDIATE,
                "subject": "CN=Hybrid Intermediate",
                "issuer": "CN=Hybrid Intermediate",
                "public_key_algorithm": "SLH-DSA",
                "key_size_bits": None,
                "signature_algorithm": "SLH-DSA",
            }
        ]
    )

    assert len(analyses) == 1
    assert analyses[0].cert_level is CertLevel.INTERMEDIATE
    assert analyses[0].quantum_safe is True
