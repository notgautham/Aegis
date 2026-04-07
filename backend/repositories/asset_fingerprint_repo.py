"""
AssetFingerprint Repository.

Extends BaseRepository with asset-fingerprint-specific queries.
"""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.models.asset_fingerprint import AssetFingerprint
from backend.repositories.base import BaseRepository


class AssetFingerprintRepository(BaseRepository[AssetFingerprint]):
    """Repository for AssetFingerprint CRUD and canonical-key lookups."""

    def __init__(self, session: AsyncSession) -> None:
        super().__init__(AssetFingerprint, session)

    async def get_by_canonical_key(self, key: str) -> AssetFingerprint | None:
        """Retrieve one asset fingerprint by its canonical identity key."""
        stmt = select(AssetFingerprint).where(AssetFingerprint.canonical_key == key)
        result = await self.session.execute(stmt)
        return result.scalars().first()
