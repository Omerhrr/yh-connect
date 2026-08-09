"""message attachments + review responses + favorites

Revision ID: e4f5a6b7c8d9
Revises: d3e4f5a6b7c8
Create Date: 2026-08-06 00:00:01.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e4f5a6b7c8d9'
down_revision: Union[str, None] = 'd3e4f5a6b7c8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('messages', sa.Column('attachment_url', sa.String(), nullable=True))

    op.add_column('reviews', sa.Column('response_body', sa.Text(), nullable=True))
    op.add_column('reviews', sa.Column('responded_at', sa.DateTime(), nullable=True))

    op.add_column('users', sa.Column('email_notifications_enabled', sa.Boolean(), nullable=False, server_default='1'))

    op.create_table(
        'favorites',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('user_id', sa.String(), nullable=False),
        sa.Column('target_type', sa.String(), nullable=False),
        sa.Column('target_id', sa.String(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id', 'target_type', 'target_id', name='uq_favorite_user_target'),
    )
    op.create_index('ix_favorites_user_id', 'favorites', ['user_id'])


def downgrade() -> None:
    op.drop_index('ix_favorites_user_id', table_name='favorites')
    op.drop_table('favorites')
    op.drop_column('users', 'email_notifications_enabled')
    op.drop_column('reviews', 'responded_at')
    op.drop_column('reviews', 'response_body')
    op.drop_column('messages', 'attachment_url')
