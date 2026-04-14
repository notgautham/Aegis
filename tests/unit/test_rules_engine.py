"""
Unit tests for the deterministic PQC rules engine.
"""

from backend.compliance.rules_engine import ComplianceInput, DimensionStatus, RulesEngine
from backend.models.enums import ComplianceTier


def test_pure_pqc_algorithms_yield_fully_quantum_safe() -> None:
    engine = RulesEngine()

    evaluation = engine.evaluate(
        ComplianceInput(
            kex_algorithm="ML-KEM-768",
            auth_algorithm="ML-DSA-65",
            enc_algorithm="AES_256_GCM",
            risk_score=0.0,
        )
    )

    assert evaluation.kex.status is DimensionStatus.PASS
    assert evaluation.sig.status is DimensionStatus.PASS
    assert evaluation.sym.status is DimensionStatus.OK
    assert evaluation.tier is ComplianceTier.FULLY_QUANTUM_SAFE
    assert evaluation.broken_algorithms == ()
    assert evaluation.hybrid_algorithms == ()


def test_hybrid_kex_yields_transitioning() -> None:
    evaluation = RulesEngine().evaluate(
        ComplianceInput(
            kex_algorithm="X25519MLKEM768",
            auth_algorithm="ML-DSA-65",
            enc_algorithm="AES256",
        )
    )

    assert evaluation.kex.status is DimensionStatus.HYBRID
    assert evaluation.tier is ComplianceTier.PQC_TRANSITIONING
    assert evaluation.hybrid_algorithms == ("kex:X25519_MLKEM768",)


def test_hybrid_kex_with_classical_signature_still_yields_transitioning() -> None:
    evaluation = RulesEngine().evaluate(
        ComplianceInput(
            kex_algorithm="X25519MLKEM768",
            auth_algorithm="ECDSA",
            enc_algorithm="AES256GCM",
        )
    )

    assert evaluation.kex.status is DimensionStatus.HYBRID
    assert evaluation.sig.status is DimensionStatus.FAIL
    assert evaluation.tier is ComplianceTier.PQC_TRANSITIONING


def test_hybrid_signature_yields_transitioning() -> None:
    evaluation = RulesEngine().evaluate(
        ComplianceInput(
            kex_algorithm="MLKEM768",
            auth_algorithm="Ed25519+ML-DSA-65",
            enc_algorithm="AES256GCM",
        )
    )

    assert evaluation.sig.status is DimensionStatus.HYBRID
    assert evaluation.tier is ComplianceTier.PQC_TRANSITIONING
    assert evaluation.hybrid_algorithms == ("sig:ED25519+MLDSA65",)


def test_symmetric_warn_only_yields_transitioning() -> None:
    evaluation = RulesEngine().evaluate(
        ComplianceInput(
            kex_algorithm="MLKEM1024",
            auth_algorithm="SLH-DSA",
            enc_algorithm="AES_128_GCM",
        )
    )

    assert evaluation.sym.status is DimensionStatus.WARN
    assert evaluation.tier is ComplianceTier.PQC_TRANSITIONING
    assert evaluation.hybrid_algorithms == ("sym:AES128GCM",)


def test_kex_fail_yields_vulnerable() -> None:
    evaluation = RulesEngine().evaluate(
        ComplianceInput(
            kex_algorithm="ECDHE",
            auth_algorithm="ML-DSA-65",
            enc_algorithm="AES256",
        )
    )

    assert evaluation.kex.status is DimensionStatus.FAIL
    assert evaluation.tier is ComplianceTier.QUANTUM_VULNERABLE
    assert evaluation.broken_algorithms == ("kex:ECDHE",)


def test_sig_fail_yields_vulnerable() -> None:
    evaluation = RulesEngine().evaluate(
        ComplianceInput(
            kex_algorithm="MLKEM768",
            auth_algorithm="RSA",
            enc_algorithm="AES256",
        )
    )

    assert evaluation.sig.status is DimensionStatus.FAIL
    assert evaluation.tier is ComplianceTier.QUANTUM_VULNERABLE
    assert evaluation.broken_algorithms == ("sig:RSA",)


def test_sym_fail_yields_vulnerable() -> None:
    evaluation = RulesEngine().evaluate(
        ComplianceInput(
            kex_algorithm="MLKEM768",
            auth_algorithm="ML-DSA-65",
            enc_algorithm="RC4",
        )
    )

    assert evaluation.sym.status is DimensionStatus.FAIL
    assert evaluation.tier is ComplianceTier.QUANTUM_VULNERABLE
    assert evaluation.broken_algorithms == ("sym:RC4",)


def test_unknown_or_empty_algorithms_fail_conservatively() -> None:
    evaluation = RulesEngine().evaluate(
        ComplianceInput(
            kex_algorithm="",
            auth_algorithm=None,
            enc_algorithm="UNKNOWN_CIPHER",
        )
    )

    assert evaluation.kex.status is DimensionStatus.FAIL
    assert evaluation.sig.status is DimensionStatus.FAIL
    assert evaluation.sym.status is DimensionStatus.FAIL
    assert evaluation.tier is ComplianceTier.QUANTUM_VULNERABLE
    assert evaluation.broken_algorithms == (
        "kex:UNKNOWN",
        "sig:UNKNOWN",
        "sym:UNKNOWN_CIPHER",
    )


def test_unrecognized_non_empty_kex_and_sig_fail_conservatively() -> None:
    evaluation = RulesEngine().evaluate(
        ComplianceInput(
            kex_algorithm="FRODO_KEM",
            auth_algorithm="RAINBOW",
            enc_algorithm="AES256",
        )
    )

    assert evaluation.kex.status is DimensionStatus.FAIL
    assert evaluation.sig.status is DimensionStatus.FAIL
    assert evaluation.broken_algorithms == (
        "kex:FRODO_KEM",
        "sig:RAINBOW",
    )
