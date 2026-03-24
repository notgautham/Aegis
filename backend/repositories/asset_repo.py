"""
DiscoveredAsset Repository.

Extends BaseRepository with asset-specific queries.
"""

import uuid
from typing import Sequence

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.models.discovered_asset import DiscoveredAsset
from backend.repositories.base import BaseRepository


class DiscoveredAssetRepository(BaseRepository[DiscoveredAsset]):
    """Repository for DiscoveredAsset CRUD and scan-based queries."""

    def __init__(self, session: AsyncSession) -> None:
        super().__init__(DiscoveredAsset, session)

    async def get_by_scan_id(self, scan_id: uuid.UUID) -> Sequence[DiscoveredAsset]:
        """Retrieve all assets discovered in a given scan."""
        stmt = select(DiscoveredAsset).where(DiscoveredAsset.scan_id == scan_id)
        result = await self.session.execute(stmt)
        return result.scalars().all()
