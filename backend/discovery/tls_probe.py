"""
TLS probing with a broad client offering.

The primary integration point is openssl cli (OQS-patched) to ensure PQC detection.
"""

from __future__ import annotations

import asyncio
import socket
import logging
import subprocess
import re
import os
import ssl

from backend.discovery.types import TLSProbeResult, TLSScanTarget

logger = logging.getLogger(__name__)


class TLSProbeError(RuntimeError):
    """Raised when a TLS probe cannot be completed."""


class TLSProbe:
    """Probe a TLS endpoint and capture negotiated metadata."""

    def __init__(self, timeout_seconds: float | None = None) -> None:
        configured_timeout = timeout_seconds
        if configured_timeout is None:
            raw_timeout = os.getenv("AEGIS_TLS_PROBE_TIMEOUT_SECONDS", "25")
            try:
                configured_timeout = float(raw_timeout)
            except ValueError:
                configured_timeout = 25.0

        self.timeout_seconds = max(5.0, min(float(configured_timeout), 60.0))

    async def probe(self, target: TLSScanTarget) -> TLSProbeResult:
        """Probe the target using openssl cli (PQC-aware)."""
        try:
            return await self._probe_with_openssl_cli(target)
        except Exception as e:
            logger.warning("PQC Probe failed, falling back to classical: %s", e)
            try:
                return await asyncio.to_thread(self._probe_with_pyopenssl, target)
            except Exception as pyopenssl_error:
                logger.warning(
                    "pyOpenSSL fallback failed for %s:%s; trying stdlib ssl. Reason: %r",
                    target.server_name,
                    target.port,
                    pyopenssl_error,
                )
                try:
                    return await asyncio.to_thread(self._probe_with_stdlib_ssl, target)
                except Exception as stdlib_error:
                    raise TLSProbeError(
                        "TLS probe failed for "
                        f"{target.server_name}:{target.port}: "
                        f"pyopenssl={pyopenssl_error}; stdlib_ssl={stdlib_error}"
                    ) from stdlib_error

    async def _probe_with_openssl_cli(self, target: TLSScanTarget) -> TLSProbeResult:
        """Use openssl s_client to perform a PQC-aware probe with refined hex detection."""
        host = target.hostname or target.ip_address
        openssl_path = "/usr/local/bin/openssl-oqs"
        connect_target = self._format_connect_target(target.ip_address, target.port)

        env = os.environ.copy()
        env["OPENSSL_CONF"] = "/opt/openssl/ssl/openssl.cnf"

        # We use -msg to parse negotiated groups from the ServerHello bytes.
        proc = await asyncio.create_subprocess_exec(
            openssl_path,
            "s_client",
            "-connect",
            connect_target,
            "-servername",
            host,
            "-groups",
            "X25519MLKEM768:X25519:P-256",
            "-msg",
            "-brief",
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            env=env,
        )

        try:
            stdout, stderr = await asyncio.wait_for(
                proc.communicate(b"\n"),
                timeout=self.timeout_seconds,
            )
        except asyncio.TimeoutError as exc:
            proc.kill()
            await proc.communicate()
            raise TLSProbeError(
                f"OpenSSL probe timed out after {self.timeout_seconds:.1f}s for "
                f"{target.server_name}:{target.port}"
            ) from exc

        output = (stdout + stderr).decode("utf-8", errors="ignore")

        # 1. PQC DETECTION (High-Fidelity Hex parsing)
        # We look for the Key Share extension (00 33) in the ServerHello (<<<)
        # followed by the MLKEM group ID (11 ec).
        server_messages = output.split("<<<")
        server_hello = ""
        for msg in server_messages:
            if "ServerHello" in msg:
                server_hello = msg
                break

        pqc_group = None
        if server_hello:
            # Clean up hex for regex matching (remove spaces and newlines)
            "".join(line.strip() for line in server_hello.splitlines() if not line.startswith(" "))
            # Actually OpenSSL labels the hex lines with indentation.
            hex_lines = [
                line.strip() for line in server_hello.splitlines() if line.startswith("    ")
            ]
            hex_str = "".join(hex_lines).replace(" ", "").lower()

            # Key Share extension ID: 0033
            # Group ID for X25519MLKEM768: 11ec
            # We look for 0033 followed by a 2-byte length and then 11ec
            if re.search(r"0033[0-9a-f]{4}11ec", hex_str):
                pqc_group = "X25519MLKEM768"
            elif "11ec" in hex_str and (
                "mlkem" in server_hello.lower() or "kyber" in server_hello.lower()
            ):
                pqc_group = "X25519MLKEM768"

        # 2. Protocol/Cipher extraction
        version_match = re.search(r"Protocol\s*(?::|is)\s*(\S+)", output, re.IGNORECASE) or re.search(
            r"\b(TLSv1\.[23])\b", output
        )
        cipher_match = re.search(r"Cipher\s*(?::|is)\s*(\S+)", output, re.IGNORECASE) or re.search(
            r"Ciphersuite\s*(?::|is)\s*(\S+)", output, re.IGNORECASE
        )

        if not pqc_group:
            group_match = re.search(r"Server Temp Key:\s*([^,]+)", output) or re.search(
                r"Negotiated TLS1.3 group:\s*(\S+)", output
            )
            negotiated_group = group_match.group(1).strip() if group_match else "UNKNOWN"
        else:
            negotiated_group = pqc_group

        tls_version = version_match.group(1).strip() if version_match else None
        cipher_suite = cipher_match.group(1).strip() if cipher_match else None

        if proc.returncode not in {0, 1} and (not tls_version or not cipher_suite):
            raise TLSProbeError(
                f"OpenSSL probe failed for {target.server_name}:{target.port} (rc={proc.returncode})"
            )

        # Do not emit fabricated UNKNOWN values; let classical fallback attempt recovery first.
        if not tls_version or not cipher_suite:
            raise TLSProbeError(
                f"OpenSSL probe returned incomplete metadata for {target.server_name}:{target.port}"
            )

        if "(" in str(negotiated_group):
            negotiated_group = str(negotiated_group).split("(")[0].strip()

        # 3. Cert chain via pyOpenSSL
        try:
            py_result = await asyncio.to_thread(self._probe_with_pyopenssl, target)
            chain = py_result.certificate_chain_pem
        except Exception:
            chain = ()

        return TLSProbeResult(
            hostname=target.hostname,
            ip_address=target.ip_address,
            port=target.port,
            protocol=target.protocol,
            tls_version=tls_version,
            cipher_suite=cipher_suite,
            certificate_chain_pem=chain,
            metadata={
                "source": "openssl-cli",
                "kex_algorithm": negotiated_group,
                "tmp_key": negotiated_group,
                "pqc_detected": pqc_group is not None,
            },
        )

    def _probe_with_pyopenssl(self, target: TLSScanTarget) -> TLSProbeResult:
        from OpenSSL import SSL, crypto

        env_backup = os.environ.copy()
        try:
            if "OPENSSL_CONF" in os.environ:
                del os.environ["OPENSSL_CONF"]
            if "LD_LIBRARY_PATH" in os.environ:
                del os.environ["LD_LIBRARY_PATH"]

            context = SSL.Context(SSL.TLS_CLIENT_METHOD)
            context.set_verify(SSL.VERIFY_NONE, lambda *_: True)
            timeout = max(2.0, min(self.timeout_seconds, 8.0))
            sock = socket.create_connection((target.ip_address, target.port), timeout=timeout)
            try:
                connection = SSL.Connection(context, sock)
                connection.set_connect_state()
                if target.hostname:
                    connection.set_tlsext_host_name(target.hostname.encode("utf-8"))
                connection.do_handshake()
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
                    tls_version=connection.get_protocol_version_name(),
                    cipher_suite=connection.get_cipher_name(),
                    certificate_chain_pem=certificate_chain_pem,
                    metadata={"source": "pyopenssl"},
                )
            finally:
                sock.close()
        finally:
            os.environ.clear()
            os.environ.update(env_backup)

    def _probe_with_stdlib_ssl(self, target: TLSScanTarget) -> TLSProbeResult:
        timeout = max(2.0, min(self.timeout_seconds, 8.0))
        host_for_sni = target.hostname or target.ip_address
        context = ssl.create_default_context()
        context.check_hostname = False
        context.verify_mode = ssl.CERT_NONE

        with socket.create_connection((target.ip_address, target.port), timeout=timeout) as sock:
            with context.wrap_socket(sock, server_hostname=host_for_sni) as wrapped:
                cert_der = wrapped.getpeercert(binary_form=True)
                if not cert_der:
                    raise TLSProbeError(
                        f"stdlib ssl probe returned no peer certificate for {target.server_name}:{target.port}"
                    )
                leaf_pem = ssl.DER_cert_to_PEM_cert(cert_der)
                return TLSProbeResult(
                    hostname=target.hostname,
                    ip_address=target.ip_address,
                    port=target.port,
                    protocol=target.protocol,
                    tls_version=wrapped.version(),
                    cipher_suite=(wrapped.cipher() or (None,))[0],
                    certificate_chain_pem=(leaf_pem,),
                    metadata={"source": "stdlib-ssl"},
                )

    @staticmethod
    def _format_connect_target(ip_address: str, port: int) -> str:
        """Format host:port for openssl, including bracketed IPv6 literals."""
        return f"[{ip_address}]:{port}" if ":" in ip_address else f"{ip_address}:{port}"
