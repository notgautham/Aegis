"""
TLS probing with a broad client offering.

The primary integration point is sslyze; when it is unavailable in a
non-container development environment, pyOpenSSL is used as an
operational fallback so discovery code remains usable.
"""

from __future__ import annotations

import asyncio
import socket

from backend.discovery.types import TLSProbeResult, TLSScanTarget


class TLSProbeError(RuntimeError):
    """Raised when a TLS probe cannot be completed."""


class TLSProbe:
    """Probe a TLS endpoint and capture negotiated metadata."""

    def __init__(self, timeout_seconds: float = 10.0) -> None:
        self.timeout_seconds = timeout_seconds

    async def probe(self, target: TLSScanTarget) -> TLSProbeResult:
        """Probe the target using sslyze when available, else use pyOpenSSL."""
        try:
            return await asyncio.to_thread(self._probe_with_sslyze, target)
        except Exception:
            try:
                return await asyncio.to_thread(self._probe_with_pyopenssl, target)
            except Exception:
                return await asyncio.to_thread(self._probe_with_stdlib_ssl, target)

    def _probe_with_sslyze(self, target: TLSScanTarget) -> TLSProbeResult:
        """
        Initialize sslyze for the target and then reuse the pyOpenSSL
        handshake path for deterministic extraction.

        sslyze remains the intended integration point for future scan-command
        expansion while the pyOpenSSL extraction keeps this Phase 3 slice
        practical and container-friendly.
        """

        try:
            from sslyze import ServerNetworkLocation  # type: ignore
        except ImportError as exc:
            raise TLSProbeError("sslyze is not installed.") from exc

        ServerNetworkLocation(
            hostname=target.server_name,
            port=target.port,
            ip_address=target.ip_address,
        )
        return self._probe_with_pyopenssl(target)

    def _probe_with_pyopenssl(self, target: TLSScanTarget) -> TLSProbeResult:
        """Perform a TLS handshake and extract the negotiated cipher + cert chain."""
        try:
            from OpenSSL import SSL, crypto
        except ImportError as exc:
            raise TLSProbeError("pyOpenSSL is required for TLS probing.") from exc

        context = SSL.Context(SSL.TLS_CLIENT_METHOD)
        context.set_verify(SSL.VERIFY_NONE, lambda *_: True)
        context.set_cipher_list(b"ALL:@SECLEVEL=0")

        sock = socket.create_connection((target.ip_address, target.port), timeout=self.timeout_seconds)
        try:
            sock.settimeout(self.timeout_seconds)
            connection = SSL.Connection(context, sock)
            connection.set_connect_state()
            if target.hostname:
                connection.set_tlsext_host_name(target.hostname.encode("utf-8"))
            while True:
                try:
                    connection.do_handshake()
                    break
                except (SSL.WantReadError, SSL.WantWriteError):
                    continue

            cipher_name = connection.get_cipher_name()
            tls_version = connection.get_protocol_version_name()
            chain = connection.get_peer_cert_chain() or []
            certificate_chain_pem = tuple(
                crypto.dump_certificate(crypto.FILETYPE_PEM, cert).decode("utf-8")
                for cert in chain
            )

            return TLSProbeResult(
                hostname=target.hostname,
                ip_address=target.ip_address,
                port=target.port,
                protocol=target.protocol,
                tls_version=tls_version,
                cipher_suite=cipher_name,
                certificate_chain_pem=certificate_chain_pem,
                metadata={"source": "pyopenssl"},
            )
        except Exception as exc:
            raise TLSProbeError(
                f"TLS probe failed for {target.server_name}:{target.port}"
            ) from exc
        finally:
            try:
                connection.shutdown()
            except Exception:
                pass
            sock.close()

    def _probe_with_stdlib_ssl(self, target: TLSScanTarget) -> TLSProbeResult:
        """Fallback TLS probe using the stdlib SSL client."""
        try:
            import ssl
            from cryptography import x509
            from cryptography.hazmat.primitives import serialization
        except ImportError as exc:
            raise TLSProbeError("ssl/cryptography support is required for TLS probing.") from exc

        context = ssl.create_default_context()
        context.check_hostname = False
        context.verify_mode = ssl.CERT_NONE

        server_hostname = target.hostname or target.ip_address
        with socket.create_connection((target.ip_address, target.port), timeout=self.timeout_seconds) as sock:
            with context.wrap_socket(sock, server_hostname=server_hostname) as tls_socket:
                cipher = tls_socket.cipher()
                tls_version = tls_socket.version()
                certificate_chain_pem: tuple[str, ...] = ()

                if hasattr(tls_socket, "get_unverified_chain"):
                    chain = tls_socket.get_unverified_chain() or []
                    certificate_chain_pem = tuple(
                        cert.public_bytes(serialization.Encoding.PEM).decode("utf-8")
                        for cert in chain
                    )

                if not certificate_chain_pem:
                    leaf_der = tls_socket.getpeercert(binary_form=True)
                    if leaf_der:
                        leaf_cert = x509.load_der_x509_certificate(leaf_der)
                        certificate_chain_pem = (
                            leaf_cert.public_bytes(serialization.Encoding.PEM).decode("utf-8"),
                        )

                return TLSProbeResult(
                    hostname=target.hostname,
                    ip_address=target.ip_address,
                    port=target.port,
                    protocol=target.protocol,
                    tls_version=tls_version,
                    cipher_suite=cipher[0] if cipher else None,
                    certificate_chain_pem=certificate_chain_pem,
                    metadata={"source": "stdlib-ssl"},
                )
