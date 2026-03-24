"""
ScanJob Repository.

Extends BaseRepository with scan-job-specific queries.
"""

from typing import Sequence

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.models.enums import ScanStatus
from backend.models.scan_job import ScanJob
from backend.repositories.base import BaseRepository


class ScanJobRepository(BaseRepository[ScanJob]):
    """Repository for ScanJob CRUD and status-based queries."""

    def __init__(self, session: AsyncSession) -> None:
        super().__init__(ScanJob, session)

    async def get_by_status(self, status: ScanStatus) -> Sequence[ScanJob]:
        """Retrieve all scan jobs with a given status."""
        stmt = select(ScanJob).where(ScanJob.status == status)
        result = await self.session.execute(stmt)
        return result.scalars().all()
