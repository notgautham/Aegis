"""
CertificateChain Model.

Stores individual certificates from a TLS certificate chain.
See IMPLEMENTATION.md Section 5.1 — certificate_chains table.
"""

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, Integer, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.core.base import Base
from backend.models.enums import CertLevel


class CertificateChain(Base):
    """A single certificate (leaf, intermediate, or root) from a TLS chain."""

    __tablename__ = "certificate_chains"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    asset_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("discovered_assets.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # ── Certificate Position ────────────────────────────
    cert_level: Mapped[CertLevel] = mapped_column(
        Enum(CertLevel, name="cert_level", create_constraint=True),
        nullable=False,
    )

    # ── Certificate Metadata ───────────────────────────
    subject: Mapped[str | None] = mapped_column(Text, nullable=True)
    issuer: Mapped[str | None] = mapped_column(Text, nullable=True)
    public_key_algorithm: Mapped[str | None] = mapped_column(Text, nullable=True)
    key_size_bits: Mapped[int | None] = mapped_column(Integer, nullable=True)
    signature_algorithm: Mapped[str | None] = mapped_column(Text, nullable=True)
    quantum_safe: Mapped[bool | None] = mapped_column(Boolean, nullable=True)

    # ── Validity Period ─────────────────────────────────
    not_before: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    not_after: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # ── Relationships ───────────────────────────────────
    asset = relationship("DiscoveredAsset", back_populates="certificate_chains")

    def __repr__(self) -> str:
        return (
            f"<CertificateChain id={self.id} "
            f"level={self.cert_level.value} subject={self.subject!r}>"
        )
