"""add timeline field to projects

Revision ID: k4l5m6n7o8p9
Revises: j3k4l5m6n7o8
Create Date: 2026-08-28
"""
from alembic import op
import sqlalchemy as sa

revision = 'k4l5m6n7o8p9'
down_revision = 'j3k4l5m6n7o8'
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_cols = {c['name'] for c in inspector.get_columns('projects')}
    if 'timeline' not in existing_cols:
        op.add_column('projects', sa.Column('timeline', sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column('projects', 'timeline')
