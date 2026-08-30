"""bid offers, change-order->milestone link, dispute direct-resolution fields

Revision ID: c3d4e5f6a7b9
Revises: b2c3d4e5f6a8
Create Date: 2026-08-22
"""
from alembic import op
import sqlalchemy as sa

revision = 'c3d4e5f6a7b9'
down_revision = 'b2c3d4e5f6a8'
branch_labels = None
depends_on = None


def _add_cols(bind, table, cols):
    inspector = sa.inspect(bind)
    existing = {c['name'] for c in inspector.get_columns(table)}
    for name, coltype, kwargs in cols:
        if name not in existing:
            op.add_column(table, sa.Column(name, coltype, **kwargs))


def upgrade() -> None:
    bind = op.get_bind()

    _add_cols(bind, 'bids', [
        ('offered_amount', sa.Float(), {'nullable': True}),
        ('offer_note', sa.Text(), {'nullable': True}),
    ])
    _add_cols(bind, 'change_orders', [
        ('resulting_milestone_id', sa.String(), {'nullable': True}),
    ])
    _add_cols(bind, 'disputes', [
        ('proposal_status', sa.String(), {'nullable': False, 'server_default': 'none'}),
        ('proposed_outcome', sa.String(), {'nullable': True}),
        ('proposed_split_amount', sa.Float(), {'nullable': True}),
        ('proposed_by', sa.String(), {'nullable': True}),
        ('proposal_note', sa.Text(), {'nullable': True}),
        ('proposal_expires_at', sa.DateTime(), {'nullable': True}),
    ])


def downgrade() -> None:
    for col in ('proposal_expires_at', 'proposal_note', 'proposed_by', 'proposed_split_amount', 'proposed_outcome', 'proposal_status'):
        op.drop_column('disputes', col)
    op.drop_column('change_orders', 'resulting_milestone_id')
    op.drop_column('bids', 'offer_note')
    op.drop_column('bids', 'offered_amount')
