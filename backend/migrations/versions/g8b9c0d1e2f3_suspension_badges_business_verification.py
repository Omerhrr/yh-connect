"""time-bound suspension + soft delete, certification badge_name, CAC business verification

Revision ID: a1b2c3d4e5f6
Revises: f7a8b9c0d1e2
Create Date: 2026-08-23
"""
from alembic import op
import sqlalchemy as sa

revision = 'g8b9c0d1e2f3'
down_revision = 'f7a8b9c0d1e2'
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    users_cols = {c['name'] for c in inspector.get_columns('users')}
    user_additions = [
        ('suspended_at', sa.DateTime()),
        ('suspended_until', sa.DateTime()),
        ('suspension_reason', sa.Text()),
        ('is_deleted', sa.Boolean()),
        ('deleted_at', sa.DateTime()),
        ('cac_number', sa.String()),
        ('cac_document_url', sa.String()),
        ('business_verification_status', sa.String()),
        ('business_verification_note', sa.String()),
        ('business_verified_at', sa.DateTime()),
    ]
    for name, coltype in user_additions:
        if name not in users_cols:
            default = False if name == 'is_deleted' else ('unverified' if name == 'business_verification_status' else None)
            op.add_column('users', sa.Column(name, coltype, nullable=True, server_default=(
                sa.false() if name == 'is_deleted' else ("'unverified'" if name == 'business_verification_status' else None)
            )))

    cert_cols = {c['name'] for c in inspector.get_columns('certifications')}
    if 'badge_name' not in cert_cols:
        op.add_column('certifications', sa.Column('badge_name', sa.String(), nullable=True))


def downgrade() -> None:
    for col in ('suspended_at', 'suspended_until', 'suspension_reason', 'is_deleted', 'deleted_at',
                'cac_number', 'cac_document_url', 'business_verification_status',
                'business_verification_note', 'business_verified_at'):
        op.drop_column('users', col)
    op.drop_column('certifications', 'badge_name')
