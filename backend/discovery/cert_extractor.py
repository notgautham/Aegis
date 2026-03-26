"""
Certificate extraction from TLS probe results.
"""

from __future__ import annotations

from cryptography import x509

from backend.discovery.types import ExtractedCertificate, TLSProbeResult
from backend.models.enums import CertLevel


class CertificateExtractor:
    """Parse PEM certificate chains into structured metadata."""

    def extract(self, tls_result: TLSProbeResult) -> list[ExtractedCertificate]:
        """Extract leaf, intermediate, and root metadata from a probe result."""
        certificates: list[ExtractedCertificate] = []
        total = len(tls_result.certificate_chain_pem)

        for index, pem in enumerate(tls_result.certificate_chain_pem):
            certificate = x509.load_pem_x509_certificate(pem.encode("utf-8"))
            public_key = certificate.public_key()
            public_key_type = public_key.__class__.__name__.replace("PublicKey", "")
            signature_algorithm = getattr(certificate.signature_algorithm_oid, "_name", None)
            key_size_bits = getattr(public_key, "key_size", None)

            certificates.append(
                ExtractedCertificate(
                    cert_level=self._infer_level(index, total),
                    subject=certificate.subject.rfc4514_string() or None,
                    issuer=certificate.issuer.rfc4514_string() or None,
                    public_key_algorithm=public_key_type or None,
                    key_size_bits=key_size_bits,
                    signature_algorithm=signature_algorithm,
                    quantum_safe=self._is_quantum_safe(public_key_type, signature_algorithm),
                    not_before=certificate.not_valid_before_utc,
                    not_after=certificate.not_valid_after_utc,
                    pem=pem,
                )
            )

        return certificates

    @staticmethod
    def _infer_level(index: int, total: int) -> CertLevel:
        """Determine the logical certificate position in the chain."""
        if index == 0:
            return CertLevel.LEAF
        if index == total - 1:
            return CertLevel.ROOT
        return CertLevel.INTERMEDIATE

    @staticmethod
    def _is_quantum_safe(
        public_key_algorithm: str | None,
        signature_algorithm: str | None,
    ) -> bool:
        """Flag PQC-safe algorithms using conservative string matching."""
        combined = f"{public_key_algorithm or ''} {signature_algorithm or ''}".upper()
        return (
            "ML-DSA" in combined
            or "MLDSA" in combined
            or "SLH-DSA" in combined
            or "SLHDSA" in combined
        )
