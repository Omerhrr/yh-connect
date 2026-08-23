"""message edit/delete (edited_at, is_deleted)

Revision ID: e5f6a7b8c9d0
Revises: d4e5f6a7b8c9
Create Date: 2026-08-11 00:00:01.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e5f6a7b8c9d0'
down_revision: Union[str, None] = 'd4e5f6a7b8c9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('messages', sa.Column('is_deleted', sa.Boolean(), nullable=False, server_default='0'))
    op.add_column('messages', sa.Column('edited_at', sa.DateTime(), nullable=True))


def downgrade() -> None:
    op.drop_column('messages', 'edited_at')
    op.drop_column('messages', 'is_deleted')
