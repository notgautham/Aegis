"""
CryptoAssessment Model.

Stores the decomposed cipher suite analysis and quantum risk score for an asset.
See IMPLEMENTATION.md Section 5.1 — crypto_assessments table.
"""

import uuid

from sqlalchemy import Enum, Float, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.core.base import Base
from backend.models.enums import ComplianceTier


class CryptoAssessment(Base):
    """Cipher suite decomposition, vulnerability values, and risk score for an asset."""

    __tablename__ = "crypto_assessments"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    asset_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("discovered_assets.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # ── TLS Details ─────────────────────────────────────
    tls_version: Mapped[str | None] = mapped_column(Text, nullable=True)
    cipher_suite: Mapped[str | None] = mapped_column(Text, nullable=True)

    # ── Decomposed Algorithms ───────────────────────────
    kex_algorithm: Mapped[str | None] = mapped_column(Text, nullable=True)
    auth_algorithm: Mapped[str | None] = mapped_column(Text, nullable=True)
    enc_algorithm: Mapped[str | None] = mapped_column(Text, nullable=True)
    mac_algorithm: Mapped[str | None] = mapped_column(Text, nullable=True)

    # ── Vulnerability Values (0.00–1.00) ────────────────
    kex_vulnerability: Mapped[float | None] = mapped_column(Float, nullable=True)
    sig_vulnerability: Mapped[float | None] = mapped_column(Float, nullable=True)
    sym_vulnerability: Mapped[float | None] = mapped_column(Float, nullable=True)
    tls_vulnerability: Mapped[float | None] = mapped_column(Float, nullable=True)

    # ── Computed Risk Score (0–100) ─────────────────────
    risk_score: Mapped[float | None] = mapped_column(Float, nullable=True)

    # ── Compliance Tier ─────────────────────────────────
    compliance_tier: Mapped[ComplianceTier | None] = mapped_column(
        Enum(ComplianceTier, name="compliance_tier", create_constraint=True),
        nullable=True,
    )

    # ── Relationships ───────────────────────────────────
    asset = relationship("DiscoveredAsset", back_populates="crypto_assessments")

    def __repr__(self) -> str:
        return (
            f"<CryptoAssessment id={self.id} "
            f"cipher={self.cipher_suite!r} score={self.risk_score}>"
        )
