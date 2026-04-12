"""
Docker/runtime validation tests for Phase 7 certificate signing.
"""

from __future__ import annotations

import asyncio
import shutil
import subprocess

import pytest

from backend.cert import CertificateRequest, CertificateSigner, load_certificate
from tests.unit._phase7_helpers import build_certificate_fixture


def test_runtime_signing_emits_parseable_certificate(tmp_path) -> None:
    if shutil.which("openssl-oqs") is None:
        pytest.skip("openssl-oqs binary is required for runtime certificate parsing test")

    _, asset, assessment, remediation_bundle = build_certificate_fixture()
    signer = CertificateSigner(runtime_dir=tmp_path)

    issued = signer.issue(
        certificate_request=CertificateRequest(
            asset=asset,
            assessment=assessment,
            remediation_bundle=remediation_bundle,
        )
    )
    certificate = load_certificate(issued.certificate_pem)
    cert_path = tmp_path / "issued.pem"
    cert_path.write_text(issued.certificate_pem, encoding="utf-8")

    result = subprocess.run(
        ["openssl-oqs", "x509", "-text", "-noout", "-in", str(cert_path)],
        check=True,
        capture_output=True,
        text=True,
    )
    assert issued.signing_algorithm in {"ECDSA", "ML-DSA-65"}
    assert certificate.not_valid_after_utc > certificate.not_valid_before_utc
    assert "Aegis Compliance CA" in result.stdout


def test_runtime_signing_is_safe_under_concurrent_issuance(tmp_path) -> None:
    _, asset, assessment, remediation_bundle = build_certificate_fixture()
    signer = CertificateSigner(runtime_dir=tmp_path)

    async def issue_once():
        return await asyncio.to_thread(
            signer.issue,
            certificate_request=CertificateRequest(
                asset=asset,
                assessment=assessment,
                remediation_bundle=remediation_bundle,
            ),
        )

    async def run_concurrently():
        return await asyncio.gather(issue_once(), issue_once())

    first, second = asyncio.run(run_concurrently())
    first_cert = load_certificate(first.certificate_pem)
    second_cert = load_certificate(second.certificate_pem)

    assert first.certificate_pem != second.certificate_pem
    assert first_cert.issuer == second_cert.issuer
    assert first_cert.serial_number != second_cert.serial_number
