"""
CryptoAssessment Repository.

Extends BaseRepository with assessment-specific queries.
"""

import uuid
from typing import Sequence

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.models.crypto_assessment import CryptoAssessment
from backend.repositories.base import BaseRepository


class CryptoAssessmentRepository(BaseRepository[CryptoAssessment]):
    """Repository for CryptoAssessment CRUD and asset-based queries."""

    def __init__(self, session: AsyncSession) -> None:
        super().__init__(CryptoAssessment, session)

    async def get_by_asset_id(self, asset_id: uuid.UUID) -> Sequence[CryptoAssessment]:
        """Retrieve all crypto assessments for a given asset."""
        stmt = select(CryptoAssessment).where(CryptoAssessment.asset_id == asset_id)
        result = await self.session.execute(stmt)
        return result.scalars().all()
