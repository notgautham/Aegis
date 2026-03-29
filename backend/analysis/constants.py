"""
Deterministic vulnerability lookup tables for Phase 4 analysis.
"""

from __future__ import annotations

from collections.abc import Mapping


VULNERABILITY_MAP: dict[str, dict[str, float]] = {
    "kex": {
        "RSA": 1.00,
        "ECDHE": 1.00,
        "ECDH": 1.00,
        "DHE": 1.00,
        "DH": 1.00,
        "X25519_MLKEM768": 0.30,
        "X25519MLKEM768": 0.30,
        "KYBER768": 0.30,
        "MLKEM768": 0.00,
        "UNKNOWN": 1.00,
    },
    "sig": {
        "RSA": 1.00,
        "ECDSA": 1.00,
        "DSA": 1.00,
        "MLDSA65": 0.00,
        "UNKNOWN": 1.00,
    },
    "sym": {
        "AES128": 0.50,
        "AES128GCM": 0.50,
        "AES256": 0.05,
        "AES256GCM": 0.05,
        "3DES": 1.00,
        "DES": 1.00,
        "RC4": 1.00,
        "CHACHA20": 0.05,
        "CHACHA20POLY1305": 0.05,
    },
}

TLS_VULNERABILITY_MAP: dict[str, float] = {
    "1.0": 0.80,
    "1.1": 0.80,
    "1.2": 0.40,
    "1.3": 0.10,
}

WEIGHTS: dict[str, float] = {
    "kex": 0.45,
    "sig": 0.35,
    "sym": 0.10,
    "tls": 0.10,
}


_ALGORITHM_ALIASES: dict[str, dict[str, str]] = {
    "kex": {
        "X25519MLKEM768": "X25519_MLKEM768",
        "X25519_MLKEM768": "X25519_MLKEM768",
        "4588": "X25519MLKEM768",
        "0X11EC": "X25519MLKEM768",
        "X25519_ML_KEM_768": "X25519_MLKEM768",
        "P256MLKEM768": "X25519_MLKEM768", # Fallback for other hybrid pairs
        "KYBER768": "MLKEM768",
        "ML-KEM-768": "MLKEM768",
        "MLKEM768": "MLKEM768",
        "ML-KEM-512": "MLKEM512",
        "MLKEM512": "MLKEM512",
        "ML-KEM-1024": "MLKEM1024",
        "MLKEM1024": "MLKEM1024",
    },
    "sig": {
        "RSA2048": "RSA",
        "RSA4096": "RSA",
        "SHA256WITHRSA": "RSA",
        "SHA384WITHRSA": "RSA",
        "ECDSAP256": "ECDSA",
        "ECDSAP384": "ECDSA",
        "ML-DSA-44": "MLDSA44",
        "MLDSA44": "MLDSA44",
        "ML-DSA-65": "MLDSA65",
        "MLDSA65": "MLDSA65",
        "ML-DSA-87": "MLDSA87",
        "MLDSA87": "MLDSA87",
        "SLH-DSA": "SLHDSA",
        "SLHDSA": "SLHDSA",
    },
    "sym": {
        "AES_128": "AES128",
        "AES_128_GCM": "AES128GCM",
        "AES_256": "AES256",
        "AES_256_GCM": "AES256GCM",
        "AES256_GCM": "AES256GCM",
        "CHACHA20_POLY1305": "CHACHA20POLY1305",
    },
}


def canonicalize_algorithm(category: str, algorithm: str | None) -> str | None:
    """Normalize algorithm names for deterministic lookup."""
    if algorithm is None:
        return None

    cleaned = (
        algorithm.upper()
        .replace("-", "")
        .replace(" ", "")
        .replace("/", "_")
    )
    alias_map = _ALGORITHM_ALIASES.get(category, {})
    return alias_map.get(cleaned, cleaned)


def lookup_vulnerability(category: str, algorithm: str | None) -> float:
    """Return the configured vulnerability score for a normalized algorithm."""
    canonical = canonicalize_algorithm(category, algorithm)
    if canonical is None:
        raise KeyError(f"No algorithm provided for category '{category}'.")
    return VULNERABILITY_MAP[category][canonical]


def lookup_tls_vulnerability(tls_version: str) -> float:
    """Normalize TLS version strings and return the protocol vulnerability."""
    normalized = tls_version.upper().replace("TLSV", "").replace("TLS", "")
    return TLS_VULNERABILITY_MAP[normalized]


def resolve_mapping_value(
    mapping: Mapping[str, object],
    *keys: str,
) -> object | None:
    """Return the first present value from a mapping using candidate keys."""
    for key in keys:
        if key in mapping and mapping[key] is not None:
            return mapping[key]
    return None
