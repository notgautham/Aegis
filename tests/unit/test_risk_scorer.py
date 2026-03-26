"""
Unit tests for deterministic quantum risk scoring.
"""

from backend.analysis.risk_scorer import calculate_risk_score


def test_calculate_documented_risk_score_example() -> None:
    """Validate the documented ECDHE + RSA + AES-256-GCM + TLS1.2 example."""
    breakdown = calculate_risk_score(
        kex_vulnerability=1.0,
        sig_vulnerability=1.0,
        sym_vulnerability=0.05,
        tls_version="1.2",
    )

    assert breakdown.tls_vulnerability == 0.4
    assert breakdown.score == 84.5
    assert breakdown.kex_component == 0.45
    assert breakdown.sig_component == 0.35
    assert breakdown.sym_component == 0.005
    assert breakdown.tls_component == 0.04
