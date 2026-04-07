"""
AssetFingerprint Model.

Stores stable cross-scan identity and score history for logical assets.
"""

import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, Text, text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.core.base import Base
from backend.models.enums import ComplianceTier


class AssetFingerprint(Base):
    """A stable logical asset identity used to track history across scans."""

    __tablename__ = "asset_fingerprints"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    canonical_key: Mapped[str] = mapped_column(Text, nullable=False, unique=True)
    first_seen_scan_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("scan_jobs.id", ondelete="SET NULL"),
        nullable=True,
    )
    last_seen_scan_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("scan_jobs.id", ondelete="SET NULL"),
        nullable=True,
    )
    first_seen_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    last_seen_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, index=True
    )
    appearance_count: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=1,
        server_default=text("1"),
    )
    q_score_history: Mapped[list] = mapped_column(
        JSONB,
        nullable=False,
        default=list,
        server_default=text("'[]'::jsonb"),
    )
    latest_q_score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    latest_compliance_tier: Mapped[ComplianceTier | None] = mapped_column(
        Enum(ComplianceTier, name="compliance_tier", create_constraint=True),
        nullable=True,
    )

    first_seen_scan = relationship("ScanJob", foreign_keys=[first_seen_scan_id])
    last_seen_scan = relationship("ScanJob", foreign_keys=[last_seen_scan_id])

    def __repr__(self) -> str:
        return f"<AssetFingerprint id={self.id} canonical_key={self.canonical_key!r}>"
