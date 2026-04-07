"""
Aegis Database Models.

Re-exports all SQLAlchemy ORM models and the declarative Base
for convenient imports throughout the application.
"""

from backend.core.base import Base
from backend.models.enums import CertLevel, ComplianceTier, ScanStatus, ServiceType
from backend.models.scan_job import ScanJob
from backend.models.discovered_asset import DiscoveredAsset
from backend.models.crypto_assessment import CryptoAssessment
from backend.models.certificate_chain import CertificateChain
from backend.models.cbom_document import CbomDocument
from backend.models.compliance_certificate import ComplianceCertificate
from backend.models.remediation_bundle import RemediationBundle
from backend.models.scan_event import ScanEvent
from backend.models.dns_record import DNSRecord
from backend.models.asset_fingerprint import AssetFingerprint
from backend.models.remediation_action import (
    RemediationAction,
    RemediationEffort,
    RemediationPriority,
    RemediationStatus,
)

__all__ = [
    "Base",
    "ScanStatus",
    "ComplianceTier",
    "CertLevel",
    "ServiceType",
    "ScanJob",
    "DiscoveredAsset",
    "CryptoAssessment",
    "CertificateChain",
    "CbomDocument",
    "ComplianceCertificate",
    "RemediationBundle",
    "ScanEvent",
    "DNSRecord",
    "AssetFingerprint",
    "RemediationAction",
    "RemediationPriority",
    "RemediationStatus",
    "RemediationEffort",
]
