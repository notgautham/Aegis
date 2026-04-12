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


def test_expired_certificate_adds_ten_point_penalty() -> None:
    breakdown = calculate_risk_score(
        kex_vulnerability=1.0,
        sig_vulnerability=1.0,
        sym_vulnerability=0.05,
        tls_version="1.2",
        certificate_days_remaining=-1,
    )

    assert breakdown.base_score == 84.5
    assert breakdown.certificate_penalty == 0.10
    assert breakdown.score == 94.5


def test_soon_to_expire_certificate_adds_five_point_penalty() -> None:
    breakdown = calculate_risk_score(
        kex_vulnerability=0.30,
        sig_vulnerability=1.0,
        sym_vulnerability=0.05,
        tls_version="1.3",
        certificate_days_remaining=12,
    )

    assert breakdown.base_score == 50.0
    assert breakdown.certificate_penalty == 0.05
    assert breakdown.score == 55.0


def test_zero_day_certificate_counts_as_expired_penalty() -> None:
    breakdown = calculate_risk_score(
        kex_vulnerability=0.30,
        sig_vulnerability=1.0,
        sym_vulnerability=0.05,
        tls_version="1.3",
        certificate_days_remaining=0,
    )

    assert breakdown.base_score == 50.0
    assert breakdown.certificate_penalty == 0.10
    assert breakdown.score == 60.0
