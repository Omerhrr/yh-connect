"""Service layer for posting to the double-entry ledger (app/models/ledger.py).

Every money-moving code path in the app (topup, milestone fund/release/
refund/split, acceptance fee, withdrawal, withholding release, admin
adjustment) should call `post()` here with a balanced set of entries, in
the same DB transaction as its existing WalletTransaction row. The
WalletTransaction rows remain the user-facing history/receipts; the ledger
is the internal accounting truth used for platform revenue reporting and
reconciliation (see app/api/v1/admin.py ledger endpoints).
"""

from sqlalchemy.orm import Session

from app.models.ledger import (
    DEBIT_NORMAL_KINDS,
    LedgerAccount,
    LedgerAccountKind,
    LedgerEntry,
    LedgerTransaction,
    LedgerTransactionType,
)

class LedgerError(Exception):
    pass

_BALANCE_TOLERANCE = 0.01  # cents-level float rounding slack

def is_debit_normal(kind: LedgerAccountKind) -> bool:
    return kind in DEBIT_NORMAL_KINDS

def get_or_create_account(db: Session, kind: LedgerAccountKind, user_id: str | None = None) -> LedgerAccount:
    account = (
        db.query(LedgerAccount)
        .filter(LedgerAccount.kind == kind, LedgerAccount.user_id == user_id)
        .first()
    )
    if account:
        return account
    account = LedgerAccount(kind=kind, user_id=user_id, balance=0.0)
    db.add(account)
    db.flush()
    return account

# Convenience getters for the accounts every caller needs.
def client_wallet_account(db: Session, user_id: str) -> LedgerAccount:
    return get_or_create_account(db, LedgerAccountKind.client_wallet, user_id)

def talent_wallet_account(db: Session, user_id: str) -> LedgerAccount:
    return get_or_create_account(db, LedgerAccountKind.talent_wallet, user_id)

def monnify_settlement_account(db: Session) -> LedgerAccount:
    return get_or_create_account(db, LedgerAccountKind.monnify_settlement)

def platform_escrow_account(db: Session) -> LedgerAccount:
    return get_or_create_account(db, LedgerAccountKind.platform_escrow)

def platform_holding_account(db: Session) -> LedgerAccount:
    return get_or_create_account(db, LedgerAccountKind.platform_holding)

def platform_revenue_account(db: Session) -> LedgerAccount:
    return get_or_create_account(db, LedgerAccountKind.platform_revenue)

def post(
    db: Session,
    type: LedgerTransactionType,
    lines: list[tuple[LedgerAccount, float]],
    description: str,
    reference: str | None = None,
    related_type: str | None = None,
    related_id: str | None = None,
) -> LedgerTransaction:
    """Post a balanced double-entry transaction. `lines` is a list of
    (account, signed_amount) pairs — positive is a debit, negative a
    credit — and must sum to (approximately) zero, or this raises
    LedgerError instead of silently posting unbalanced books. Does not
    commit; caller commits as part of its own transaction, same as every
    other money-moving function in this codebase."""
    total = sum(amount for _, amount in lines)
    if abs(total) > _BALANCE_TOLERANCE:
        raise LedgerError(
            f"Ledger transaction '{description}' doesn't balance: entries sum to {total:.4f}, expected 0"
        )
    if len(lines) < 2:
        raise LedgerError(f"Ledger transaction '{description}' needs at least two entries")

    txn = LedgerTransaction(
        type=type,
        description=description,
        reference=reference,
        related_type=related_type,
        related_id=related_id,
    )
    db.add(txn)
    db.flush()

    for account, amount in lines:
        if abs(amount) < 1e-9:
            continue
        db.add(LedgerEntry(transaction_id=txn.id, account_id=account.id, amount=amount))
        if is_debit_normal(account.kind):
            account.balance += amount
        else:
            account.balance -= amount

    db.flush()
    return txn

def reconciliation_report(db: Session) -> dict:
    """Summary used by the admin ledger page: per-kind totals, platform
    revenue and escrow at a glance, and the core audit invariant — the sum
    of every entry ever posted should be (approximately) zero, since every
    transaction that created them individually balanced to zero. If this
    is ever non-zero, something bypassed post() and wrote to a balance (or
    a WalletTransaction) directly instead of going through the ledger."""
    from sqlalchemy import func

    totals: dict[str, float] = {}
    counts: dict[str, int] = {}
    for kind in LedgerAccountKind:
        rows = db.query(LedgerAccount).filter(LedgerAccount.kind == kind).all()
        totals[kind.value] = round(sum(a.balance for a in rows), 2)
        counts[kind.value] = len(rows)

    entry_sum = db.query(func.coalesce(func.sum(LedgerEntry.amount), 0.0)).scalar() or 0.0
    balanced = abs(entry_sum) <= _BALANCE_TOLERANCE

    client_liabilities = totals.get(LedgerAccountKind.client_wallet.value, 0.0)
    talent_liabilities = totals.get(LedgerAccountKind.talent_wallet.value, 0.0)
    escrow = totals.get(LedgerAccountKind.platform_escrow.value, 0.0)
    holding = totals.get(LedgerAccountKind.platform_holding.value, 0.0)
    revenue = totals.get(LedgerAccountKind.platform_revenue.value, 0.0)
    settlement = totals.get(LedgerAccountKind.monnify_settlement.value, 0.0)

    total_liabilities = client_liabilities + talent_liabilities + escrow + holding
    # In a fully solvent, correctly-posted system, cash held at Monnify
    # should equal everything the platform owes out plus what it's earned.
    expected_settlement = total_liabilities + revenue
    drift = round(settlement - expected_settlement, 2)

    return {
        "balanced": balanced,
        "entry_sum": round(entry_sum, 2),
        "totals": totals,
        "account_counts": counts,
        "client_liabilities": round(client_liabilities, 2),
        "talent_liabilities": round(talent_liabilities, 2),
        "platform_escrow": round(escrow, 2),
        "platform_holding": round(holding, 2),
        "platform_revenue": round(revenue, 2),
        "monnify_settlement": round(settlement, 2),
        "expected_settlement": round(expected_settlement, 2),
        "settlement_drift": drift,
        "solvent": abs(drift) <= _BALANCE_TOLERANCE,
    }
