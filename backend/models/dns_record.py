"""
DNSRecord Model.

Stores persisted DNS resolution results discovered during a scan.
"""

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Text, func, text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.core.base import Base


class DNSRecord(Base):
    """A DNS validation record persisted for one hostname in a scan."""

    __tablename__ = "dns_records"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    scan_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("scan_jobs.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    hostname: Mapped[str] = mapped_column(Text, nullable=False, index=True)
    resolved_ips: Mapped[list | None] = mapped_column(
        JSONB,
        nullable=False,
        default=list,
        server_default=text("'[]'::jsonb"),
    )
    cnames: Mapped[list | None] = mapped_column(
        JSONB,
        nullable=False,
        default=list,
        server_default=text("'[]'::jsonb"),
    )
    discovery_source: Mapped[str] = mapped_column(Text, nullable=False)
    is_in_scope: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
        server_default=text("true"),
    )
    discovered_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    scan_job = relationship("ScanJob", back_populates="dns_records")

    def __repr__(self) -> str:
        return f"<DNSRecord id={self.id} hostname={self.hostname!r}>"
