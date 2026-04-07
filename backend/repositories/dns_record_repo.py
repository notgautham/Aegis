"""
DNSRecord Repository.

Extends BaseRepository with DNS-record-specific queries.
"""

import uuid
from typing import Sequence

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.models.dns_record import DNSRecord
from backend.repositories.base import BaseRepository


class DNSRecordRepository(BaseRepository[DNSRecord]):
    """Repository for DNSRecord CRUD and scan-based queries."""

    def __init__(self, session: AsyncSession) -> None:
        super().__init__(DNSRecord, session)

    async def get_by_scan_id(self, scan_id: uuid.UUID) -> Sequence[DNSRecord]:
        """Retrieve all DNS records for a given scan."""
        stmt = select(DNSRecord).where(DNSRecord.scan_id == scan_id)
        result = await self.session.execute(stmt)
        return result.scalars().all()
