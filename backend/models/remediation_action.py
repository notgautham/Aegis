"""
RemediationAction Model.

Stores structured remediation tasks derived from remediation bundles.
"""

import enum
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, Text, func, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.core.base import Base


class RemediationPriority(str, enum.Enum):
    """Priority tier for a remediation action."""

    P1 = "P1"
    P2 = "P2"
    P3 = "P3"
    P4 = "P4"


class RemediationStatus(str, enum.Enum):
    """Lifecycle status for a remediation action."""

    NOT_STARTED = "not_started"
    IN_PROGRESS = "in_progress"
    DONE = "done"
    VERIFIED = "verified"


class RemediationEffort(str, enum.Enum):
    """Estimated implementation effort for a remediation action."""

    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


class RemediationAction(Base):
    """A structured remediation action attached to an asset."""

    __tablename__ = "remediation_actions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    asset_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("discovered_assets.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    remediation_bundle_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("remediation_bundles.id", ondelete="SET NULL"),
        nullable=True,
    )
    priority: Mapped[RemediationPriority] = mapped_column(
        Enum(
            RemediationPriority,
            name="remediation_priority",
            create_constraint=True,
            values_callable=lambda enum_cls: [member.value for member in enum_cls],
        ),
        nullable=False,
        index=True,
    )
    finding: Mapped[str] = mapped_column(Text, nullable=False)
    action: Mapped[str] = mapped_column(Text, nullable=False)
    effort: Mapped[RemediationEffort] = mapped_column(
        Enum(
            RemediationEffort,
            name="remediation_effort",
            create_constraint=True,
            values_callable=lambda enum_cls: [member.value for member in enum_cls],
        ),
        nullable=False,
    )
    status: Mapped[RemediationStatus] = mapped_column(
        Enum(
            RemediationStatus,
            name="remediation_status",
            create_constraint=True,
            values_callable=lambda enum_cls: [member.value for member in enum_cls],
        ),
        nullable=False,
        default=RemediationStatus.NOT_STARTED,
        server_default=text("'not_started'"),
        index=True,
    )
    category: Mapped[str | None] = mapped_column(Text, nullable=True)
    nist_reference: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    asset = relationship("DiscoveredAsset", back_populates="remediation_actions")
    remediation_bundle = relationship("RemediationBundle")

    def __repr__(self) -> str:
        return f"<RemediationAction id={self.id} priority={self.priority.value}>"
