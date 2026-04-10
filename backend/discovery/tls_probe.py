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

from backend.discovery.types import TLSProbeResult, TLSScanTarget

logger = logging.getLogger(__name__)

class TLSProbeError(RuntimeError):
    """Raised when a TLS probe cannot be completed."""


class TLSProbe:
    """Probe a TLS endpoint and capture negotiated metadata."""

    def __init__(self, timeout_seconds: float = 15.0) -> None:
        self.timeout_seconds = timeout_seconds

    async def probe(self, target: TLSScanTarget) -> TLSProbeResult:
        """Probe the target using openssl cli (PQC-aware)."""
        try:
            return await self._probe_with_openssl_cli(target)
        except Exception as e:
            logger.warning("PQC Probe failed, falling back to classical: %s", e)
            return await asyncio.to_thread(self._probe_with_pyopenssl, target)

    async def _probe_with_openssl_cli(self, target: TLSScanTarget) -> TLSProbeResult:
        """Use openssl s_client to perform a PQC-aware probe with refined hex detection."""
        host = target.hostname or target.ip_address
        openssl_path = "/usr/local/bin/openssl-oqs"
        
        env = os.environ.copy()
        env["OPENSSL_CONF"] = "/opt/openssl/ssl/openssl.cnf"
        
        # We use -msg to get the hex dump of the handshake
        cmd = f"echo | {openssl_path} s_client -connect {target.ip_address}:{target.port} -servername {host} -groups X25519MLKEM768:X25519:P-256 -msg 2>&1"
        
        proc = await asyncio.create_subprocess_shell(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            env=env
        )
        
        stdout, _ = await proc.communicate()
        output = stdout.decode("utf-8", errors="ignore")
        
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
            hex_lines = [line.strip() for line in server_hello.splitlines() if line.startswith("    ")]
            hex_str = "".join(hex_lines).replace(" ", "").lower()
            
            # Key Share extension ID: 0033
            # Group ID for X25519MLKEM768: 11ec
            # We look for 0033 followed by a 2-byte length and then 11ec
            if re.search(r"0033[0-9a-f]{4}11ec", hex_str):
                pqc_group = "X25519MLKEM768"
            elif "11ec" in hex_str and ("mlkem" in server_hello.lower() or "kyber" in server_hello.lower()):
                pqc_group = "X25519MLKEM768"
            
        # 2. Protocol/Cipher extraction
        version_match = re.search(r"Protocol\s*(?::|is)\s*(\S+)", output, re.IGNORECASE)
        cipher_match = re.search(r"Cipher\s*(?::|is)\s*(\S+)", output, re.IGNORECASE) or \
                       re.search(r"Ciphersuite\s*(?::|is)\s*(\S+)", output, re.IGNORECASE)
        
        if not pqc_group:
            group_match = re.search(r"Server Temp Key:\s*([^,]+)", output) or \
                          re.search(r"Negotiated TLS1.3 group:\s*(\S+)", output)
            negotiated_group = group_match.group(1).strip() if group_match else "UNKNOWN"
        else:
            negotiated_group = pqc_group
        
        tls_version = version_match.group(1).strip() if version_match else "TLSv1.3"
        cipher_suite = cipher_match.group(1).strip() if cipher_match else "UNKNOWN"

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
                "pqc_detected": pqc_group is not None
            }
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
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.settimeout(5.0)
            try:
                sock.connect((target.ip_address, target.port))
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
                    hostname=target.hostname, ip_address=target.ip_address, port=target.port, protocol=target.protocol,
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
        return self._probe_with_pyopenssl(target)
