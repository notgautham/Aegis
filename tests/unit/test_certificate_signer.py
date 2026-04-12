"""
Unit tests for the Phase 7 certificate signer.
"""

from __future__ import annotations

import pytest
from cryptography import x509
from cryptography.x509.oid import ExtensionOID, ExtendedKeyUsageOID

from backend.cert import (
    CertificateIssuanceError,
    CertificateRequest,
    CertificateSigner,
    ComplianceTierMismatchError,
    get_extension_payload,
    load_certificate,
)
from backend.compliance import ComplianceEvaluation, DimensionEvaluation, DimensionStatus
from backend.models.enums import ComplianceTier
from tests.unit._phase7_helpers import build_certificate_fixture, unavailable_oqs_capability


def _force_fallback(monkeypatch: pytest.MonkeyPatch, signer: CertificateSigner) -> None:
    monkeypatch.setattr(signer, "_detect_oqs_capability", lambda: unavailable_oqs_capability())


@pytest.mark.parametrize(
    ("tier", "fixture_kwargs", "expected_status", "expected_days", "expected_fips"),
    [
        (
            ComplianceTier.FULLY_QUANTUM_SAFE,
            {
                "kex_algorithm": "ML-KEM-768",
                "auth_algorithm": "ML-DSA-65",
                "enc_algorithm": "AES_256_GCM",
            },
            "READY",
            90,
            "203+204",
        ),
        (
            ComplianceTier.PQC_TRANSITIONING,
            {
                "kex_algorithm": "X25519MLKEM768",
                "auth_algorithm": "ML-DSA-65",
                "enc_algorithm": "AES_256_GCM",
            },
            "HYBRID",
            30,
            None,
        ),
        (
            ComplianceTier.QUANTUM_VULNERABLE,
            {
                "kex_algorithm": "ECDHE",
                "auth_algorithm": "RSA",
                "enc_algorithm": "AES_256_GCM",
            },
            "VULNERABLE",
            7,
            None,
        ),
    ],
)
def test_issue_certificate_assigns_tier_validity_and_oids(
    tmp_path,
    monkeypatch: pytest.MonkeyPatch,
    tier: ComplianceTier,
    fixture_kwargs: dict[str, str],
    expected_status: str,
    expected_days: int,
    expected_fips: str | None,
) -> None:
    _, asset, assessment, remediation_bundle = build_certificate_fixture(
        tier=tier,
        **fixture_kwargs,
    )
    signer = CertificateSigner(runtime_dir=tmp_path)
    _force_fallback(monkeypatch, signer)

    issued = signer.issue(
        certificate_request=CertificateRequest(
            asset=asset,
            assessment=assessment,
            remediation_bundle=remediation_bundle,
        )
    )
    certificate = load_certificate(issued.certificate_pem)

    assert issued.signing_algorithm == "ECDSA"
    assert issued.extensions_json["pqc_status"] == expected_status
    assert issued.extensions_json["fips_compliant"] == expected_fips
    assert issued.valid_from.tzinfo is not None
    assert issued.valid_until.tzinfo is not None
    assert issued.valid_until > issued.valid_from
    assert (issued.valid_until - issued.valid_from).days == expected_days
    assert certificate.not_valid_before_utc == issued.valid_from
    assert certificate.not_valid_after_utc == issued.valid_until
    assert get_extension_payload(certificate, "pqc_status") == expected_status

    if tier is ComplianceTier.QUANTUM_VULNERABLE:
        assert get_extension_payload(certificate, "broken_algorithms") == "kex:ECDHE,sig:RSA"
        assert get_extension_payload(certificate, "remediation_bundle_id") == str(
            remediation_bundle.id
        )


def test_fallback_certificate_contains_expected_standard_extensions(
    tmp_path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _, asset, assessment, remediation_bundle = build_certificate_fixture()
    signer = CertificateSigner(runtime_dir=tmp_path)
    _force_fallback(monkeypatch, signer)

    issued = signer.issue(
        certificate_request=CertificateRequest(
            asset=asset,
            assessment=assessment,
            remediation_bundle=remediation_bundle,
        )
    )
    certificate = load_certificate(issued.certificate_pem)

    basic_constraints = certificate.extensions.get_extension_for_oid(
        ExtensionOID.BASIC_CONSTRAINTS
    ).value
    key_usage = certificate.extensions.get_extension_for_oid(ExtensionOID.KEY_USAGE).value
    extended_key_usage = certificate.extensions.get_extension_for_oid(
        ExtensionOID.EXTENDED_KEY_USAGE
    ).value
    san = certificate.extensions.get_extension_for_oid(ExtensionOID.SUBJECT_ALTERNATIVE_NAME).value

    assert basic_constraints.ca is False
    assert key_usage.digital_signature is True
    assert key_usage.key_encipherment is True
    assert ExtendedKeyUsageOID.SERVER_AUTH in extended_key_usage
    assert san.get_values_for_type(x509.DNSName) == [asset.hostname]


def test_ip_assets_use_ip_address_subject_alternative_name(
    tmp_path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _, asset, assessment, remediation_bundle = build_certificate_fixture(
        hostname=None,
        ip_address="203.0.113.19",
    )
    signer = CertificateSigner(runtime_dir=tmp_path)
    _force_fallback(monkeypatch, signer)

    issued = signer.issue(
        certificate_request=CertificateRequest(
            asset=asset,
            assessment=assessment,
            remediation_bundle=remediation_bundle,
        )
    )
    certificate = load_certificate(issued.certificate_pem)
    san = certificate.extensions.get_extension_for_oid(ExtensionOID.SUBJECT_ALTERNATIVE_NAME).value

    assert certificate.subject.rfc4514_string() == "CN=203.0.113.19"
    assert [str(value) for value in san.get_values_for_type(x509.IPAddress)] == ["203.0.113.19"]


def test_signer_reuses_same_issuer_material_across_issuances(
    tmp_path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _, asset, assessment, remediation_bundle = build_certificate_fixture()
    signer = CertificateSigner(runtime_dir=tmp_path)
    _force_fallback(monkeypatch, signer)

    first = signer.issue(
        certificate_request=CertificateRequest(
            asset=asset,
            assessment=assessment,
            remediation_bundle=remediation_bundle,
        )
    )
    second = signer.issue(
        certificate_request=CertificateRequest(
            asset=asset,
            assessment=assessment,
            remediation_bundle=remediation_bundle,
        )
    )
    first_cert = load_certificate(first.certificate_pem)
    second_cert = load_certificate(second.certificate_pem)

    assert first_cert.issuer == second_cert.issuer
    assert first_cert.serial_number != second_cert.serial_number
    assert (tmp_path / "issuer_ecdsa_key.pem").exists()
    assert (tmp_path / "issuer_ecdsa_cert.pem").exists()


def test_tier_mismatch_raises_error(tmp_path) -> None:
    _, asset, assessment, remediation_bundle = build_certificate_fixture()
    assessment.compliance_tier = ComplianceTier.FULLY_QUANTUM_SAFE
    signer = CertificateSigner(runtime_dir=tmp_path)

    with pytest.raises(ComplianceTierMismatchError):
        signer.issue(
            certificate_request=CertificateRequest(
                asset=asset,
                assessment=assessment,
                remediation_bundle=remediation_bundle,
            )
        )


def test_tier_three_requires_remediation_bundle(tmp_path) -> None:
    _, asset, assessment, _ = build_certificate_fixture()
    signer = CertificateSigner(runtime_dir=tmp_path)

    with pytest.raises(CertificateIssuanceError):
        signer.issue(
            certificate_request=CertificateRequest(
                asset=asset,
                assessment=assessment,
                remediation_bundle=None,
            )
        )


def test_broken_algorithms_payload_is_truncated_deterministically(
    tmp_path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _, asset, assessment, remediation_bundle = build_certificate_fixture()
    signer = CertificateSigner(runtime_dir=tmp_path)
    _force_fallback(monkeypatch, signer)
    long_evaluation = ComplianceEvaluation(
        kex=DimensionEvaluation("ECDHE", "ECDHE", DimensionStatus.FAIL, "fail"),
        sig=DimensionEvaluation("RSA", "RSA", DimensionStatus.FAIL, "fail"),
        sym=DimensionEvaluation("RC4", "RC4", DimensionStatus.FAIL, "fail"),
        tier=ComplianceTier.QUANTUM_VULNERABLE,
        broken_algorithms=tuple(f"kex:{'A' * 70}{index}" for index in range(5)),
        hybrid_algorithms=(),
        risk_score=88.0,
    )
    monkeypatch.setattr(signer.rules_engine, "evaluate", lambda *_args, **_kwargs: long_evaluation)

    issued = signer.issue(
        certificate_request=CertificateRequest(
            asset=asset,
            assessment=assessment,
            remediation_bundle=remediation_bundle,
        )
    )

    rendered = issued.extensions_json["oid_payloads"]["broken_algorithms"]
    assert rendered.endswith("...")
    assert len(rendered) <= 192


def test_custom_extension_semantics_are_identical_when_fallback_is_used(
    tmp_path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _, asset, assessment, remediation_bundle = build_certificate_fixture(
        tier=ComplianceTier.PQC_TRANSITIONING,
        kex_algorithm="X25519MLKEM768",
        auth_algorithm="ML-DSA-65",
    )
    signer = CertificateSigner(runtime_dir=tmp_path)
    _force_fallback(monkeypatch, signer)

    issued = signer.issue(
        certificate_request=CertificateRequest(
            asset=asset,
            assessment=assessment,
            remediation_bundle=remediation_bundle,
        )
    )

    assert issued.signing_algorithm == "ECDSA"
    assert issued.extensions_json["pqc_status"] == "HYBRID"
    assert issued.extensions_json["hybrid_algorithms"] == ["kex:X25519_MLKEM768"]


def test_oqs_ca_serial_file_is_padded_to_even_length(tmp_path) -> None:
    signer = CertificateSigner(runtime_dir=tmp_path)

    assert signer._format_openssl_ca_serial(0xABC) == "0ABC"
    assert signer._format_openssl_ca_serial(0xABCD) == "ABCD"
