"""double-entry ledger tables (ledger_accounts, ledger_transactions, ledger_entries)
+ opening-balance backfill from existing wallet_balance / escrowed milestones

Revision ID: p9q0r1s2t3u4
Revises: o8p9q0r1s2t3
Create Date: 2026-09-08

"""
import uuid
from datetime import datetime

from alembic import op
import sqlalchemy as sa

revision = 'p9q0r1s2t3u4'
down_revision = 'o8p9q0r1s2t3'
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_tables = set(inspector.get_table_names())

    if 'ledger_accounts' not in existing_tables:
        op.create_table(
            'ledger_accounts',
            sa.Column('id', sa.String(), primary_key=True),
            sa.Column('kind', sa.String(), nullable=False),
            sa.Column('user_id', sa.String(), sa.ForeignKey('users.id'), nullable=True),
            sa.Column('balance', sa.Float(), nullable=False, server_default='0'),
            sa.Column('created_at', sa.DateTime(), nullable=False),
            sa.UniqueConstraint('kind', 'user_id', name='uq_ledger_account_kind_user'),
        )

    if 'ledger_transactions' not in existing_tables:
        op.create_table(
            'ledger_transactions',
            sa.Column('id', sa.String(), primary_key=True),
            sa.Column('type', sa.String(), nullable=False),
            sa.Column('description', sa.String(), nullable=False),
            sa.Column('reference', sa.String(), nullable=True),
            sa.Column('related_type', sa.String(), nullable=True),
            sa.Column('related_id', sa.String(), nullable=True),
            sa.Column('created_at', sa.DateTime(), nullable=False),
        )

    if 'ledger_entries' not in existing_tables:
        op.create_table(
            'ledger_entries',
            sa.Column('id', sa.String(), primary_key=True),
            sa.Column('transaction_id', sa.String(), sa.ForeignKey('ledger_transactions.id'), nullable=False),
            sa.Column('account_id', sa.String(), sa.ForeignKey('ledger_accounts.id'), nullable=False),
            sa.Column('amount', sa.Float(), nullable=False),
            sa.Column('created_at', sa.DateTime(), nullable=False),
        )

    # --- Opening-balance backfill ---
    # Bring the ledger in sync with whatever the app's existing (non-ledger)
    # bookkeeping already believes is true, so the double-entry system starts
    # in a balanced, reconcilable state instead of at zero while real
    # balances sit unaccounted for. This runs once; from here on every
    # mutation goes through app/services/ledger.py.
    inspector = sa.inspect(bind)
    if 'ledger_accounts' in inspector.get_table_names():
        existing_accounts = bind.execute(sa.text("SELECT COUNT(*) FROM ledger_accounts")).scalar()
        if existing_accounts:
            return  # already backfilled (re-run safety)

    now = datetime.utcnow()
    total_liabilities = 0.0
    entries_to_insert = []  # (account_id, amount)
    txn_id = str(uuid.uuid4())

    # One user_wallet ledger account per user with a nonzero wallet_balance.
    users = bind.execute(sa.text("SELECT id, role, wallet_balance FROM users WHERE wallet_balance != 0")).fetchall()
    for user_id, role, wallet_balance in users:
        kind = 'client_wallet' if role == 'client' else 'talent_wallet'
        acct_id = str(uuid.uuid4())
        bind.execute(
            sa.text(
                "INSERT INTO ledger_accounts (id, kind, user_id, balance, created_at) "
                "VALUES (:id, :kind, :user_id, :balance, :created_at)"
            ),
            {"id": acct_id, "kind": kind, "user_id": user_id, "balance": wallet_balance, "created_at": now},
        )
        # credit-normal account: raw entry amount is the negative of the balance increase
        entries_to_insert.append((acct_id, -wallet_balance))
        total_liabilities += wallet_balance

    # Escrowed (funded/approved, not yet paid/refunded) milestone amounts.
    escrow_total = bind.execute(
        sa.text("SELECT COALESCE(SUM(amount), 0) FROM milestones WHERE status IN ('funded', 'approved')")
    ).scalar() or 0.0
    if escrow_total:
        escrow_acct_id = str(uuid.uuid4())
        bind.execute(
            sa.text(
                "INSERT INTO ledger_accounts (id, kind, user_id, balance, created_at) "
                "VALUES (:id, 'platform_escrow', NULL, :balance, :created_at)"
            ),
            {"id": escrow_acct_id, "balance": escrow_total, "created_at": now},
        )
        entries_to_insert.append((escrow_acct_id, -escrow_total))
        total_liabilities += escrow_total

    if entries_to_insert:
        # Balancing debit: monnify_settlement holds exactly what's owed out.
        # (No historical platform_revenue figure exists pre-ledger, so
        # revenue starts at 0 — this backfill is a starting line, not a
        # retroactive revenue reconstruction.)
        settlement_acct_id = str(uuid.uuid4())
        bind.execute(
            sa.text(
                "INSERT INTO ledger_accounts (id, kind, user_id, balance, created_at) "
                "VALUES (:id, 'monnify_settlement', NULL, :balance, :created_at)"
            ),
            {"id": settlement_acct_id, "balance": total_liabilities, "created_at": now},
        )
        entries_to_insert.append((settlement_acct_id, total_liabilities))

        bind.execute(
            sa.text(
                "INSERT INTO ledger_transactions (id, type, description, reference, related_type, related_id, created_at) "
                "VALUES (:id, 'opening_balance', :description, NULL, NULL, NULL, :created_at)"
            ),
            {
                "id": txn_id,
                "description": "Opening balances backfilled from pre-ledger wallet_balance / escrowed milestones",
                "created_at": now,
            },
        )
        for account_id, amount in entries_to_insert:
            bind.execute(
                sa.text(
                    "INSERT INTO ledger_entries (id, transaction_id, account_id, amount, created_at) "
                    "VALUES (:id, :transaction_id, :account_id, :amount, :created_at)"
                ),
                {
                    "id": str(uuid.uuid4()),
                    "transaction_id": txn_id,
                    "account_id": account_id,
                    "amount": amount,
                    "created_at": now,
                },
            )


def downgrade() -> None:
    op.drop_table('ledger_entries')
    op.drop_table('ledger_transactions')
    op.drop_table('ledger_accounts')
