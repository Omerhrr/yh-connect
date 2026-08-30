"""client kyc fields

Revision ID: a852c24c973f
Revises: 9aba58dda827
Create Date: 2026-08-05 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = 'a852c24c973f'
down_revision: Union[str, None] = '9aba58dda827'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

KYC_STATUS_VALUES = ('unverified', 'pending', 'verified', 'rejected')


def upgrade() -> None:
    op.add_column('users', sa.Column('nin', sa.String(), nullable=True))

    # Unlike sa.Enum used inline inside op.create_table() (which auto-creates
    # the Postgres enum type as part of table DDL), a bare op.add_column()
    # does NOT create the backing type first, it just tries to ALTER TABLE
    # ... ADD COLUMN using a type that doesn't exist yet. SQLite doesn't
    # distinguish (enums are just a CHECK constraint there), so this only
    # surfaces against real Postgres. Create the type explicitly first.
    kyc_status_enum = postgresql.ENUM(*KYC_STATUS_VALUES, name='kycstatus')
    kyc_status_enum.create(op.get_bind(), checkfirst=True)
    op.add_column(
        'users',
        sa.Column('kyc_status', kyc_status_enum, nullable=False, server_default='unverified'),
    )
    op.add_column('users', sa.Column('kyc_verified_at', sa.DateTime(), nullable=True))
    op.add_column('users', sa.Column('kyc_note', sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column('users', 'kyc_note')
    op.drop_column('users', 'kyc_verified_at')
    op.drop_column('users', 'kyc_status')
    postgresql.ENUM(*KYC_STATUS_VALUES, name='kycstatus').drop(op.get_bind(), checkfirst=True)
    op.drop_column('users', 'nin')
