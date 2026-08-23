"""add projects.closing_note for final-review sign-off

Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a7
Create Date: 2026-08-17 00:00:00.000000

Wires up the previously-unused \"review\" project status: when all
milestones are closed out, the project now lands in `review` instead of
jumping straight to `completed`, and the assigned professional can leave a
closing note for the client before they confirm final sign-off.
`projects.closing_note` stores that note.

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c3d4e5f6a7b8'
down_revision: Union[str, None] = 'b2c3d4e5f6a7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('projects', sa.Column('closing_note', sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column('projects', 'closing_note')
