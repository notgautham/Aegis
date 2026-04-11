"""
Cross-phase validation for Discovery -> Analysis handoff.
"""

from __future__ import annotations

from backend.analysis.cert_analyzer import CertificateAnalyzer
from backend.analysis.cipher_parser import parse_tls12_cipher_suite
from backend.analysis.handshake_metadata_resolver import resolve_tls13_handshake_metadata
from backend.analysis.risk_scorer import calculate_risk_score
from backend.discovery.cert_extractor import CertificateExtractor
from backend.discovery.types import TLSProbeResult
from tests.unit._certificate_helpers import build_rsa_certificate_chain


def test_tls12_probe_result_flows_into_analysis_pipeline() -> None:
    """Validate the documented TLS 1.2 discovery-to-analysis handoff."""
    leaf_pem, root_pem = build_rsa_certificate_chain()
    tls_result = TLSProbeResult(
        hostname="testssl.sh",
        ip_address="104.21.64.1",
        port=443,
        protocol="tcp",
        tls_version="1.2",
        cipher_suite="TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384",
        certificate_chain_pem=(leaf_pem, root_pem),
    )

    extractor = CertificateExtractor()
    analyzer = CertificateAnalyzer()

    extracted_certificates = extractor.extract(tls_result)
    analyzed_certificates = analyzer.analyze(extracted_certificates)
    parsed_cipher = parse_tls12_cipher_suite(tls_result.cipher_suite or "")
    risk = calculate_risk_score(
        kex_vulnerability=parsed_cipher.kex_vulnerability,
        sig_vulnerability=parsed_cipher.sig_vulnerability,
        sym_vulnerability=parsed_cipher.sym_vulnerability,
        tls_version=tls_result.tls_version,
    )

    assert len(extracted_certificates) == 2
    assert len(analyzed_certificates) == 2
    assert analyzed_certificates[0].quantum_safe is False
    assert parsed_cipher.kex_algorithm == "ECDHE"
    assert parsed_cipher.auth_algorithm == "RSA"
    assert parsed_cipher.enc_algorithm == "AES_256_GCM"
    assert risk.score == 84.5


def test_tls13_probe_metadata_flows_into_analysis_pipeline() -> None:
    """Validate TLS 1.3 metadata resolution and risk scoring handoff."""
    resolved = resolve_tls13_handshake_metadata(
        {
            "tls_version": "TLSv1.3",
            "handshake": {
                "group_name": "X25519_MLKEM768",
                "peer_signature_algorithm": "ML-DSA-65",
            },
        }
    )

    risk = calculate_risk_score(
        kex_vulnerability=0.30,
        sig_vulnerability=0.0,
        sym_vulnerability=0.05,
        tls_version=resolved.tls_version,
    )

    assert resolved.kex_algorithm == "X25519_MLKEM768"
    assert resolved.auth_algorithm == "MLDSA65"
    assert risk.tls_vulnerability == 0.1
    assert risk.score == 15.0
