"""project consultants: projects.needs_consultant/consultant_id, applications, notes

Revision ID: t3u4v5w6x7y8
Revises: s2t3u4v5w6x7
Create Date: 2026-11-09

"""
from alembic import op
import sqlalchemy as sa

revision = 't3u4v5w6x7y8'
down_revision = 's2t3u4v5w6x7'
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = set(inspector.get_table_names())

    cols = {c['name'] for c in inspector.get_columns('projects')}
    if 'needs_consultant' not in cols:
        op.add_column('projects', sa.Column('needs_consultant', sa.Boolean(), nullable=False, server_default=sa.false()))
    if 'consultant_id' not in cols:
        op.add_column('projects', sa.Column('consultant_id', sa.String(), nullable=True))

    if 'consultant_applications' not in tables:
        op.create_table(
            'consultant_applications',
            sa.Column('id', sa.String(), primary_key=True),
            sa.Column('project_id', sa.String(), sa.ForeignKey('projects.id'), nullable=False),
            sa.Column('professional_id', sa.String(), sa.ForeignKey('users.id'), nullable=False),
            sa.Column('note', sa.Text(), nullable=True),
            sa.Column('proposed_fee', sa.Float(), nullable=True),
            sa.Column('status', sa.String(), nullable=False, server_default='pending'),
            sa.Column('created_at', sa.DateTime(), nullable=False),
        )
        op.create_index('ix_consultant_applications_project_id', 'consultant_applications', ['project_id'])
        op.create_index('ix_consultant_applications_professional_id', 'consultant_applications', ['professional_id'])

    if 'consultant_notes' not in tables:
        op.create_table(
            'consultant_notes',
            sa.Column('id', sa.String(), primary_key=True),
            sa.Column('project_id', sa.String(), sa.ForeignKey('projects.id'), nullable=False),
            sa.Column('consultant_id', sa.String(), sa.ForeignKey('users.id'), nullable=False),
            sa.Column('bid_id', sa.String(), nullable=True),
            sa.Column('verdict', sa.String(), nullable=False, server_default='neutral'),
            sa.Column('body', sa.Text(), nullable=False),
            sa.Column('created_at', sa.DateTime(), nullable=False),
        )
        op.create_index('ix_consultant_notes_project_id', 'consultant_notes', ['project_id'])


def downgrade() -> None:
    op.drop_table('consultant_notes')
    op.drop_table('consultant_applications')
    op.drop_column('projects', 'consultant_id')
    op.drop_column('projects', 'needs_consultant')
