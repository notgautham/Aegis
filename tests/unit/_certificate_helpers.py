"""
Test helpers for generating deterministic X.509 certificate chains.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.x509.oid import NameOID


def build_rsa_certificate_chain() -> tuple[str, str]:
    """Return a simple root-signed leaf chain as PEM strings."""
    now = datetime.now(UTC)

    root_key = rsa.generate_private_key(public_exponent=65537, key_size=3072)
    root_subject = x509.Name(
        [
            x509.NameAttribute(NameOID.COMMON_NAME, "Aegis Test Root CA"),
            x509.NameAttribute(NameOID.ORGANIZATION_NAME, "Aegis Tests"),
        ]
    )
    root_certificate = (
        x509.CertificateBuilder()
        .subject_name(root_subject)
        .issuer_name(root_subject)
        .public_key(root_key.public_key())
        .serial_number(x509.random_serial_number())
        .not_valid_before(now - timedelta(days=1))
        .not_valid_after(now + timedelta(days=365))
        .add_extension(x509.BasicConstraints(ca=True, path_length=None), critical=True)
        .sign(private_key=root_key, algorithm=hashes.SHA384())
    )

    leaf_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    leaf_subject = x509.Name(
        [
            x509.NameAttribute(NameOID.COMMON_NAME, "testssl.sh"),
            x509.NameAttribute(NameOID.ORGANIZATION_NAME, "Aegis Tests"),
        ]
    )
    leaf_certificate = (
        x509.CertificateBuilder()
        .subject_name(leaf_subject)
        .issuer_name(root_subject)
        .public_key(leaf_key.public_key())
        .serial_number(x509.random_serial_number())
        .not_valid_before(now - timedelta(days=1))
        .not_valid_after(now + timedelta(days=90))
        .add_extension(x509.BasicConstraints(ca=False, path_length=None), critical=True)
        .add_extension(x509.SubjectAlternativeName([x509.DNSName("testssl.sh")]), critical=False)
        .sign(private_key=root_key, algorithm=hashes.SHA256())
    )

    return (
        leaf_certificate.public_bytes(serialization.Encoding.PEM).decode("utf-8"),
        root_certificate.public_bytes(serialization.Encoding.PEM).decode("utf-8"),
    )
