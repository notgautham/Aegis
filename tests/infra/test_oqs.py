"""
OQS Infrastructure Verification Tests.

These tests verify that the OQS-patched OpenSSL container
is correctly configured and that post-quantum crypto
operations work as expected.

Run inside Docker:
    docker-compose exec backend pytest tests/infra/test_oqs.py -v
"""

import pytest

oqs = pytest.importorskip("oqs", reason="oqs-python is required for OQS runtime tests")


def test_oqs_import() -> None:
    """Verify that the oqs-python package is importable."""
    assert oqs is not None


def test_oqs_kem_mechanisms_available() -> None:
    """Verify ML-KEM is listed in enabled KEM mechanisms."""
    kems = oqs.get_enabled_kem_mechanisms()
    assert isinstance(kems, (list, tuple)), f"Expected list or tuple, got {type(kems)}"
    assert len(kems) > 0, "No KEM mechanisms available — OQS build may have failed"

    # ML-KEM-768 should be present (may also appear as Kyber768 in older builds)
    ml_kem_present = any("ML-KEM" in k or "Kyber" in k for k in kems)
    assert ml_kem_present, f"ML-KEM / Kyber not found in enabled KEMs: {kems[:10]}..."


def test_ml_kem_keygen() -> None:
    """Verify ML-KEM-768 key generation works end-to-end."""
    kem = oqs.KeyEncapsulation("ML-KEM-768")
    public_key = kem.generate_keypair()
    assert len(public_key) > 0, "ML-KEM-768 key generation returned empty key"

    # Encapsulate + decapsulate round trip
    ciphertext, shared_secret_enc = kem.encap_secret(public_key)
    shared_secret_dec = kem.decap_secret(ciphertext)
    assert shared_secret_enc == shared_secret_dec, "ML-KEM-768 encapsulation/decapsulation mismatch"


def test_ml_dsa_signing() -> None:
    """Verify ML-DSA-65 digital signature works end-to-end."""
    sig = oqs.Signature("ML-DSA-65")
    public_key = sig.generate_keypair()
    assert len(public_key) > 0, "ML-DSA-65 keypair generation returned empty key"

    message = b"Aegis PQC compliance test message"
    signature = sig.sign(message)
    assert len(signature) > 0, "ML-DSA-65 signing returned empty signature"

    is_valid = sig.verify(message, signature, public_key)
    assert is_valid, "ML-DSA-65 signature verification failed"


def test_oqs_sig_mechanisms_available() -> None:
    """Verify ML-DSA is listed in enabled signature mechanisms."""
    sigs = oqs.get_enabled_sig_mechanisms()
    assert isinstance(sigs, (list, tuple)), f"Expected list or tuple, got {type(sigs)}"
    assert len(sigs) > 0, "No signature mechanisms available"

    ml_dsa_present = any("ML-DSA" in s or "Dilithium" in s for s in sigs)
    assert ml_dsa_present, f"ML-DSA / Dilithium not found in enabled sigs: {sigs[:10]}..."
