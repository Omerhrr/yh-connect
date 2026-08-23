"""multi-bank payout accounts + profile name-change cooldown tracking

Revision ID: e6f7a8b9c0d1
Revises: d5e6f7a8b9c0
Create Date: 2026-08-24
"""
import uuid
from datetime import datetime

from alembic import op
import sqlalchemy as sa

revision = 'e6f7a8b9c0d1'
down_revision = 'd5e6f7a8b9c0'
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    existing_users_cols = {c['name'] for c in inspector.get_columns('users')}
    if 'name_changed_at' not in existing_users_cols:
        op.add_column('users', sa.Column('name_changed_at', sa.DateTime(), nullable=True))

    if not inspector.has_table('payout_accounts'):
        op.create_table(
            'payout_accounts',
            sa.Column('id', sa.String(), primary_key=True),
            sa.Column('professional_id', sa.String(), sa.ForeignKey('users.id'), nullable=False),
            sa.Column('bank_code', sa.String(), nullable=False),
            sa.Column('bank_name', sa.String(), nullable=True),
            sa.Column('account_number', sa.String(), nullable=False),
            sa.Column('account_name', sa.String(), nullable=False),
            sa.Column('name_match', sa.Boolean(), nullable=False, server_default=sa.false()),
            sa.Column('is_default', sa.Boolean(), nullable=False, server_default=sa.false()),
            sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        )

        # Carry forward any existing single-bank-account data on
        # professional_profiles so nobody's saved payout details disappear.
        profiles = bind.execute(sa.text(
            "SELECT user_id, bank_code, bank_account_number, bank_account_name "
            "FROM professional_profiles WHERE bank_code IS NOT NULL AND bank_account_number IS NOT NULL"
        )).fetchall()
        for user_id, bank_code, account_number, account_name in profiles:
            bind.execute(
                sa.text(
                    "INSERT INTO payout_accounts "
                    "(id, professional_id, bank_code, bank_name, account_number, account_name, name_match, is_default, created_at) "
                    "VALUES (:id, :professional_id, :bank_code, NULL, :account_number, :account_name, 0, 1, :created_at)"
                ),
                {
                    "id": str(uuid.uuid4()),
                    "professional_id": user_id,
                    "bank_code": bank_code,
                    "account_number": account_number,
                    "account_name": account_name or "",
                    "created_at": datetime.utcnow(),
                },
            )


def downgrade() -> None:
    op.drop_table('payout_accounts')
    op.drop_column('users', 'name_changed_at')
