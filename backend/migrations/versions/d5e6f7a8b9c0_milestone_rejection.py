"""milestone rejection (note + timestamp) for unfunded milestones

Revision ID: d5e6f7a8b9c0
Revises: c3d4e5f6a7b9
Create Date: 2026-08-23
"""
from alembic import op
import sqlalchemy as sa

revision = 'd5e6f7a8b9c0'
down_revision = 'c3d4e5f6a7b9'
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing = {c['name'] for c in inspector.get_columns('milestones')}
    if 'rejection_note' not in existing:
        op.add_column('milestones', sa.Column('rejection_note', sa.Text(), nullable=True))
    if 'rejected_at' not in existing:
        op.add_column('milestones', sa.Column('rejected_at', sa.DateTime(), nullable=True))


def downgrade() -> None:
    op.drop_column('milestones', 'rejected_at')
    op.drop_column('milestones', 'rejection_note')
