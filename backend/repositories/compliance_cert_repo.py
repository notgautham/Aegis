"""
ComplianceCertificate Repository.

Extends BaseRepository with compliance-cert-specific queries.
"""

import uuid
from typing import Sequence

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.models.compliance_certificate import ComplianceCertificate
from backend.repositories.base import BaseRepository


class ComplianceCertificateRepository(BaseRepository[ComplianceCertificate]):
    """Repository for ComplianceCertificate CRUD and asset-based queries."""

    def __init__(self, session: AsyncSession) -> None:
        super().__init__(ComplianceCertificate, session)

    async def get_by_asset_id(self, asset_id: uuid.UUID) -> Sequence[ComplianceCertificate]:
        """Retrieve all compliance certificates for a given asset."""
        stmt = select(ComplianceCertificate).where(ComplianceCertificate.asset_id == asset_id)
        result = await self.session.execute(stmt)
        return result.scalars().all()
