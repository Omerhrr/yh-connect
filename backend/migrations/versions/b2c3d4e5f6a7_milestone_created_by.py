"""add milestone.created_by for professional-proposed milestones

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-08-17 00:00:00.000000

Hired professionals can now propose milestones for the client to fund
(approve). `created_by` records who defined each milestone so the UI can
badge "proposed by <name>" and clients can tell their own plan from the
professional's proposal. Null for pre-existing milestones, which the
client authored.

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b2c3d4e5f6a7'
down_revision: Union[str, None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('milestones', sa.Column('created_by', sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column('milestones', 'created_by')
