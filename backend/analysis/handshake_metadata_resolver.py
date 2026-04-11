"""
TLS 1.3 handshake metadata extraction.
"""

from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass

from backend.analysis.constants import canonicalize_algorithm, resolve_mapping_value


class HandshakeMetadataResolutionError(ValueError):
    """Raised when TLS 1.3 handshake metadata cannot be resolved."""


@dataclass(frozen=True, slots=True)
class ResolvedHandshakeMetadata:
    """Resolved TLS 1.3 key exchange and authentication metadata."""

    tls_version: str
    kex_algorithm: str
    auth_algorithm: str
    resolved_from: tuple[str, ...]


def resolve_tls13_handshake_metadata(metadata: Mapping[str, object]) -> ResolvedHandshakeMetadata:
    """Extract TLS 1.3 key exchange and authentication from nested handshake metadata."""
    normalized_version = str(resolve_mapping_value(metadata, "tls_version", "version") or "").upper()
    if "1.3" not in normalized_version and "TLS13" not in normalized_version.replace(".", ""):
        raise HandshakeMetadataResolutionError("Metadata does not describe a TLS 1.3 handshake.")

    kex_value, kex_source = _resolve_kex(metadata)
    auth_value, auth_source = _resolve_auth(metadata)

    if kex_value is None:
        raise HandshakeMetadataResolutionError("Could not resolve TLS 1.3 key exchange metadata.")
    if auth_value is None:
        raise HandshakeMetadataResolutionError("Could not resolve TLS 1.3 authentication metadata.")

    return ResolvedHandshakeMetadata(
        tls_version="1.3",
        kex_algorithm=kex_value,
        auth_algorithm=auth_value,
        resolved_from=(kex_source, auth_source),
    )


def _resolve_kex(metadata: Mapping[str, object]) -> tuple[str | None, str]:
    """Resolve the TLS 1.3 key exchange/group from nested metadata."""
    candidates = (
        ("tmp_key", metadata),
        ("kex_algorithm", metadata),
        ("key_exchange", metadata),
        ("group_name", metadata),
        ("curve_name", metadata),
        ("handshake.kex_algorithm", _mapping_child(metadata, "handshake")),
        ("handshake.key_exchange", _mapping_child(metadata, "handshake")),
        ("handshake.group_name", _mapping_child(metadata, "handshake")),
        ("session.group_name", _mapping_child(metadata, "session")),
        ("session.key_exchange", _mapping_child(metadata, "session")),
    )

    for source, mapping in candidates:
        if mapping is None:
            continue
        value = resolve_mapping_value(
            mapping,
            "kex_algorithm",
            "key_exchange",
            "group_name",
            "curve_name",
            "negotiated_group",
            "tmp_key",
        )
        if value:
            resolved = canonicalize_algorithm("kex", str(value))
            if _is_usable_resolved_value(resolved):
                return resolved, source
    return None, "unresolved"


def _resolve_auth(metadata: Mapping[str, object]) -> tuple[str | None, str]:
    """Resolve TLS 1.3 authentication from metadata or certificate details."""
    candidates = (
        ("auth_algorithm", metadata),
        ("authentication", metadata),
        ("peer_signature_algorithm", metadata),
        ("certificate_signature_algorithm", metadata),
        ("handshake.auth_algorithm", _mapping_child(metadata, "handshake")),
        ("handshake.peer_signature_algorithm", _mapping_child(metadata, "handshake")),
        ("session.auth_algorithm", _mapping_child(metadata, "session")),
        ("certificate.auth_algorithm", _mapping_child(metadata, "certificate")),
        ("certificate.signature_algorithm", _mapping_child(metadata, "certificate")),
    )

    for source, mapping in candidates:
        if mapping is None:
            continue
        value = resolve_mapping_value(
            mapping,
            "auth_algorithm",
            "authentication",
            "peer_signature_algorithm",
            "certificate_signature_algorithm",
            "signature_algorithm",
            "public_key_algorithm",
        )
        if value:
            resolved = canonicalize_algorithm("sig", str(value))
            if _is_usable_resolved_value(resolved):
                return resolved, source
    return None, "unresolved"


def _mapping_child(metadata: Mapping[str, object], key: str) -> Mapping[str, object] | None:
    """Return a nested mapping child if it exists."""
    value = metadata.get(key)
    return value if isinstance(value, Mapping) else None


def _is_usable_resolved_value(value: str | None) -> bool:
    if value is None:
        return False
    normalized = value.strip().upper()
    return normalized not in {"", "UNKNOWN", "N/A", "NONE", "NULL"}
