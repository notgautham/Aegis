"""
ScanEvent Model.

Stores persistent audit events for scan execution.
"""

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.core.base import Base


class ScanEvent(Base):
    """A persisted scan event emitted during pipeline execution."""

    __tablename__ = "scan_events"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    scan_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("scan_jobs.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    kind: Mapped[str] = mapped_column(Text, nullable=False)
    stage: Mapped[str | None] = mapped_column(Text, nullable=True)
    message: Mapped[str] = mapped_column(Text, nullable=False)

    scan_job = relationship("ScanJob", back_populates="scan_events")

    def __repr__(self) -> str:
        return f"<ScanEvent id={self.id} scan_id={self.scan_id} kind={self.kind!r}>"
