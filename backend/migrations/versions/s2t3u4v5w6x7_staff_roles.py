"""staff roles: admin_roles table and users.admin_role_id

Revision ID: s2t3u4v5w6x7
Revises: r1s2t3u4v5w6
Create Date: 2026-11-09

"""
from alembic import op
import sqlalchemy as sa

revision = 's2t3u4v5w6x7'
down_revision = 'r1s2t3u4v5w6'
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if 'admin_roles' not in set(inspector.get_table_names()):
        op.create_table(
            'admin_roles',
            sa.Column('id', sa.String(), primary_key=True),
            sa.Column('name', sa.String(), nullable=False, unique=True),
            sa.Column('description', sa.String(), nullable=True),
            sa.Column('permissions', sa.JSON(), nullable=True),
            sa.Column('created_at', sa.DateTime(), nullable=False),
        )

    cols = {c['name'] for c in inspector.get_columns('users')}
    if 'admin_role_id' not in cols:
        # No DB-level FK: keeps this a plain add_column that behaves the same
        # on SQLite and Postgres. Integrity is enforced in the API layer.
        op.add_column('users', sa.Column('admin_role_id', sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column('users', 'admin_role_id')
    op.drop_table('admin_roles')
