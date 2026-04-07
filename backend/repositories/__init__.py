"""Aegis Repository Layer — re-exports all repositories."""

from backend.repositories.base import BaseRepository
from backend.repositories.scan_job_repo import ScanJobRepository
from backend.repositories.asset_repo import DiscoveredAssetRepository
from backend.repositories.crypto_assessment_repo import CryptoAssessmentRepository
from backend.repositories.certificate_chain_repo import CertificateChainRepository
from backend.repositories.cbom_repo import CbomDocumentRepository
from backend.repositories.compliance_cert_repo import ComplianceCertificateRepository
from backend.repositories.remediation_repo import RemediationBundleRepository
from backend.repositories.scan_event_repo import ScanEventRepository
from backend.repositories.dns_record_repo import DNSRecordRepository
from backend.repositories.asset_fingerprint_repo import AssetFingerprintRepository

__all__ = [
    "BaseRepository",
    "ScanJobRepository",
    "DiscoveredAssetRepository",
    "CryptoAssessmentRepository",
    "CertificateChainRepository",
    "CbomDocumentRepository",
    "ComplianceCertificateRepository",
    "RemediationBundleRepository",
    "ScanEventRepository",
    "DNSRecordRepository",
    "AssetFingerprintRepository",
]
