"""
Deterministic PQC compliance engine for Phase 5.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from enum import Enum

from backend.analysis.constants import canonicalize_algorithm
from backend.models.crypto_assessment import CryptoAssessment
from backend.models.enums import ComplianceTier


class DimensionStatus(str, Enum):
    """Allowed per-dimension evaluation states."""

    PASS = "PASS"
    HYBRID = "HYBRID"
    FAIL = "FAIL"
    OK = "OK"
    WARN = "WARN"


@dataclass(frozen=True, slots=True)
class ComplianceInput:
    """Normalized analysis input consumed by the deterministic rules engine."""

    kex_algorithm: str | None
    auth_algorithm: str | None
    enc_algorithm: str | None
    risk_score: float | None = None


@dataclass(frozen=True, slots=True)
class DimensionEvaluation:
    """Evaluation result for one algorithm dimension."""

    raw_algorithm: str | None
    normalized_algorithm: str | None
    status: DimensionStatus
    reason: str


@dataclass(frozen=True, slots=True)
class ComplianceEvaluation:
    """Final rules-engine output for one asset."""

    kex: DimensionEvaluation
    sig: DimensionEvaluation
    sym: DimensionEvaluation
    tier: ComplianceTier
    broken_algorithms: tuple[str, ...]
    hybrid_algorithms: tuple[str, ...]
    risk_score: float | None = None


class RulesEngine:
    """Deterministic PQC rules engine with zero AI dependence."""

    _PASS_KEX = {"MLKEM512", "MLKEM768", "MLKEM1024"}
    _HYBRID_KEX = {"X25519_MLKEM768"}
    _FAIL_KEX = {"RSA", "ECDHE", "ECDH", "DHE", "DH", "X25519"}

    _PASS_SIG = {"MLDSA44", "MLDSA65", "MLDSA87", "SLHDSA"}
    _FAIL_SIG = {"RSA", "ECDSA", "DSA", "ED25519", "ED448"}

    _OK_SYM = {"AES256", "AES256GCM", "CHACHA20", "CHACHA20POLY1305"}
    _WARN_SYM = {"AES128", "AES128GCM"}
    _FAIL_SYM = {"3DES", "DES", "RC4"}

    def evaluate(self, compliance_input: ComplianceInput) -> ComplianceEvaluation:
        """Evaluate the three dimensions and return a deterministic tier."""
        kex = self._evaluate_kex(compliance_input.kex_algorithm)
        sig = self._evaluate_sig(compliance_input.auth_algorithm)
        sym = self._evaluate_sym(compliance_input.enc_algorithm)

        tier = self._aggregate_tier(kex, sig, sym)
        broken_algorithms = self._collect_algorithms(
            (("kex", kex), ("sig", sig), ("sym", sym)),
            {DimensionStatus.FAIL},
        )
        hybrid_algorithms = self._collect_algorithms(
            (("kex", kex), ("sig", sig), ("sym", sym)),
            {DimensionStatus.HYBRID, DimensionStatus.WARN},
        )

        return ComplianceEvaluation(
            kex=kex,
            sig=sig,
            sym=sym,
            tier=tier,
            broken_algorithms=broken_algorithms,
            hybrid_algorithms=hybrid_algorithms,
            risk_score=compliance_input.risk_score,
        )

    def _evaluate_kex(self, algorithm: str | None) -> DimensionEvaluation:
        normalized = canonicalize_algorithm("kex", algorithm)
        if not normalized:
            return DimensionEvaluation(algorithm, None, DimensionStatus.FAIL, "Missing KEX algorithm.")
        if normalized in self._PASS_KEX:
            return DimensionEvaluation(
                algorithm,
                normalized,
                DimensionStatus.PASS,
                "Pure ML-KEM key exchange satisfies FIPS 203.",
            )
        if normalized in self._HYBRID_KEX:
            return DimensionEvaluation(
                algorithm,
                normalized,
                DimensionStatus.HYBRID,
                "Hybrid classical/PQC key exchange detected.",
            )
        if normalized in self._FAIL_KEX:
            return DimensionEvaluation(
                algorithm,
                normalized,
                DimensionStatus.FAIL,
                "Classical-only key exchange is quantum-vulnerable.",
            )
        return DimensionEvaluation(
            algorithm,
            normalized,
            DimensionStatus.FAIL,
            "Unrecognized key exchange treated conservatively as FAIL.",
        )

    def _evaluate_sig(self, algorithm: str | None) -> DimensionEvaluation:
        if not algorithm or not algorithm.strip():
            return DimensionEvaluation(algorithm, None, DimensionStatus.FAIL, "Missing signature algorithm.")

        normalized = canonicalize_algorithm("sig", algorithm)
        hybrid_tokens = self._tokenize_sig_algorithms(algorithm)

        if len(hybrid_tokens) > 1:
            has_pqc = any(token in self._PASS_SIG for token in hybrid_tokens)
            has_classical = any(token in self._FAIL_SIG for token in hybrid_tokens)
            if has_pqc and has_classical:
                return DimensionEvaluation(
                    algorithm,
                    "+".join(hybrid_tokens),
                    DimensionStatus.HYBRID,
                    "Hybrid classical/PQC signature detected.",
                )

        if normalized in self._PASS_SIG:
            return DimensionEvaluation(
                algorithm,
                normalized,
                DimensionStatus.PASS,
                "Pure PQC signature satisfies FIPS 204/205.",
            )
        if normalized in self._FAIL_SIG:
            return DimensionEvaluation(
                algorithm,
                normalized,
                DimensionStatus.FAIL,
                "Classical-only signature is quantum-vulnerable.",
            )
        return DimensionEvaluation(
            algorithm,
            normalized,
            DimensionStatus.FAIL,
            "Unrecognized signature treated conservatively as FAIL.",
        )

    def _evaluate_sym(self, algorithm: str | None) -> DimensionEvaluation:
        normalized = canonicalize_algorithm("sym", algorithm)
        if not normalized:
            return DimensionEvaluation(
                algorithm,
                None,
                DimensionStatus.FAIL,
                "Missing symmetric encryption algorithm.",
            )
        if normalized in self._OK_SYM:
            return DimensionEvaluation(
                algorithm,
                normalized,
                DimensionStatus.OK,
                "Quantum-acceptable symmetric encryption detected.",
            )
        if normalized in self._WARN_SYM:
            return DimensionEvaluation(
                algorithm,
                normalized,
                DimensionStatus.WARN,
                "Symmetric algorithm remains usable but should transition.",
            )
        if normalized in self._FAIL_SYM:
            return DimensionEvaluation(
                algorithm,
                normalized,
                DimensionStatus.FAIL,
                "Symmetric algorithm fails quantum/compliance requirements.",
            )
        return DimensionEvaluation(
            algorithm,
            normalized,
            DimensionStatus.FAIL,
            "Unrecognized symmetric algorithm treated conservatively as FAIL.",
        )

    @staticmethod
    def _aggregate_tier(
        kex: DimensionEvaluation,
        sig: DimensionEvaluation,
        sym: DimensionEvaluation,
    ) -> ComplianceTier:
        # Hard failures in major dimensions stay vulnerable.
        if kex.status is DimensionStatus.FAIL or sig.status is DimensionStatus.FAIL:
            return ComplianceTier.QUANTUM_VULNERABLE

        # 1. FULLY_QUANTUM_SAFE: Pure PQC on both major dimensions + OK symmetric
        if (
            kex.status == DimensionStatus.PASS
            and sig.status == DimensionStatus.PASS
            and sym.status == DimensionStatus.OK
        ):
            return ComplianceTier.FULLY_QUANTUM_SAFE

        # 2. PQC_TRANSITIONING: At least one PQC component (HYBRID or PASS) detected in KEX or SIG.
        # This rewards partial migration (like Discord's hybrid KEX).
        if (
            kex.status in {DimensionStatus.HYBRID, DimensionStatus.PASS}
            or sig.status in {DimensionStatus.HYBRID, DimensionStatus.PASS}
        ):
            # We still drop to VULNERABLE if the symmetric cipher is a hard FAIL (e.g. RC4)
            if sym.status == DimensionStatus.FAIL:
                return ComplianceTier.QUANTUM_VULNERABLE
            return ComplianceTier.PQC_TRANSITIONING

        # 3. QUANTUM_VULNERABLE: No PQC components detected, or hard failures present.
        return ComplianceTier.QUANTUM_VULNERABLE

    @staticmethod
    def _collect_algorithms(
        dimensions: tuple[tuple[str, DimensionEvaluation], ...],
        statuses: set[DimensionStatus],
    ) -> tuple[str, ...]:
        collected: list[str] = []
        for label, evaluation in dimensions:
            if evaluation.status in statuses:
                algorithm = evaluation.normalized_algorithm or "UNKNOWN"
                collected.append(f"{label}:{algorithm}")
        return tuple(collected)

    @staticmethod
    def _tokenize_sig_algorithms(algorithm: str) -> tuple[str, ...]:
        """Split hybrid signature strings into canonical tokens."""
        raw_tokens = [
            token for token in re.split(r"[\s,+/:|]+", algorithm.strip()) if token
        ]
        canonical_tokens = []
        for token in raw_tokens:
            canonical = canonicalize_algorithm("sig", token)
            if canonical:
                canonical_tokens.append(canonical)
        return tuple(dict.fromkeys(canonical_tokens))


def apply_compliance_tier(
    assessment: CryptoAssessment,
    evaluation: ComplianceEvaluation,
) -> CryptoAssessment:
    """Apply the deterministic compliance tier to a persisted assessment model."""
    assessment.compliance_tier = evaluation.tier
    return assessment
