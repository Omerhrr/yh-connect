"""reminder tracking columns + contract version history

Revision ID: m6n7o8p9q0r1
Revises: l5m6n7o8p9q0
Create Date: 2026-09-02

"""
from alembic import op
import sqlalchemy as sa

revision = 'm6n7o8p9q0r1'
down_revision = 'l5m6n7o8p9q0'
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    par_cols = {c['name'] for c in inspector.get_columns('project_access_requests')}
    with op.batch_alter_table('project_access_requests') as batch_op:
        if 'schedule_updated_at' not in par_cols:
            batch_op.add_column(sa.Column('schedule_updated_at', sa.DateTime(), nullable=True))
        if 'schedule_reminder_sent' not in par_cols:
            batch_op.add_column(sa.Column('schedule_reminder_sent', sa.Boolean(), nullable=False, server_default=sa.false()))
        if 'visit_reminder_sent' not in par_cols:
            batch_op.add_column(sa.Column('visit_reminder_sent', sa.Boolean(), nullable=False, server_default=sa.false()))

    contract_cols = {c['name'] for c in inspector.get_columns('contracts')}
    with op.batch_alter_table('contracts') as batch_op:
        if 'history' not in contract_cols:
            batch_op.add_column(sa.Column('history', sa.JSON(), nullable=True))
        if 'approval_reminder_sent' not in contract_cols:
            batch_op.add_column(sa.Column('approval_reminder_sent', sa.Boolean(), nullable=False, server_default=sa.false()))


def downgrade() -> None:
    with op.batch_alter_table('contracts') as batch_op:
        batch_op.drop_column('approval_reminder_sent')
        batch_op.drop_column('history')
    with op.batch_alter_table('project_access_requests') as batch_op:
        batch_op.drop_column('visit_reminder_sent')
        batch_op.drop_column('schedule_reminder_sent')
        batch_op.drop_column('schedule_updated_at')
