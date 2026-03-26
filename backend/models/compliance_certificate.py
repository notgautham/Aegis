"""
ComplianceCertificate Model.

Stores signed X.509 compliance certificates issued per asset.
See IMPLEMENTATION.md Section 5.1 — compliance_certificates table.
"""

import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.core.base import Base
from backend.models.enums import ComplianceTier


class ComplianceCertificate(Base):
    """A signed X.509 compliance certificate for an assessed asset."""

    __tablename__ = "compliance_certificates"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    asset_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("discovered_assets.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    tier: Mapped[ComplianceTier] = mapped_column(
        Enum(ComplianceTier, name="compliance_tier", create_constraint=True),
        nullable=False,
    )
    certificate_pem: Mapped[str] = mapped_column(Text, nullable=False)
    signing_algorithm: Mapped[str] = mapped_column(Text, nullable=False)

    # ── Validity Period ─────────────────────────────────
    valid_from: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    valid_until: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )

    # ── Extension Data ──────────────────────────────────
    extensions_json: Mapped[dict | None] = mapped_column(JSONB, nullable=True)

    # ── Optional link to remediation for Tier 3 ─────────
    remediation_bundle_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("remediation_bundles.id", ondelete="SET NULL"),
        nullable=True,
    )

    # ── Relationships ───────────────────────────────────
    asset = relationship("DiscoveredAsset", back_populates="compliance_certificates")
    remediation_bundle = relationship("RemediationBundle", foreign_keys=[remediation_bundle_id])

    def __repr__(self) -> str:
        return (
            f"<ComplianceCertificate id={self.id} "
            f"tier={self.tier.value} algo={self.signing_algorithm}>"
        )
