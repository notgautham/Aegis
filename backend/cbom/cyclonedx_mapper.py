"""
CycloneDX 1.6 CBOM mapping, validation, persistence, and export helpers.
"""

from __future__ import annotations

import io
import re
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any, Mapping, Sequence

from jsonschema import validate
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas

from backend.compliance.rules_engine import ComplianceEvaluation, apply_compliance_tier
from backend.models.certificate_chain import CertificateChain
from backend.models.crypto_assessment import CryptoAssessment
from backend.models.discovered_asset import DiscoveredAsset
from backend.models.enums import CertLevel
from backend.repositories.cbom_repo import CbomDocumentRepository
from backend.repositories.crypto_assessment_repo import CryptoAssessmentRepository


_CBOM_SCHEMA: dict[str, Any] = {
    "type": "object",
    "required": [
        "bomFormat",
        "specVersion",
        "serialNumber",
        "metadata",
        "components",
        "quantumRiskSummary",
    ],
    "properties": {
        "bomFormat": {"const": "CycloneDX"},
        "specVersion": {"const": "1.6"},
        "serialNumber": {"type": "string", "minLength": 1},
        "metadata": {
            "type": "object",
            "required": ["timestamp", "tools", "component"],
            "properties": {
                "timestamp": {"type": "string", "minLength": 1},
                "tools": {"type": "array", "minItems": 1},
                "component": {
                    "type": "object",
                    "required": ["type", "name"],
                    "properties": {
                        "type": {"const": "service"},
                        "name": {"type": "string", "minLength": 1},
                    },
                },
            },
        },
        "components": {
            "type": "array",
            "minItems": 1,
            "items": {
                "type": "object",
                "required": ["type", "bom-ref", "name", "cryptoProperties"],
                "properties": {
                    "type": {"const": "cryptographic-asset"},
                    "bom-ref": {"type": "string", "minLength": 1},
                    "name": {"type": "string", "minLength": 1},
                    "cryptoProperties": {
                        "type": "object",
                        "required": ["assetType", "tlsProperties", "certificateProperties"],
                        "properties": {
                            "assetType": {"type": "string", "minLength": 1},
                            "tlsProperties": {"type": "object"},
                            "certificateProperties": {"type": "object"},
                        },
                    },
                },
            },
        },
        "quantumRiskSummary": {
            "type": "object",
            "required": [
                "overallScore",
                "tier",
                "hndlUrgency",
                "estimatedBreakYear",
                "priorityActions",
            ],
            "properties": {
                "overallScore": {"type": ["number", "null"]},
                "tier": {"type": "string", "minLength": 1},
                "hndlUrgency": {"type": ["string", "null"]},
                "estimatedBreakYear": {"type": ["integer", "null"]},
                "priorityActions": {"type": "array"},
            },
        },
    },
}


@dataclass(frozen=True, slots=True)
class AssetCbomBundle:
    """Asset-centric input bundle for one CBOM document."""

    asset: DiscoveredAsset
    assessment: CryptoAssessment
    certificates: Sequence[CertificateChain]
    compliance: ComplianceEvaluation


class CycloneDxMapper:
    """Map analyzed asset bundles into validated CycloneDX 1.6 CBOM documents."""

    @staticmethod
    def _serial_asset_identifier(asset: DiscoveredAsset) -> str:
        """Return the human-readable identifier portion of the CBOM serial."""
        return asset.hostname or asset.ip_address or "unknown-asset"

    def build_serial_number(
        self,
        asset: DiscoveredAsset,
        *,
        timestamp: datetime | None = None,
    ) -> str:
        """Build a unique scan-scoped Aegis URN for one persisted asset."""
        effective_timestamp = timestamp or datetime.now(UTC)
        asset_identifier = self._serial_asset_identifier(asset)
        # Include port and unique ID to ensure DB uniqueness
        return f"urn:uuid:aegis-scan-{effective_timestamp:%Y%m%d}-{asset_identifier}-{asset.port}-{asset.id or 'new'}"

    def map_asset_bundle(
        self,
        bundle: AssetCbomBundle,
        *,
        timestamp: datetime | None = None,
        hndl_urgency: str | None = None,
        estimated_break_year: int | None = None,
    ) -> dict[str, Any]:
        """Map one asset bundle into a CycloneDX 1.6-compatible CBOM document."""
        effective_timestamp = timestamp or datetime.now(UTC)
        asset_name = bundle.asset.hostname or bundle.asset.ip_address or "unknown-asset"
        serial_number = self.build_serial_number(bundle.asset, timestamp=effective_timestamp)
        leaf_certificate = self._select_leaf_certificate(bundle.certificates)
        bom_ref = self._build_bom_ref(bundle.asset)

        document = {
            "bomFormat": "CycloneDX",
            "specVersion": "1.6",
            "serialNumber": serial_number,
            "metadata": {
                "timestamp": effective_timestamp.isoformat().replace("+00:00", "Z"),
                "tools": [{"name": "Aegis", "version": "0.1.0"}],
                "component": {"type": "service", "name": asset_name},
            },
            "components": [
                {
                    "type": "cryptographic-asset",
                    "bom-ref": bom_ref,
                    "name": asset_name,
                    "cryptoProperties": {
                        "assetType": "protocol",
                        "tlsProperties": {
                            "version": bundle.assessment.tls_version,
                            "cipherSuites": [bundle.assessment.cipher_suite]
                            if bundle.assessment.cipher_suite
                            else [],
                            "keyExchange": bundle.assessment.kex_algorithm,
                            "authentication": bundle.assessment.auth_algorithm,
                            "encryption": bundle.assessment.enc_algorithm,
                            "integrity": bundle.assessment.mac_algorithm,
                        },
                        "certificateProperties": {
                            "subjectPublicKeyAlgorithm": leaf_certificate.public_key_algorithm
                            if leaf_certificate
                            else None,
                            "subjectPublicKeySize": leaf_certificate.key_size_bits
                            if leaf_certificate
                            else None,
                            "signatureAlgorithm": leaf_certificate.signature_algorithm
                            if leaf_certificate
                            else None,
                            "quantumSafe": leaf_certificate.quantum_safe if leaf_certificate else None,
                        },
                    },
                }
            ],
            "quantumRiskSummary": {
                "overallScore": bundle.assessment.risk_score,
                "tier": bundle.compliance.tier.value,
                "hndlUrgency": hndl_urgency,
                "estimatedBreakYear": estimated_break_year,
                "priorityActions": list(self._build_priority_actions(bundle.compliance)),
            },
        }
        self.validate_cbom(document)
        return document

    def validate_cbom(self, cbom_document: Mapping[str, Any]) -> None:
        """Validate a CBOM document against the local CycloneDX contract."""
        validate(instance=dict(cbom_document), schema=_CBOM_SCHEMA)

    async def persist_cbom(
        self,
        *,
        bundle: AssetCbomBundle,
        cbom_repository: CbomDocumentRepository,
        timestamp: datetime | None = None,
    ):
        """Validate and persist one CBOM document, updating the assessment tier in-session."""
        document = self.map_asset_bundle(bundle, timestamp=timestamp)
        assessment_repo = CryptoAssessmentRepository(cbom_repository.session)

        apply_compliance_tier(bundle.assessment, bundle.compliance)
        await assessment_repo.update(
            bundle.assessment.id,
            compliance_tier=bundle.assessment.compliance_tier,
        )

        return await cbom_repository.create(
            scan_id=bundle.asset.scan_id,
            asset_id=bundle.asset.id,
            serial_number=document["serialNumber"],
            cbom_json=document,
        )

    def export_json(
        self,
        cbom_document: Mapping[str, Any],
    ) -> tuple[dict[str, Any], str]:
        """Return a validated JSON export payload and deterministic filename stem."""
        document = dict(cbom_document)
        self.validate_cbom(document)
        return document, self._filename_stem(document["serialNumber"])

    def export_pdf(
        self,
        cbom_document: Mapping[str, Any],
    ) -> tuple[bytes, str]:
        """Render a compact PDF report from a validated CBOM document."""
        document = dict(cbom_document)
        self.validate_cbom(document)
        buffer = io.BytesIO()
        pdf = canvas.Canvas(buffer, pagesize=letter, pageCompression=0)

        y_position = 750
        for line in self._build_pdf_lines(document):
            pdf.drawString(72, y_position, line)
            y_position -= 16
            if y_position < 72:
                pdf.showPage()
                y_position = 750

        pdf.save()
        return buffer.getvalue(), self._filename_stem(document["serialNumber"])

    @staticmethod
    def _select_leaf_certificate(
        certificates: Sequence[CertificateChain],
    ) -> CertificateChain | None:
        for certificate in certificates:
            if certificate.cert_level == CertLevel.LEAF:
                return certificate
        return certificates[0] if certificates else None

    @staticmethod
    def _build_bom_ref(asset: DiscoveredAsset) -> str:
        identifier = asset.hostname or asset.ip_address or "unknown-asset"
        sanitized = re.sub(r"[^A-Za-z0-9._-]+", "-", identifier)
        return f"tls-{sanitized}-{asset.port}"

    @staticmethod
    def _build_priority_actions(evaluation: ComplianceEvaluation) -> tuple[str, ...]:
        actions: list[str] = []
        if evaluation.kex.status.value in {"FAIL", "HYBRID"}:
            actions.append("migrate-key-exchange")
        if evaluation.sig.status.value in {"FAIL", "HYBRID"}:
            actions.append("migrate-signature-algorithm")
        if evaluation.sym.status.value in {"FAIL", "WARN"}:
            actions.append("upgrade-symmetric-encryption")
        return tuple(actions)

    @staticmethod
    def _filename_stem(serial_number: str) -> str:
        return re.sub(r"[^A-Za-z0-9._-]+", "-", serial_number).strip("-")

    @staticmethod
    def _build_pdf_lines(cbom_document: Mapping[str, Any]) -> list[str]:
        metadata = cbom_document["metadata"]
        component = cbom_document["components"][0]
        tls_properties = component["cryptoProperties"]["tlsProperties"]
        certificate_properties = component["cryptoProperties"]["certificateProperties"]
        risk_summary = cbom_document["quantumRiskSummary"]

        return [
            "Aegis CycloneDX CBOM Report",
            f"Serial Number: {cbom_document['serialNumber']}",
            f"Asset: {metadata['component']['name']}",
            f"TLS Version: {tls_properties.get('version')}",
            f"Cipher Suite: {', '.join(tls_properties.get('cipherSuites', []))}",
            f"Key Exchange: {tls_properties.get('keyExchange')}",
            f"Authentication: {tls_properties.get('authentication')}",
            f"Encryption: {tls_properties.get('encryption')}",
            f"Integrity: {tls_properties.get('integrity')}",
            f"Risk Score: {risk_summary.get('overallScore')}",
            f"Compliance Tier: {risk_summary.get('tier')}",
            f"Certificate Algorithm: {certificate_properties.get('subjectPublicKeyAlgorithm')}",
            f"Certificate Signature: {certificate_properties.get('signatureAlgorithm')}",
            f"Certificate Quantum Safe: {certificate_properties.get('quantumSafe')}",
            f"Priority Actions: {', '.join(risk_summary.get('priorityActions', [])) or 'none'}",
        ]
