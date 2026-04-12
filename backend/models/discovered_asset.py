"""
DiscoveredAsset Model.

Represents a single cryptographic surface discovered during a scan.
See IMPLEMENTATION.md Section 5.1 — discovered_assets table.
"""

import uuid

from sqlalchemy import Boolean, Enum, ForeignKey, Integer, String, Text, text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.core.base import Base
from backend.models.enums import ServiceType


class DiscoveredAsset(Base):
    """A public-facing cryptographic endpoint discovered by the scan."""

    __tablename__ = "discovered_assets"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    scan_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("scan_jobs.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    hostname: Mapped[str | None] = mapped_column(Text, nullable=True)
    ip_address: Mapped[str | None] = mapped_column(Text, nullable=True)
    port: Mapped[int] = mapped_column(Integer, nullable=False)
    protocol: Mapped[str] = mapped_column(String(10), nullable=False, default="tcp")
    service_type: Mapped[ServiceType | None] = mapped_column(
        Enum(ServiceType, name="service_type", create_constraint=True),
        nullable=True,
    )
    server_software: Mapped[str | None] = mapped_column(Text, nullable=True)
    open_ports: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    asset_metadata: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    is_shadow_it: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
        server_default=text("false"),
    )
    discovery_source: Mapped[str | None] = mapped_column(Text, nullable=True)

    # ── Relationships ───────────────────────────────────
    scan_job = relationship("ScanJob", back_populates="discovered_assets")
    crypto_assessments = relationship(
        "CryptoAssessment", back_populates="asset", cascade="all, delete-orphan"
    )
    certificate_chains = relationship(
        "CertificateChain", back_populates="asset", cascade="all, delete-orphan"
    )
    cbom_documents = relationship(
        "CbomDocument", back_populates="asset", cascade="all, delete-orphan"
    )
    compliance_certificates = relationship(
        "ComplianceCertificate", back_populates="asset", cascade="all, delete-orphan"
    )
    remediation_bundles = relationship(
        "RemediationBundle", back_populates="asset", cascade="all, delete-orphan"
    )
    remediation_actions = relationship(
        "RemediationAction", back_populates="asset", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<DiscoveredAsset id={self.id} host={self.hostname}:{self.port}/{self.protocol}>"


from backend.models.remediation_action import RemediationAction  # noqa: E402,F401
