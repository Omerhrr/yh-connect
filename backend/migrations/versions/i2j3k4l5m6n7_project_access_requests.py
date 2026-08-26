"""project access requests (inspection visit / start chat, client-approved)

Revision ID: i2j3k4l5m6n7
Revises: h1i2j3k4l5m6
Create Date: 2026-08-26
"""
from alembic import op
import sqlalchemy as sa

revision = 'i2j3k4l5m6n7'
down_revision = 'h1i2j3k4l5m6'
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if not inspector.has_table('project_access_requests'):
        op.create_table(
            'project_access_requests',
            sa.Column('id', sa.String(), primary_key=True),
            sa.Column('project_id', sa.String(), sa.ForeignKey('projects.id'), nullable=False),
            sa.Column('professional_id', sa.String(), sa.ForeignKey('users.id'), nullable=False),
            sa.Column('client_id', sa.String(), sa.ForeignKey('users.id'), nullable=False),
            sa.Column('request_type', sa.String(), nullable=False),
            sa.Column('status', sa.String(), nullable=False, server_default='pending'),
            sa.Column('note', sa.Text(), nullable=True),
            sa.Column('address', sa.String(), nullable=True),
            sa.Column('phone', sa.String(), nullable=True),
            sa.Column('details', sa.Text(), nullable=True),
            sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
            sa.Column('responded_at', sa.DateTime(), nullable=True),
        )


def downgrade() -> None:
    op.drop_table('project_access_requests')
