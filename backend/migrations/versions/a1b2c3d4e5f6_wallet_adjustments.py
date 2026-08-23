"""admin wallet adjustments: widen wallet_transactions.type to plain string

Revision ID: a1b2c3d4e5f6
Revises: f6a7b8c9d0e1
Create Date: 2026-08-16 00:00:00.000000

Widens wallet_transactions.type from a native enum to a plain string so
future value additions (like the 'adjustment' type used by the admin wallet
adjust tool) don't require a table rebuild on every enum change. Same
pattern already applied to milestones.status and notifications.type in the
dispute-rebuild migration.

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = 'f6a7b8c9d0e1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table('wallet_transactions') as batch_op:
        batch_op.alter_column(
            'type',
            existing_type=sa.Enum(
                'funding', 'release', 'refund', 'topup', 'withdrawal',
                name='wallettransactiontype',
            ),
            type_=sa.String(), existing_nullable=False,
            postgresql_using='type::text',
        )


def downgrade() -> None:
    with op.batch_alter_table('wallet_transactions') as batch_op:
        batch_op.alter_column(
            'type',
            existing_type=sa.String(),
            type_=sa.Enum(
                'funding', 'release', 'refund', 'topup', 'withdrawal',
                name='wallettransactiontype',
            ),
            existing_nullable=False,
            postgresql_using='type::wallettransactiontype',
        )
