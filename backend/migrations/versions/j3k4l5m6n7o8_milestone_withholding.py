"""add payment withholding fields to milestones

Revision ID: j3k4l5m6n7o8
Revises: i2j3k4l5m6n7
Create Date: 2026-08-28
"""
from alembic import op
import sqlalchemy as sa

revision = 'j3k4l5m6n7o8'
down_revision = 'i2j3k4l5m6n7'
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_cols = {c['name'] for c in inspector.get_columns('milestones')}
    if 'withheld_amount' not in existing_cols:
        op.add_column('milestones', sa.Column('withheld_amount', sa.Float(), nullable=True))
    if 'withheld_release_at' not in existing_cols:
        op.add_column('milestones', sa.Column('withheld_release_at', sa.DateTime(), nullable=True))
    if 'withheld_released_at' not in existing_cols:
        op.add_column('milestones', sa.Column('withheld_released_at', sa.DateTime(), nullable=True))


def downgrade() -> None:
    op.drop_column('milestones', 'withheld_released_at')
    op.drop_column('milestones', 'withheld_release_at')
    op.drop_column('milestones', 'withheld_amount')
