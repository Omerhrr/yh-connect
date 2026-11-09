"""contract type, contract addenda, guarantors

Revision ID: q0r1s2t3u4v5
Revises: p9q0r1s2t3u4
Create Date: 2026-11-09

"""
from alembic import op
import sqlalchemy as sa

revision = 'q0r1s2t3u4v5'
down_revision = 'p9q0r1s2t3u4'
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    cols = {c['name'] for c in inspector.get_columns('contracts')}
    if 'contract_type' not in cols:
        op.add_column('contracts', sa.Column('contract_type', sa.String(), nullable=False, server_default='fixed'))

    tables = set(inspector.get_table_names())

    if 'contract_addenda' not in tables:
        op.create_table(
            'contract_addenda',
            sa.Column('id', sa.String(), primary_key=True),
            sa.Column('contract_id', sa.String(), sa.ForeignKey('contracts.id'), nullable=False, index=True),
            sa.Column('project_id', sa.String(), sa.ForeignKey('projects.id'), nullable=False, index=True),
            sa.Column('proposed_by', sa.String(), sa.ForeignKey('users.id'), nullable=False),
            sa.Column('title', sa.String(), nullable=False),
            sa.Column('content', sa.Text(), nullable=False),
            sa.Column('amount_delta', sa.Float(), nullable=False, server_default='0'),
            sa.Column('status', sa.String(), nullable=False, server_default='pending'),
            sa.Column('client_approved', sa.Boolean(), nullable=False, server_default=sa.false()),
            sa.Column('professional_approved', sa.Boolean(), nullable=False, server_default=sa.false()),
            sa.Column('resulting_milestone_id', sa.String(), nullable=True),
            sa.Column('created_at', sa.DateTime(), nullable=False),
            sa.Column('approved_at', sa.DateTime(), nullable=True),
        )

    if 'guarantors' not in tables:
        op.create_table(
            'guarantors',
            sa.Column('id', sa.String(), primary_key=True),
            sa.Column('professional_id', sa.String(), sa.ForeignKey('users.id'), nullable=False, index=True),
            sa.Column('guarantor_id', sa.String(), sa.ForeignKey('users.id'), nullable=False, index=True),
            sa.Column('status', sa.String(), nullable=False, server_default='pending'),
            sa.Column('message', sa.Text(), nullable=True),
            sa.Column('created_at', sa.DateTime(), nullable=False),
            sa.Column('responded_at', sa.DateTime(), nullable=True),
            sa.UniqueConstraint('professional_id', 'guarantor_id', name='uq_guarantor_pair'),
        )


def downgrade() -> None:
    op.drop_table('guarantors')
    op.drop_table('contract_addenda')
    op.drop_column('contracts', 'contract_type')
