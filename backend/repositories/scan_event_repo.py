"""
ScanEvent Repository.

Extends BaseRepository with scan-event-specific queries.
"""

import uuid
from typing import Sequence

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.models.scan_event import ScanEvent
from backend.repositories.base import BaseRepository


class ScanEventRepository(BaseRepository[ScanEvent]):
    """Repository for ScanEvent CRUD and scan-based queries."""

    def __init__(self, session: AsyncSession) -> None:
        super().__init__(ScanEvent, session)

    async def get_by_scan_id(self, scan_id: uuid.UUID) -> Sequence[ScanEvent]:
        """Retrieve all persisted events for a given scan."""
        stmt = select(ScanEvent).where(ScanEvent.scan_id == scan_id)
        result = await self.session.execute(stmt)
        return result.scalars().all()
