"""inspection scheduling fields + contracts table + certification skill_level

Revision ID: l5m6n7o8p9q0
Revises: k4l5m6n7o8p9
Create Date: 2026-09-02

"""
from alembic import op
import sqlalchemy as sa

revision = 'l5m6n7o8p9q0'
down_revision = 'k4l5m6n7o8p9'
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    par_cols = {c['name'] for c in inspector.get_columns('project_access_requests')}
    with op.batch_alter_table('project_access_requests') as batch_op:
        if 'proposed_datetime' not in par_cols:
            batch_op.add_column(sa.Column('proposed_datetime', sa.DateTime(), nullable=True))
        if 'proposed_by' not in par_cols:
            batch_op.add_column(sa.Column('proposed_by', sa.String(), nullable=True))
        if 'schedule_status' not in par_cols:
            batch_op.add_column(sa.Column('schedule_status', sa.String(), nullable=True))
        if 'scheduled_datetime' not in par_cols:
            batch_op.add_column(sa.Column('scheduled_datetime', sa.DateTime(), nullable=True))

    cert_cols = {c['name'] for c in inspector.get_columns('certifications')}
    if 'skill_level' not in cert_cols:
        op.add_column('certifications', sa.Column('skill_level', sa.String(), nullable=True))

    if 'contracts' not in inspector.get_table_names():
        op.create_table(
            'contracts',
            sa.Column('id', sa.String(), primary_key=True),
            sa.Column('project_id', sa.String(), sa.ForeignKey('projects.id'), nullable=False, unique=True),
            sa.Column('bid_id', sa.String(), sa.ForeignKey('bids.id'), nullable=True),
            sa.Column('client_id', sa.String(), sa.ForeignKey('users.id'), nullable=False),
            sa.Column('professional_id', sa.String(), sa.ForeignKey('users.id'), nullable=False),
            sa.Column('content', sa.Text(), nullable=False),
            sa.Column('status', sa.String(), nullable=False, server_default='draft'),
            sa.Column('client_approved', sa.Boolean(), nullable=False, server_default=sa.false()),
            sa.Column('professional_approved', sa.Boolean(), nullable=False, server_default=sa.false()),
            sa.Column('last_edited_by', sa.String(), nullable=True),
            sa.Column('version', sa.Integer(), nullable=False, server_default='1'),
            sa.Column('created_at', sa.DateTime(), nullable=False),
            sa.Column('updated_at', sa.DateTime(), nullable=False),
            sa.Column('approved_at', sa.DateTime(), nullable=True),
        )


def downgrade() -> None:
    op.drop_table('contracts')
    op.drop_column('certifications', 'skill_level')
    with op.batch_alter_table('project_access_requests') as batch_op:
        batch_op.drop_column('scheduled_datetime')
        batch_op.drop_column('schedule_status')
        batch_op.drop_column('proposed_by')
        batch_op.drop_column('proposed_datetime')
