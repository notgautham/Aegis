"""
CertificateChain Repository.

Extends BaseRepository with certificate-chain-specific queries.
"""

import uuid
from typing import Sequence

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.models.certificate_chain import CertificateChain
from backend.repositories.base import BaseRepository


class CertificateChainRepository(BaseRepository[CertificateChain]):
    """Repository for CertificateChain CRUD and asset-based queries."""

    def __init__(self, session: AsyncSession) -> None:
        super().__init__(CertificateChain, session)

    async def get_by_asset_id(self, asset_id: uuid.UUID) -> Sequence[CertificateChain]:
        """Retrieve all certificates in the chain for a given asset."""
        stmt = select(CertificateChain).where(CertificateChain.asset_id == asset_id)
        result = await self.session.execute(stmt)
        return result.scalars().all()
