"""
CbomDocument Repository.

Extends BaseRepository with CBOM-specific queries.
"""

import uuid
from typing import Sequence

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.models.cbom_document import CbomDocument
from backend.repositories.base import BaseRepository


class CbomDocumentRepository(BaseRepository[CbomDocument]):
    """Repository for CbomDocument CRUD and scan/asset-based queries."""

    def __init__(self, session: AsyncSession) -> None:
        super().__init__(CbomDocument, session)

    async def get_by_scan_id(self, scan_id: uuid.UUID) -> Sequence[CbomDocument]:
        """Retrieve all CBOM documents for a given scan."""
        stmt = select(CbomDocument).where(CbomDocument.scan_id == scan_id)
        result = await self.session.execute(stmt)
        return result.scalars().all()

    async def get_by_asset_id(self, asset_id: uuid.UUID) -> Sequence[CbomDocument]:
        """Retrieve all CBOM documents for a given asset."""
        stmt = select(CbomDocument).where(CbomDocument.asset_id == asset_id)
        result = await self.session.execute(stmt)
        return result.scalars().all()
