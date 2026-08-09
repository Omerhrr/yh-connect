"""client kyc fields

Revision ID: a852c24c973f
Revises: 9aba58dda827
Create Date: 2026-08-05 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a852c24c973f'
down_revision: Union[str, None] = '9aba58dda827'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('users', sa.Column('nin', sa.String(), nullable=True))
    op.add_column(
        'users',
        sa.Column(
            'kyc_status',
            sa.Enum('unverified', 'pending', 'verified', 'rejected', name='kycstatus'),
            nullable=False,
            server_default='unverified',
        ),
    )
    op.add_column('users', sa.Column('kyc_verified_at', sa.DateTime(), nullable=True))
    op.add_column('users', sa.Column('kyc_note', sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column('users', 'kyc_note')
    op.drop_column('users', 'kyc_verified_at')
    op.drop_column('users', 'kyc_status')
    op.drop_column('users', 'nin')
