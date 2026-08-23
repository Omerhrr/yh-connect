"""add submitted_at and auto_release_reminder_sent to milestones

Revision ID: b2c3d4e5f6a8
Revises: a1b2c3d4e5f7
Create Date: 2026-08-22
"""
from alembic import op
import sqlalchemy as sa

revision = 'b2c3d4e5f6a8'
down_revision = 'a1b2c3d4e5f7'
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_cols = {c['name'] for c in inspector.get_columns('milestones')}
    if 'submitted_at' not in existing_cols:
        op.add_column('milestones', sa.Column('submitted_at', sa.DateTime(), nullable=True))
    if 'auto_release_reminder_sent' not in existing_cols:
        op.add_column(
            'milestones',
            sa.Column('auto_release_reminder_sent', sa.Boolean(), nullable=False, server_default=sa.false()),
        )


def downgrade() -> None:
    op.drop_column('milestones', 'auto_release_reminder_sent')
    op.drop_column('milestones', 'submitted_at')
