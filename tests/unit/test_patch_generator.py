"""
Unit tests for deterministic PQC patch generation.
"""

from __future__ import annotations

from backend.intelligence.patch_generator import PatchGenerator


def test_nginx_patch_includes_hybrid_curve_and_preserves_aes256() -> None:
    artifact = PatchGenerator().generate(
        server_software="nginx",
        enc_algorithm="AES_256_GCM",
    )

    assert artifact.server_type == "nginx"
    assert "ssl_ecdh_curve X25519MLKEM768:X25519;" in artifact.patch
    assert "AES256GCM" in artifact.patch


def test_apache_patch_includes_hybrid_curve() -> None:
    artifact = PatchGenerator().generate(
        server_software="apache2",
        enc_algorithm="AES_256_GCM",
    )

    assert artifact.server_type == "apache"
    assert "SSLOpenSSLConfCmd Curves X25519MLKEM768:X25519" in artifact.patch


def test_unknown_server_type_uses_generic_fallback() -> None:
    artifact = PatchGenerator().generate(
        server_software="custom-proxy",
        enc_algorithm="AES_256_GCM",
    )

    assert artifact.server_type == "generic"
    assert "Groups = X25519MLKEM768:X25519" in artifact.patch


def test_patch_generator_keeps_quantum_acceptable_symmetric_cipher() -> None:
    artifact = PatchGenerator().generate(
        server_software="nginx",
        enc_algorithm="CHACHA20_POLY1305",
    )

    assert artifact.preserved_cipher == "CHACHA20POLY1305"


def test_patch_generator_marks_aes128_for_upgrade() -> None:
    artifact = PatchGenerator().generate(
        server_software="nginx",
        enc_algorithm="AES_128_GCM",
    )

    assert "# Upgrade symmetric cipher: AES128GCM -> AES256GCM recommended" in artifact.patch
    assert "# Preserve quantum-acceptable symmetric cipher: AES128GCM" not in artifact.patch
