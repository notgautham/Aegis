"""
ORM model registry for metadata loading.

Import this module anywhere SQLAlchemy metadata needs every model
class registered on the declarative base.
"""

from backend.core.base import Base
from backend.models.cbom_document import CbomDocument
from backend.models.certificate_chain import CertificateChain
from backend.models.compliance_certificate import ComplianceCertificate
from backend.models.crypto_assessment import CryptoAssessment
from backend.models.discovered_asset import DiscoveredAsset
from backend.models.remediation_bundle import RemediationBundle
from backend.models.scan_job import ScanJob

__all__ = [
    "Base",
    "ScanJob",
    "DiscoveredAsset",
    "CryptoAssessment",
    "CertificateChain",
    "CbomDocument",
    "ComplianceCertificate",
    "RemediationBundle",
]
