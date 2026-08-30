"""add unique, optional username to users

Revision ID: f7a8b9c0d1e2
Revises: e6f7a8b9c0d1
Create Date: 2026-08-25
"""
from alembic import op
import sqlalchemy as sa

revision = 'f7a8b9c0d1e2'
down_revision = 'e6f7a8b9c0d1'
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing = {c['name'] for c in inspector.get_columns('users')}
    if 'username' not in existing:
        op.add_column('users', sa.Column('username', sa.String(), nullable=True))

    existing_indexes = {ix['name'] for ix in inspector.get_indexes('users')}
    if 'ix_users_username' not in existing_indexes:
        op.create_index('ix_users_username', 'users', ['username'], unique=True)


def downgrade() -> None:
    op.drop_index('ix_users_username', table_name='users')
    op.drop_column('users', 'username')
