"""
RemediationBundle Model.

Stores RAG-generated remediation artifacts: HNDL timelines,
server-specific patches, and migration roadmaps.
See IMPLEMENTATION.md Section 5.1 — remediation_bundles table.
"""

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.core.database import Base


class RemediationBundle(Base):
    """RAG-generated remediation data for a vulnerable or transitioning asset."""

    __tablename__ = "remediation_bundles"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    asset_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("discovered_assets.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # ── RAG-Generated Content ───────────────────────────
    hndl_timeline: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    patch_config: Mapped[str | None] = mapped_column(Text, nullable=True)
    migration_roadmap: Mapped[str | None] = mapped_column(Text, nullable=True)
    source_citations: Mapped[dict | None] = mapped_column(JSONB, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    # ── Relationships ───────────────────────────────────
    asset = relationship("DiscoveredAsset", back_populates="remediation_bundles")

    def __repr__(self) -> str:
        return f"<RemediationBundle id={self.id} asset_id={self.asset_id}>"
