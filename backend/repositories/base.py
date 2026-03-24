"""
Base Repository — Generic async CRUD operations.

Provides a reusable base class parameterized by SQLAlchemy model type.
All model-specific repositories extend this class.
"""

import uuid
from typing import Generic, TypeVar, Type, Sequence

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.core.database import Base

ModelType = TypeVar("ModelType", bound=Base)


class BaseRepository(Generic[ModelType]):
    """Generic async repository with standard CRUD operations."""

    def __init__(self, model: Type[ModelType], session: AsyncSession) -> None:
        self.model = model
        self.session = session

    async def create(self, **kwargs) -> ModelType:
        """Create a new record and flush it to the session."""
        instance = self.model(**kwargs)
        self.session.add(instance)
        await self.session.flush()
        await self.session.refresh(instance)
        return instance

    async def get_by_id(self, record_id: uuid.UUID) -> ModelType | None:
        """Retrieve a single record by its UUID primary key."""
        return await self.session.get(self.model, record_id)

    async def get_all(self, *, limit: int = 100, offset: int = 0) -> Sequence[ModelType]:
        """Retrieve all records with pagination."""
        stmt = select(self.model).limit(limit).offset(offset)
        result = await self.session.execute(stmt)
        return result.scalars().all()

    async def update(self, record_id: uuid.UUID, **kwargs) -> ModelType | None:
        """Update an existing record by ID. Returns None if not found."""
        instance = await self.get_by_id(record_id)
        if instance is None:
            return None
        for key, value in kwargs.items():
            setattr(instance, key, value)
        await self.session.flush()
        await self.session.refresh(instance)
        return instance

    async def delete(self, record_id: uuid.UUID) -> bool:
        """Delete a record by ID. Returns True if deleted, False if not found."""
        instance = await self.get_by_id(record_id)
        if instance is None:
            return False
        await self.session.delete(instance)
        await self.session.flush()
        return True
