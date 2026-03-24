"""
CbomDocument Model.

Stores CycloneDX 1.6 Cryptographic Bill of Materials as JSONB.
See IMPLEMENTATION.md Section 5.1 — cbom_documents table.
"""

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.core.database import Base


class CbomDocument(Base):
    """A CycloneDX 1.6 CBOM document stored as JSONB."""

    __tablename__ = "cbom_documents"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    scan_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("scan_jobs.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    asset_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("discovered_assets.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    serial_number: Mapped[str] = mapped_column(
        Text, nullable=False, unique=True
    )
    cbom_json: Mapped[dict] = mapped_column(JSONB, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    # ── Relationships ───────────────────────────────────
    scan_job = relationship("ScanJob", back_populates="cbom_documents")
    asset = relationship("DiscoveredAsset", back_populates="cbom_documents")

    def __repr__(self) -> str:
        return f"<CbomDocument id={self.id} serial={self.serial_number!r}>"
