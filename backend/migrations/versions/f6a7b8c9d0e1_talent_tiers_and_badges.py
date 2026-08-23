"""talent tier system: address verification (tier 3) + certification badges

Revision ID: f6a7b8c9d0e1
Revises: e5f6a7b8c9d0
Create Date: 2026-08-15 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f6a7b8c9d0e1'
down_revision: Union[str, None] = 'e5f6a7b8c9d0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'professional_profiles',
        sa.Column('address_verification_status', sa.String(), nullable=False, server_default='unverified'),
    )
    op.add_column('professional_profiles', sa.Column('address_document_url', sa.String(), nullable=True))
    op.add_column('professional_profiles', sa.Column('address_verification_note', sa.Text(), nullable=True))
    op.add_column('professional_profiles', sa.Column('address_verified_at', sa.DateTime(), nullable=True))

    op.add_column(
        'certifications',
        sa.Column('verification_status', sa.String(), nullable=False, server_default='unverified'),
    )
    op.add_column('certifications', sa.Column('verification_note', sa.String(), nullable=True))
    op.add_column('certifications', sa.Column('verified_at', sa.DateTime(), nullable=True))


def downgrade() -> None:
    op.drop_column('certifications', 'verified_at')
    op.drop_column('certifications', 'verification_note')
    op.drop_column('certifications', 'verification_status')

    op.drop_column('professional_profiles', 'address_verified_at')
    op.drop_column('professional_profiles', 'address_verification_note')
    op.drop_column('professional_profiles', 'address_document_url')
    op.drop_column('professional_profiles', 'address_verification_status')
