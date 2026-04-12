"""
AssetFingerprint Repository.

Extends BaseRepository with asset-fingerprint-specific queries.
"""

from collections.abc import Sequence

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

    async def get_by_canonical_keys(
        self,
        keys: Sequence[str],
    ) -> Sequence[AssetFingerprint]:
        """Retrieve all fingerprints matching a set of canonical keys."""
        normalized_keys = tuple(dict.fromkeys(key for key in keys if key))
        if not normalized_keys:
            return ()
        stmt = select(AssetFingerprint).where(AssetFingerprint.canonical_key.in_(normalized_keys))
        result = await self.session.execute(stmt)
        return result.scalars().all()
