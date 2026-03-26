"""
Certificate chain analysis for Phase 4.
"""

from __future__ import annotations

from collections.abc import Mapping, Sequence
from dataclasses import dataclass

from backend.analysis.constants import canonicalize_algorithm
from backend.discovery.types import ExtractedCertificate
from backend.models.enums import CertLevel


@dataclass(frozen=True, slots=True)
class CertificateAnalysis:
    """Analyzed certificate metrics for downstream CBOM/rules usage."""

    cert_level: CertLevel
    subject: str | None
    issuer: str | None
    public_key_algorithm: str | None
    key_size_bits: int | None
    signature_algorithm: str | None
    quantum_safe: bool


class CertificateAnalyzer:
    """Analyze extracted leaf, intermediate, and root certificate metadata."""

    def analyze(
        self,
        certificates: Sequence[ExtractedCertificate | Mapping[str, object]],
    ) -> list[CertificateAnalysis]:
        """Normalize certificate metrics and recompute quantum-safe status."""
        analyses: list[CertificateAnalysis] = []
        for certificate in certificates:
            if isinstance(certificate, Mapping):
                cert_level = certificate["cert_level"]
                subject = certificate.get("subject")
                issuer = certificate.get("issuer")
                public_key_algorithm = certificate.get("public_key_algorithm")
                key_size_bits = certificate.get("key_size_bits")
                signature_algorithm = certificate.get("signature_algorithm")
            else:
                cert_level = certificate.cert_level
                subject = certificate.subject
                issuer = certificate.issuer
                public_key_algorithm = certificate.public_key_algorithm
                key_size_bits = certificate.key_size_bits
                signature_algorithm = certificate.signature_algorithm

            analyses.append(
                CertificateAnalysis(
                    cert_level=cert_level,
                    subject=subject,
                    issuer=issuer,
                    public_key_algorithm=public_key_algorithm,
                    key_size_bits=key_size_bits,
                    signature_algorithm=signature_algorithm,
                    quantum_safe=self._is_quantum_safe(public_key_algorithm, signature_algorithm),
                )
            )

        return analyses

    @staticmethod
    def _is_quantum_safe(
        public_key_algorithm: str | None,
        signature_algorithm: str | None,
    ) -> bool:
        """Return True only for recognized PQC signature/public key algorithms."""
        public_key = canonicalize_algorithm("sig", public_key_algorithm)
        signature = canonicalize_algorithm("sig", signature_algorithm)
        return public_key in {"MLDSA44", "MLDSA65", "MLDSA87", "SLHDSA"} or signature in {
            "MLDSA44",
            "MLDSA65",
            "MLDSA87",
            "SLHDSA",
        }
