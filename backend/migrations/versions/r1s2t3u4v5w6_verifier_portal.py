"""external verifier portal: issuing bodies, verifier accounts, cert sign-off

Revision ID: r1s2t3u4v5w6
Revises: q0r1s2t3u4v5
Create Date: 2026-11-09

"""
from alembic import op
import sqlalchemy as sa

revision = 'r1s2t3u4v5w6'
down_revision = 'q0r1s2t3u4v5'
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = set(inspector.get_table_names())

    if 'issuing_bodies' not in tables:
        op.create_table(
            'issuing_bodies',
            sa.Column('id', sa.String(), primary_key=True),
            sa.Column('name', sa.String(), nullable=False, unique=True),
            sa.Column('aliases', sa.Text(), nullable=True),
            sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.true()),
            sa.Column('created_at', sa.DateTime(), nullable=False),
        )

    if 'verifier_accounts' not in tables:
        op.create_table(
            'verifier_accounts',
            sa.Column('id', sa.String(), primary_key=True),
            sa.Column('body_id', sa.String(), sa.ForeignKey('issuing_bodies.id'), nullable=False, index=True),
            sa.Column('name', sa.String(), nullable=False),
            sa.Column('email', sa.String(), nullable=False, unique=True),
            sa.Column('hashed_password', sa.String(), nullable=False),
            sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.true()),
            sa.Column('token_version', sa.Integer(), nullable=False, server_default='0'),
            sa.Column('last_login_at', sa.DateTime(), nullable=True),
            sa.Column('created_at', sa.DateTime(), nullable=False),
        )

    cols = {c['name'] for c in inspector.get_columns('certifications')}
    if 'verified_by_body' not in cols:
        op.add_column('certifications', sa.Column('verified_by_body', sa.String(), nullable=True))
    if 'verified_by_name' not in cols:
        op.add_column('certifications', sa.Column('verified_by_name', sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column('certifications', 'verified_by_name')
    op.drop_column('certifications', 'verified_by_body')
    op.drop_table('verifier_accounts')
    op.drop_table('issuing_bodies')
