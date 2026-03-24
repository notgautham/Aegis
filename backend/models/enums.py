"""
Aegis Enum Definitions.

Python enums used as column types across SQLAlchemy models.
These map to PostgreSQL ENUM types via SQLAlchemy.
"""

import enum


class ScanStatus(str, enum.Enum):
    """Status of a scan job."""

    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"


class ComplianceTier(str, enum.Enum):
    """PQC compliance classification tier."""

    FULLY_QUANTUM_SAFE = "FULLY_QUANTUM_SAFE"
    PQC_TRANSITIONING = "PQC_TRANSITIONING"
    QUANTUM_VULNERABLE = "QUANTUM_VULNERABLE"


class CertLevel(str, enum.Enum):
    """Certificate position in the chain."""

    LEAF = "leaf"
    INTERMEDIATE = "intermediate"
    ROOT = "root"


class ServiceType(str, enum.Enum):
    """Type of discovered cryptographic service."""

    TLS = "tls"
    VPN = "vpn"
    API = "api"
