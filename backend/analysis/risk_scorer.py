"""
Deterministic quantum risk scoring.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from backend.analysis.constants import WEIGHTS, lookup_tls_vulnerability


@dataclass(frozen=True, slots=True)
class RiskScoreBreakdown:
    """Weighted risk score and component contributions."""

    score: float
    kex_vulnerability: float
    sig_vulnerability: float
    sym_vulnerability: float
    tls_vulnerability: float
    kex_component: float
    sig_component: float
    sym_component: float
    tls_component: float
    base_score: float
    certificate_penalty: float


def _kex_threat_sentence(algorithm: str | None) -> str:
    normalized = (algorithm or "UNKNOWN").upper()
    if "MLKEM" in normalized or "ML-KEM" in normalized:
        if "X25519" in normalized or "HYBRID" in normalized:
            return "Hybrid key exchange detected; this reduces quantum exposure but still carries classical dependency risk."
        return "Post-quantum ML-KEM key exchange detected; this is treated as quantum resistant in the current model."
    if normalized in {"X25519", "ECDHE", "ECDH", "RSA", "DHE", "UNKNOWN"}:
        return "Classical key exchange is vulnerable to Shor-type quantum attacks and is heavily weighted in risk scoring."
    return "Key-exchange algorithm is treated as quantum-vulnerable unless explicitly recognized as PQC-safe."


def _sig_threat_sentence(algorithm: str | None) -> str:
    normalized = (algorithm or "UNKNOWN").upper()
    if "MLDSA" in normalized or "ML-DSA" in normalized or "SLH" in normalized:
        return "Post-quantum signature algorithm detected; this is treated as quantum resistant in the current model."
    if (
        normalized in {"RSA", "ECDSA", "UNKNOWN", "NONE"}
        or "RSA" in normalized
        or "ECDSA" in normalized
    ):
        return "Classical signatures are vulnerable to Shor-type attacks and can enable future certificate forgery."
    return "Signature algorithm is treated as quantum-vulnerable unless explicitly recognized as PQC-safe."


def _sym_threat_sentence(algorithm: str | None) -> str:
    normalized = (algorithm or "UNKNOWN").upper()
    if "AES_256" in normalized or "AES256" in normalized or "CHACHA20" in normalized:
        return "Symmetric cipher is quantum-acceptable under Grover's model and has comparatively low scoring impact."
    if "AES_128" in normalized or "AES128" in normalized:
        return "AES-128 is weakened under Grover's model and contributes moderate residual quantum risk."
    if normalized in {"3DES", "DES", "RC4", "UNKNOWN"}:
        return "Legacy or unknown symmetric cipher is treated as high risk for modern cryptographic posture."
    return "Symmetric cipher risk is evaluated conservatively when the algorithm is not explicitly recognized."


def _format_component(weight: float, vulnerability: float | None) -> tuple[str, float, float]:
    value = vulnerability or 0.0
    raw = round(weight * value, 4)
    points = round(raw * 100, 2)
    expr = f"{weight:.2f} x {value:.2f} = {raw:.4f}"
    return expr, raw, points


def generate_score_explanation(
    *,
    kex_vulnerability: float | None,
    sig_vulnerability: float | None,
    sym_vulnerability: float | None,
    tls_vulnerability: float | None,
    kex_algorithm: str | None,
    auth_algorithm: str | None,
    enc_algorithm: str | None,
    tls_version: str | None,
    risk_score: float,
    base_risk_score: float | None = None,
    certificate_penalty: float = 0.0,
) -> dict[str, Any]:
    """Return a deterministic human-readable explanation for risk and q-score components."""
    kex_expr, _, kex_points = _format_component(WEIGHTS["kex"], kex_vulnerability)
    sig_expr, _, sig_points = _format_component(WEIGHTS["sig"], sig_vulnerability)
    sym_expr, _, sym_points = _format_component(WEIGHTS["sym"], sym_vulnerability)
    tls_expr, _, tls_points = _format_component(WEIGHTS["tls"], tls_vulnerability)

    effective_base_risk = round(base_risk_score if base_risk_score is not None else risk_score, 2)
    qscore = round(100 - risk_score, 2)
    components = {
        "kex": (kex_points, kex_algorithm or "UNKNOWN"),
        "sig": (sig_points, auth_algorithm or "UNKNOWN"),
        "sym": (sym_points, enc_algorithm or "UNKNOWN"),
        "tls": (tls_points, tls_version or "UNKNOWN"),
    }
    dominant_key = max(components, key=lambda key: components[key][0])
    dominant_points, dominant_algorithm = components[dominant_key]
    projected_qscore = round(min(100.0, qscore + dominant_points), 2)
    certificate_penalty_points = round(certificate_penalty * 100, 2)

    formula = "FinalRisk = min((0.45 x V_kex) + (0.35 x V_sig) + (0.10 x V_sym) + (0.10 x V_tls) + CertPenalty, 1.00)"
    derivation = (
        f"BaseRisk = ({kex_expr}) + ({sig_expr}) + ({sym_expr}) + ({tls_expr}) = {effective_base_risk / 100:.4f}; "
        f"CertPenalty = {certificate_penalty:.2f}; "
        f"FinalRisk = min({effective_base_risk / 100:.4f} + {certificate_penalty:.2f}, 1.00) = {risk_score / 100:.4f}; "
        f"Q-Score = 100 - ({risk_score:.2f}) = {qscore:.2f}."
    )

    penalty_reason = (
        "expired_certificate"
        if certificate_penalty >= 0.10
        else "expiring_within_30_days"
        if certificate_penalty > 0
        else "none"
    )

    return {
        "formula": formula,
        "inputs": {
            "weights": {
                "kex": WEIGHTS["kex"],
                "sig": WEIGHTS["sig"],
                "sym": WEIGHTS["sym"],
                "tls": WEIGHTS["tls"],
            },
            "vulnerabilities": {
                "kex": round(kex_vulnerability or 0.0, 2),
                "sig": round(sig_vulnerability or 0.0, 2),
                "sym": round(sym_vulnerability or 0.0, 2),
                "tls": round(tls_vulnerability or 0.0, 2),
            },
            "algorithms": {
                "kex": kex_algorithm or "UNKNOWN",
                "sig": auth_algorithm or "UNKNOWN",
                "sym": enc_algorithm or "UNKNOWN",
                "tls": tls_version or "UNKNOWN",
            },
        },
        "weighted_components": {
            "kex": round(kex_points, 2),
            "sig": round(sig_points, 2),
            "sym": round(sym_points, 2),
            "tls": round(tls_points, 2),
        },
        "penalties": {
            "certificate": round(certificate_penalty_points, 2),
            "certificate_reason": penalty_reason,
        },
        "base_risk_score": effective_base_risk,
        "final_risk_score": round(risk_score, 2),
        "q_score": qscore,
        "derivation": derivation,
        "kex_explanation": (
            f"{kex_algorithm or 'UNKNOWN'} detected. {_kex_threat_sentence(kex_algorithm)} "
            f"Weighted contribution: {kex_expr} ({kex_points:.2f} points)."
        ),
        "sig_explanation": (
            f"{auth_algorithm or 'UNKNOWN'} detected. {_sig_threat_sentence(auth_algorithm)} "
            f"Weighted contribution: {sig_expr} ({sig_points:.2f} points)."
        ),
        "sym_explanation": (
            f"{enc_algorithm or 'UNKNOWN'} detected. {_sym_threat_sentence(enc_algorithm)} "
            f"Weighted contribution: {sym_expr} ({sym_points:.2f} points)."
        ),
        "tls_explanation": (
            f"TLS {tls_version or 'UNKNOWN'} detected. "
            f"Weighted contribution: {tls_expr} ({tls_points:.2f} points)."
        ),
        "overall_explanation": (
            f"Q-Score is {qscore:.2f} because {dominant_algorithm} is the dominant risk factor "
            f"contributing {dominant_points:.2f} points to the total. Fixing this alone would raise "
            f"Q-Score to approximately {projected_qscore:.2f}."
        ),
    }


def calculate_risk_score(
    *,
    kex_vulnerability: float,
    sig_vulnerability: float,
    sym_vulnerability: float,
    tls_version: str | None = None,
    tls_vulnerability: float | None = None,
    certificate_days_remaining: int | None = None,
) -> RiskScoreBreakdown:
    """Calculate the 0-100 quantum risk score using the documented formula."""
    resolved_tls_vulnerability = (
        tls_vulnerability
        if tls_vulnerability is not None
        else lookup_tls_vulnerability(tls_version or "")
    )

    kex_component = WEIGHTS["kex"] * kex_vulnerability
    sig_component = WEIGHTS["sig"] * sig_vulnerability
    sym_component = WEIGHTS["sym"] * sym_vulnerability
    tls_component = WEIGHTS["tls"] * resolved_tls_vulnerability

    base_fraction = kex_component + sig_component + sym_component + tls_component
    certificate_penalty = 0.0
    if certificate_days_remaining is not None:
        if certificate_days_remaining <= 0:
            certificate_penalty = 0.10
        elif certificate_days_remaining <= 30:
            certificate_penalty = 0.05

    final_fraction = min(base_fraction + certificate_penalty, 1.00)
    score = round(100 * final_fraction, 2)
    base_score = round(100 * base_fraction, 2)

    return RiskScoreBreakdown(
        score=score,
        kex_vulnerability=kex_vulnerability,
        sig_vulnerability=sig_vulnerability,
        sym_vulnerability=sym_vulnerability,
        tls_vulnerability=resolved_tls_vulnerability,
        kex_component=round(kex_component, 4),
        sig_component=round(sig_component, 4),
        sym_component=round(sym_component, 4),
        tls_component=round(tls_component, 4),
        base_score=base_score,
        certificate_penalty=round(certificate_penalty, 2),
    )
