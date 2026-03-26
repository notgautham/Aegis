"""
Unit tests for the deterministic HNDL calculator.
"""

from __future__ import annotations

import uuid

from backend.intelligence.hndl_calculator import HndlCalculator
from backend.models.crypto_assessment import CryptoAssessment


def test_documented_algorithms_resolve_expected_break_years() -> None:
    calculator = HndlCalculator(current_year=2026)
    assessment = CryptoAssessment(
        id=uuid.uuid4(),
        asset_id=uuid.uuid4(),
        kex_algorithm="ECDHE",
        auth_algorithm="RSA",
        enc_algorithm="AES_256_GCM",
    )

    result = calculator.calculate(assessment=assessment)

    break_years = {entry.algorithm: entry.break_year for entry in result.entries}
    assert break_years["ECDH-P256"] == 2032
    assert break_years["RSA-2048"] == 2036
    assert result.urgency == "HIGH"


def test_growth_rate_is_clamped_and_outputs_are_capped() -> None:
    calculator = HndlCalculator(
        current_year=2026,
        qubit_requirements={
            "RSA-2048": {
                "logical_qubits": 4000,
                "growth_rate": 0,
                "source": {"title": "Test"},
            }
        },
    )
    assessment = CryptoAssessment(
        id=uuid.uuid4(),
        asset_id=uuid.uuid4(),
        auth_algorithm="RSA",
    )

    result = calculator.calculate(assessment=assessment)

    assert result.entries[0].projected_growth_rate == 1.0
    assert result.entries[0].break_year == 2100


def test_unknown_algorithms_are_skipped_deterministically() -> None:
    calculator = HndlCalculator(current_year=2026)
    assessment = CryptoAssessment(
        id=uuid.uuid4(),
        asset_id=uuid.uuid4(),
        kex_algorithm="MLKEM768",
        auth_algorithm="ML-DSA-65",
    )

    result = calculator.calculate(assessment=assessment)

    assert result.entries == ()
    assert result.most_urgent_algorithm is None
    assert result.urgency == "LOW"


def test_urgency_classification_is_deterministic() -> None:
    calculator = HndlCalculator(
        current_year=2026,
        qubit_requirements={
            "ECDH-P256": {
                "logical_qubits": 4,
                "growth_rate": 1,
                "source": {"title": "Test"},
            }
        },
    )
    assessment = CryptoAssessment(
        id=uuid.uuid4(),
        asset_id=uuid.uuid4(),
        kex_algorithm="ECDHE",
    )

    result = calculator.calculate(assessment=assessment)

    assert result.entries[0].break_year == 2030
    assert result.urgency == "CRITICAL"
