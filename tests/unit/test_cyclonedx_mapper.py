"""
Unit tests for Phase 5 CycloneDX CBOM mapping and export helpers.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

import pytest
from jsonschema import ValidationError

from backend.cbom.cyclonedx_mapper import AssetCbomBundle, CycloneDxMapper
from backend.compliance.rules_engine import ComplianceInput, RulesEngine
from backend.models.certificate_chain import CertificateChain
from backend.models.crypto_assessment import CryptoAssessment
from backend.models.discovered_asset import DiscoveredAsset
from backend.models.enums import CertLevel, ServiceType


def test_serial_generation_is_deterministic() -> None:
    mapper = CycloneDxMapper()
    asset = _build_asset(hostname="api.example.com", port=443)
    timestamp = datetime(2026, 3, 26, 12, 0, tzinfo=UTC)

    serial = mapper.build_serial_number(asset, timestamp=timestamp)

    assert serial == f"urn:aegis:scan:20260326:api.example.com:443:{asset.id}"


def test_serial_generation_is_unique_per_asset_for_same_target_and_day() -> None:
    mapper = CycloneDxMapper()
    timestamp = datetime(2026, 3, 26, 12, 0, tzinfo=UTC)
    first_asset = _build_asset(hostname="api.example.com", port=443)
    second_asset = _build_asset(hostname="api.example.com", port=443)

    first_serial = mapper.build_serial_number(first_asset, timestamp=timestamp)
    second_serial = mapper.build_serial_number(second_asset, timestamp=timestamp)

    assert first_serial != second_serial


def test_mapped_cbom_contains_required_fields_and_values() -> None:
    mapper = CycloneDxMapper()
    bundle = _build_bundle(
        kex_algorithm="ECDHE",
        auth_algorithm="RSA",
        enc_algorithm="AES_256_GCM",
        risk_score=84.5,
    )
    timestamp = datetime(2026, 3, 26, 12, 0, tzinfo=UTC)

    document = mapper.map_asset_bundle(bundle, timestamp=timestamp)

    assert document["bomFormat"] == "CycloneDX"
    assert document["specVersion"] == "1.6"
    assert document["serialNumber"] == f"urn:aegis:scan:20260326:api.example.com:443:{bundle.asset.id}"
    assert document["metadata"]["component"]["type"] == "service"
    assert document["components"][0]["type"] == "cryptographic-asset"
    assert document["components"][0]["cryptoProperties"]["tlsProperties"]["cipherSuites"] == [
        "TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384"
    ]
    assert (
        document["components"][0]["cryptoProperties"]["certificateProperties"][
            "subjectPublicKeyAlgorithm"
        ]
        == "RSA"
    )
    assert document["quantumRiskSummary"]["overallScore"] == 84.5
    assert document["quantumRiskSummary"]["tier"] == "QUANTUM_VULNERABLE"
    assert document["quantumRiskSummary"]["estimatedBreakYear"] is None
    assert document["quantumRiskSummary"]["priorityActions"] == [
        "migrate-key-exchange",
        "migrate-signature-algorithm",
    ]


def test_validation_fails_for_malformed_document() -> None:
    mapper = CycloneDxMapper()

    with pytest.raises(ValidationError):
        mapper.validate_cbom({"bomFormat": "CycloneDX"})


def test_export_json_returns_validated_document_and_filename() -> None:
    mapper = CycloneDxMapper()
    bundle = _build_bundle(
        kex_algorithm="MLKEM768",
        auth_algorithm="ML-DSA-65",
        enc_algorithm="AES256",
        risk_score=0.0,
    )
    document = mapper.map_asset_bundle(bundle, timestamp=datetime(2026, 3, 26, tzinfo=UTC))

    payload, filename_stem = mapper.export_json(document)

    assert payload["serialNumber"] == document["serialNumber"]
    assert filename_stem == f"urn-aegis-scan-20260326-api.example.com-443-{bundle.asset.id}"


def test_export_pdf_returns_bytes_with_expected_markers() -> None:
    mapper = CycloneDxMapper()
    bundle = _build_bundle(
        kex_algorithm="X25519MLKEM768",
        auth_algorithm="ML-DSA-65",
        enc_algorithm="AES256",
        risk_score=14.0,
    )
    document = mapper.map_asset_bundle(bundle, timestamp=datetime(2026, 3, 26, tzinfo=UTC))

    pdf_bytes, filename_stem = mapper.export_pdf(document)

    assert pdf_bytes.startswith(b"%PDF")
    assert b"Aegis CycloneDX CBOM Report" in pdf_bytes
    assert b"Compliance Tier: PQC_TRANSITIONING" in pdf_bytes
    assert filename_stem == f"urn-aegis-scan-20260326-api.example.com-443-{bundle.asset.id}"


def test_mapper_falls_back_to_first_certificate_when_leaf_is_missing() -> None:
    mapper = CycloneDxMapper()
    asset = _build_asset(hostname="fallback.example.com", port=8443)
    assessment = CryptoAssessment(
        id=uuid.uuid4(),
        asset_id=asset.id,
        tls_version="1.3",
        cipher_suite="TLS_AES_256_GCM_SHA384",
        kex_algorithm="MLKEM768",
        auth_algorithm="ML-DSA-65",
        enc_algorithm="AES256",
        mac_algorithm="SHA384",
        risk_score=0.0,
    )
    certificates = [
        CertificateChain(
            id=uuid.uuid4(),
            asset_id=asset.id,
            cert_level=CertLevel.ROOT,
            subject="CN=Fallback Root",
            issuer="CN=Fallback Root",
            public_key_algorithm="ML-DSA-65",
            key_size_bits=None,
            signature_algorithm="ML-DSA-65",
            quantum_safe=True,
            not_before=datetime(2026, 1, 1, tzinfo=UTC),
            not_after=datetime(2027, 1, 1, tzinfo=UTC),
        )
    ]
    evaluation = RulesEngine().evaluate(
        ComplianceInput(
            kex_algorithm="MLKEM768",
            auth_algorithm="ML-DSA-65",
            enc_algorithm="AES256",
        )
    )

    document = mapper.map_asset_bundle(
        AssetCbomBundle(
            asset=asset,
            assessment=assessment,
            certificates=certificates,
            compliance=evaluation,
        ),
        timestamp=datetime(2026, 3, 26, tzinfo=UTC),
    )

    assert (
        document["components"][0]["cryptoProperties"]["certificateProperties"][
            "subjectPublicKeyAlgorithm"
        ]
        == "ML-DSA-65"
    )
    assert document["components"][0]["bom-ref"] == "tls-fallback.example.com-8443"


def test_priority_actions_include_signature_and_symmetric_follow_ups() -> None:
    mapper = CycloneDxMapper()
    bundle = _build_bundle(
        kex_algorithm="MLKEM768",
        auth_algorithm="Ed25519+ML-DSA-65",
        enc_algorithm="AES128",
        risk_score=22.0,
    )

    document = mapper.map_asset_bundle(bundle, timestamp=datetime(2026, 3, 26, tzinfo=UTC))

    assert document["quantumRiskSummary"]["priorityActions"] == [
        "migrate-signature-algorithm",
        "upgrade-symmetric-encryption",
    ]


def _build_bundle(
    *,
    kex_algorithm: str,
    auth_algorithm: str,
    enc_algorithm: str,
    risk_score: float,
) -> AssetCbomBundle:
    asset = _build_asset(hostname="api.example.com", port=443)
    assessment = CryptoAssessment(
        id=uuid.uuid4(),
        asset_id=asset.id,
        tls_version="1.2",
        cipher_suite="TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384",
        kex_algorithm=kex_algorithm,
        auth_algorithm=auth_algorithm,
        enc_algorithm=enc_algorithm,
        mac_algorithm="SHA384",
        kex_vulnerability=1.0,
        sig_vulnerability=1.0,
        sym_vulnerability=0.05,
        tls_vulnerability=0.4,
        risk_score=risk_score,
    )
    certificates = [
        CertificateChain(
            id=uuid.uuid4(),
            asset_id=asset.id,
            cert_level=CertLevel.LEAF,
            subject="CN=api.example.com",
            issuer="CN=Aegis Test Root",
            public_key_algorithm="RSA",
            key_size_bits=2048,
            signature_algorithm="sha256WithRSAEncryption",
            quantum_safe=False,
            not_before=datetime(2026, 1, 1, tzinfo=UTC),
            not_after=datetime(2026, 6, 1, tzinfo=UTC),
        )
    ]
    evaluation = RulesEngine().evaluate(
        ComplianceInput(
            kex_algorithm=kex_algorithm,
            auth_algorithm=auth_algorithm,
            enc_algorithm=enc_algorithm,
            risk_score=risk_score,
        )
    )
    return AssetCbomBundle(
        asset=asset,
        assessment=assessment,
        certificates=certificates,
        compliance=evaluation,
    )


def _build_asset(*, hostname: str, port: int) -> DiscoveredAsset:
    return DiscoveredAsset(
        id=uuid.uuid4(),
        scan_id=uuid.uuid4(),
        hostname=hostname,
        ip_address="203.0.113.10",
        port=port,
        protocol="tcp",
        service_type=ServiceType.TLS,
        server_software="nginx",
    )
