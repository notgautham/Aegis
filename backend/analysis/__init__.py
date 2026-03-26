"""
Phase 4 cryptographic analysis engine.
"""

from backend.analysis.cert_analyzer import CertificateAnalysis, CertificateAnalyzer
from backend.analysis.cipher_parser import CipherParseError, ParsedCipherSuite, parse_tls12_cipher_suite
from backend.analysis.constants import TLS_VULNERABILITY_MAP, VULNERABILITY_MAP, WEIGHTS
from backend.analysis.handshake_metadata_resolver import (
    HandshakeMetadataResolutionError,
    ResolvedHandshakeMetadata,
    resolve_tls13_handshake_metadata,
)
from backend.analysis.risk_scorer import RiskScoreBreakdown, calculate_risk_score

__all__ = [
    "CertificateAnalysis",
    "CertificateAnalyzer",
    "CipherParseError",
    "HandshakeMetadataResolutionError",
    "ParsedCipherSuite",
    "ResolvedHandshakeMetadata",
    "RiskScoreBreakdown",
    "TLS_VULNERABILITY_MAP",
    "VULNERABILITY_MAP",
    "WEIGHTS",
    "calculate_risk_score",
    "parse_tls12_cipher_suite",
    "resolve_tls13_handshake_metadata",
]
