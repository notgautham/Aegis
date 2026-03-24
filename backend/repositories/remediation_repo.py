"""
RemediationBundle Repository.

Extends BaseRepository with remediation-specific queries.
"""

import uuid
from typing import Sequence

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.models.remediation_bundle import RemediationBundle
from backend.repositories.base import BaseRepository


class RemediationBundleRepository(BaseRepository[RemediationBundle]):
    """Repository for RemediationBundle CRUD and asset-based queries."""

    def __init__(self, session: AsyncSession) -> None:
        super().__init__(RemediationBundle, session)

    async def get_by_asset_id(self, asset_id: uuid.UUID) -> Sequence[RemediationBundle]:
        """Retrieve all remediation bundles for a given asset."""
        stmt = select(RemediationBundle).where(RemediationBundle.asset_id == asset_id)
        result = await self.session.execute(stmt)
        return result.scalars().all()
