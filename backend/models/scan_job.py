"""
ScanJob Model.

Represents a single scan request targeting a domain, IP, or CIDR range.
See IMPLEMENTATION.md Section 5.1 — scan_jobs table.
"""

import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.core.base import Base
from backend.models.enums import ScanStatus


class ScanJob(Base):
    """A scan job targeting a domain, IP address, or CIDR range."""

    __tablename__ = "scan_jobs"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    target: Mapped[str] = mapped_column(Text, nullable=False, index=True)
    status: Mapped[ScanStatus] = mapped_column(
        Enum(ScanStatus, name="scan_status", create_constraint=True),
        nullable=False,
        default=ScanStatus.PENDING,
        index=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    completed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    scan_profile: Mapped[str | None] = mapped_column(Text, nullable=True)
    initiated_by: Mapped[str | None] = mapped_column(Text, nullable=True)

    # ── Relationships ───────────────────────────────────
    discovered_assets = relationship(
        "DiscoveredAsset", back_populates="scan_job", cascade="all, delete-orphan"
    )
    cbom_documents = relationship(
        "CbomDocument", back_populates="scan_job", cascade="all, delete-orphan"
    )
    dns_records = relationship(
        "DNSRecord", back_populates="scan_job", cascade="all, delete-orphan"
    )
    scan_events = relationship(
        "ScanEvent", back_populates="scan_job", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<ScanJob id={self.id} target={self.target!r} status={self.status.value}>"


from backend.models.asset_fingerprint import AssetFingerprint  # noqa: E402,F401
from backend.models.dns_record import DNSRecord  # noqa: E402,F401
from backend.models.scan_event import ScanEvent  # noqa: E402,F401
