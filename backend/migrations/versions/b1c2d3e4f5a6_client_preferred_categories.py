"""client preferred categories

Revision ID: b1c2d3e4f5a6
Revises: a852c24c973f
Create Date: 2026-08-06 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b1c2d3e4f5a6'
down_revision: Union[str, None] = 'a852c24c973f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('users', sa.Column('preferred_categories', sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column('users', 'preferred_categories')
