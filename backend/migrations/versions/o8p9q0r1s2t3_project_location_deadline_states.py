"""project state/lga/address/hiring_deadline columns + state_settings table

Revision ID: o8p9q0r1s2t3
Revises: n7o8p9q0r1s2
Create Date: 2026-09-08

"""
from alembic import op
import sqlalchemy as sa

revision = 'o8p9q0r1s2t3'
down_revision = 'n7o8p9q0r1s2'
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    cols = {c['name'] for c in inspector.get_columns('projects')}
    if 'state' not in cols:
        op.add_column('projects', sa.Column('state', sa.String(), nullable=True))
    if 'lga' not in cols:
        op.add_column('projects', sa.Column('lga', sa.String(), nullable=True))
    if 'address' not in cols:
        op.add_column('projects', sa.Column('address', sa.String(), nullable=True))
    if 'hiring_deadline' not in cols:
        op.add_column('projects', sa.Column('hiring_deadline', sa.DateTime(), nullable=True))

    if 'state_settings' not in inspector.get_table_names():
        op.create_table(
            'state_settings',
            sa.Column('name', sa.String(), primary_key=True),
            sa.Column('active', sa.Boolean(), server_default='0', nullable=False),
        )


def downgrade() -> None:
    op.drop_table('state_settings')
    op.drop_column('projects', 'hiring_deadline')
    op.drop_column('projects', 'address')
    op.drop_column('projects', 'lga')
    op.drop_column('projects', 'state')
