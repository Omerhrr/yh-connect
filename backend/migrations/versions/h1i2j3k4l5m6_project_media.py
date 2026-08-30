"""add optional image_urls / video_url to projects

Revision ID: h1i2j3k4l5m6
Revises: g8b9c0d1e2f3
Create Date: 2026-08-26
"""
from alembic import op
import sqlalchemy as sa

revision = 'h1i2j3k4l5m6'
down_revision = 'g8b9c0d1e2f3'
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing = {c['name'] for c in inspector.get_columns('projects')}
    if 'image_urls' not in existing:
        op.add_column('projects', sa.Column('image_urls', sa.JSON(), nullable=True))
    if 'video_url' not in existing:
        op.add_column('projects', sa.Column('video_url', sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column('projects', 'video_url')
    op.drop_column('projects', 'image_urls')
