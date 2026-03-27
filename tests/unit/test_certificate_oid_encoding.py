"""
Unit tests for Phase 7 OID extension encoding.
"""

from __future__ import annotations

from cryptography.x509.oid import ObjectIdentifier

from backend.cert import CertificateRequest, CertificateSigner, get_extension_payload, load_certificate
from backend.models.enums import ComplianceTier
from tests.unit._phase7_helpers import build_certificate_fixture, unavailable_oqs_capability


def test_all_expected_custom_oids_are_present_for_tier_three(tmp_path, monkeypatch) -> None:
    _, asset, assessment, remediation_bundle = build_certificate_fixture(
        tier=ComplianceTier.QUANTUM_VULNERABLE
    )
    signer = CertificateSigner(runtime_dir=tmp_path)
    monkeypatch.setattr(signer, "_detect_oqs_capability", lambda: unavailable_oqs_capability())

    issued = signer.issue(
        certificate_request=CertificateRequest(
            asset=asset,
            assessment=assessment,
            remediation_bundle=remediation_bundle,
        )
    )
    certificate = load_certificate(issued.certificate_pem)

    assert certificate.extensions.get_extension_for_oid(
        ObjectIdentifier("1.3.6.1.4.1.55555.1.1")
    )
    assert certificate.extensions.get_extension_for_oid(
        ObjectIdentifier("1.3.6.1.4.1.55555.1.3")
    )
    assert certificate.extensions.get_extension_for_oid(
        ObjectIdentifier("1.3.6.1.4.1.55555.1.4")
    )


def test_custom_oid_payloads_decode_as_expected_utf8(tmp_path, monkeypatch) -> None:
    _, asset, assessment, remediation_bundle = build_certificate_fixture()
    signer = CertificateSigner(runtime_dir=tmp_path)
    monkeypatch.setattr(signer, "_detect_oqs_capability", lambda: unavailable_oqs_capability())

    issued = signer.issue(
        certificate_request=CertificateRequest(
            asset=asset,
            assessment=assessment,
            remediation_bundle=remediation_bundle,
        )
    )
    certificate = load_certificate(issued.certificate_pem)

    assert get_extension_payload(certificate, "pqc_status") == "VULNERABLE"
    assert get_extension_payload(certificate, "broken_algorithms") == "kex:ECDHE,sig:RSA"
    assert get_extension_payload(certificate, "remediation_bundle_id") == str(remediation_bundle.id)


def test_fully_quantum_safe_certificate_omits_unneeded_custom_oids(tmp_path, monkeypatch) -> None:
    _, asset, assessment, remediation_bundle = build_certificate_fixture(
        tier=ComplianceTier.FULLY_QUANTUM_SAFE,
        kex_algorithm="ML-KEM-768",
        auth_algorithm="ML-DSA-65",
        enc_algorithm="AES_256_GCM",
    )
    signer = CertificateSigner(runtime_dir=tmp_path)
    monkeypatch.setattr(signer, "_detect_oqs_capability", lambda: unavailable_oqs_capability())

    issued = signer.issue(
        certificate_request=CertificateRequest(
            asset=asset,
            assessment=assessment,
            remediation_bundle=remediation_bundle,
        )
    )
    certificate = load_certificate(issued.certificate_pem)

    assert get_extension_payload(certificate, "pqc_status") == "READY"
    assert get_extension_payload(certificate, "fips_compliant") == "203+204"
    assert get_extension_payload(certificate, "broken_algorithms") is None
    assert get_extension_payload(certificate, "remediation_bundle_id") is None


def test_custom_extension_payload_size_stays_bounded(tmp_path, monkeypatch) -> None:
    _, asset, assessment, remediation_bundle = build_certificate_fixture()
    signer = CertificateSigner(runtime_dir=tmp_path)
    monkeypatch.setattr(signer, "_detect_oqs_capability", lambda: unavailable_oqs_capability())

    issued = signer.issue(
        certificate_request=CertificateRequest(
            asset=asset,
            assessment=assessment,
            remediation_bundle=remediation_bundle,
        )
    )

    total_payload_size = sum(
        len(payload)
        for payload in issued.extensions_json["oid_payloads"].values()
        if payload
    )
    assert total_payload_size < 512
