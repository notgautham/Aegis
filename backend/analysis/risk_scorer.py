"""
Deterministic quantum risk scoring.
"""

from __future__ import annotations

from dataclasses import dataclass

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


def calculate_risk_score(
    *,
    kex_vulnerability: float,
    sig_vulnerability: float,
    sym_vulnerability: float,
    tls_version: str | None = None,
    tls_vulnerability: float | None = None,
) -> RiskScoreBreakdown:
    """Calculate the 0-100 quantum risk score using the documented formula."""
    resolved_tls_vulnerability = (
        tls_vulnerability if tls_vulnerability is not None else lookup_tls_vulnerability(tls_version or "")
    )

    kex_component = WEIGHTS["kex"] * kex_vulnerability
    sig_component = WEIGHTS["sig"] * sig_vulnerability
    sym_component = WEIGHTS["sym"] * sym_vulnerability
    tls_component = WEIGHTS["tls"] * resolved_tls_vulnerability

    score = round(100 * (kex_component + sig_component + sym_component + tls_component), 2)

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
    )
