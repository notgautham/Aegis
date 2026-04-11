"""add score_explanation to crypto_assessments

Revision ID: c3a7f6f2d6ab
Revises: 9c81a54a5533
Create Date: 2026-04-12 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = "c3a7f6f2d6ab"
down_revision: Union[str, None] = "9c81a54a5533"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "crypto_assessments",
        sa.Column("score_explanation", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("crypto_assessments", "score_explanation")
