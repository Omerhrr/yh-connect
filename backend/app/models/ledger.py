"""Double-entry accounting ledger.

Every naira the platform is responsible for lives in exactly one
`LedgerAccount` bucket at a time. Moving money between buckets (a client
topping up, funding a milestone, a payout releasing, a platform fee being
taken, a withdrawal going out) is always recorded as one `LedgerTransaction`
with two or more `LedgerEntry` lines whose signed amounts sum to exactly
zero — nothing is ever created or destroyed, only moved. This is what makes
the books auditable: if every transaction balances individually, the whole
ledger balances, and `sum(all LedgerEntry.amount)` should always be 0.

Sign convention (standard double-entry): a positive `LedgerEntry.amount` is
a debit, negative is a credit. Each account kind has a "normal" side that
increases when it grows:
  - monnify_settlement (asset: real cash sitting at Monnify)      -> debit-normal
  - client_wallet / talent_wallet (liability: money owed to a user) -> credit-normal
  - platform_escrow (liability: funded-but-unresolved milestone funds) -> credit-normal
  - platform_holding (liability: withheld payout amounts, owed later) -> credit-normal
  - platform_revenue (equity: fees the platform has earned)        -> credit-normal

`LedgerAccount.balance` is a cached, always-in-sync running total already
converted to "the actual value in that bucket" (i.e. positive under normal
use) — see app/services/ledger.py for how it's maintained. Don't write to it
directly; always go through that service so entries and balances can't drift
apart.
"""
import enum
import uuid
from datetime import datetime

from sqlalchemy import Float, ForeignKey, String, DateTime, Enum, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

def gen_uuid() -> str:
    return str(uuid.uuid4())

class LedgerAccountKind(str, enum.Enum):
    monnify_settlement = "monnify_settlement"
    client_wallet = "client_wallet"
    talent_wallet = "talent_wallet"
    platform_escrow = "platform_escrow"
    platform_holding = "platform_holding"
    platform_revenue = "platform_revenue"

DEBIT_NORMAL_KINDS = {LedgerAccountKind.monnify_settlement}

class LedgerTransactionType(str, enum.Enum):
    topup = "topup"
    milestone_fund = "milestone_fund"
    milestone_release = "milestone_release"
    milestone_refund = "milestone_refund"
    milestone_split = "milestone_split"
    acceptance_fee = "acceptance_fee"
    withdrawal = "withdrawal"
    withholding_release = "withholding_release"
    admin_adjustment = "admin_adjustment"
    opening_balance = "opening_balance"

class LedgerAccount(Base):
    __tablename__ = "ledger_accounts"
    __table_args__ = (UniqueConstraint("kind", "user_id", name="uq_ledger_account_kind_user"),)

    id: Mapped[str] = mapped_column(String, primary_key=True, default=gen_uuid)
    kind: Mapped[LedgerAccountKind] = mapped_column(Enum(LedgerAccountKind), nullable=False)
    # Only set for per-user account kinds (client_wallet, talent_wallet); the
    # platform-wide kinds (monnify_settlement, platform_escrow,
    # platform_holding, platform_revenue) are singletons with user_id=None.
    user_id: Mapped[str | None] = mapped_column(String, ForeignKey("users.id"), nullable=True)
    balance: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

class LedgerTransaction(Base):
    __tablename__ = "ledger_transactions"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=gen_uuid)
    type: Mapped[LedgerTransactionType] = mapped_column(Enum(LedgerTransactionType), nullable=False)
    description: Mapped[str] = mapped_column(String, nullable=False)
    reference: Mapped[str | None] = mapped_column(String, nullable=True)
    # Loose pointer back to the business object this posting is about
    # (e.g. related_type="milestone", related_id=milestone.id), for tracing
    # a ledger entry back to what caused it without a hard FK per type.
    related_type: Mapped[str | None] = mapped_column(String, nullable=True)
    related_id: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    entries: Mapped[list["LedgerEntry"]] = relationship(
        "LedgerEntry", back_populates="transaction", cascade="all, delete-orphan"
    )

class LedgerEntry(Base):
    __tablename__ = "ledger_entries"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=gen_uuid)
    transaction_id: Mapped[str] = mapped_column(String, ForeignKey("ledger_transactions.id"), nullable=False)
    account_id: Mapped[str] = mapped_column(String, ForeignKey("ledger_accounts.id"), nullable=False)
    amount: Mapped[float] = mapped_column(Float, nullable=False)  # positive=debit, negative=credit
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    transaction: Mapped["LedgerTransaction"] = relationship("LedgerTransaction", back_populates="entries")
    account: Mapped["LedgerAccount"] = relationship("LedgerAccount")
