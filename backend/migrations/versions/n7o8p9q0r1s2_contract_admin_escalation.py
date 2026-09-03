"""admin_escalated_at column on contracts

Revision ID: n7o8p9q0r1s2
Revises: m6n7o8p9q0r1
Create Date: 2026-09-03

"""
from alembic import op
import sqlalchemy as sa

revision = 'n7o8p9q0r1s2'
down_revision = 'm6n7o8p9q0r1'
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    cols = {c['name'] for c in inspector.get_columns('contracts')}
    if 'admin_escalated_at' not in cols:
        op.add_column('contracts', sa.Column('admin_escalated_at', sa.DateTime(), nullable=True))


def downgrade() -> None:
    op.drop_column('contracts', 'admin_escalated_at')
