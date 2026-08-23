import enum
import uuid
from datetime import datetime

from sqlalchemy import String, Float, ForeignKey, DateTime, Enum
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


def gen_uuid() -> str:
    return str(uuid.uuid4())


class WalletTransactionType(str, enum.Enum):
    topup = "topup"            # client tops up their prepaid wallet balance
    funding = "funding"        # client pays into escrow (drawn from wallet balance)
    release = "release"        # escrow pays out into the professional's wallet balance
    refund = "refund"          # escrow refunds client's wallet balance
    withdrawal = "withdrawal"  # professional withdraws from their wallet balance to their bank
    adjustment = "adjustment"  # admin credit/debit to a user's wallet balance


class WalletTransactionStatus(str, enum.Enum):
    pending = "pending"
    successful = "successful"
    failed = "failed"


class WalletTransaction(Base):
    __tablename__ = "wallet_transactions"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=gen_uuid)
    # Nullable: a wallet top-up isn't tied to any specific project.
    project_id: Mapped[str | None] = mapped_column(String, ForeignKey("projects.id"), nullable=True)
    milestone_id: Mapped[str | None] = mapped_column(String, ForeignKey("milestones.id"), nullable=True)
    # Nullable: a professional's withdrawal transaction has no client on either side.
    client_id: Mapped[str | None] = mapped_column(String, ForeignKey("users.id"), nullable=True)
    professional_id: Mapped[str | None] = mapped_column(String, ForeignKey("users.id"), nullable=True)

    type: Mapped[WalletTransactionType] = mapped_column(Enum(WalletTransactionType), nullable=False)
    status: Mapped[WalletTransactionStatus] = mapped_column(Enum(WalletTransactionStatus), default=WalletTransactionStatus.pending)
    amount: Mapped[float] = mapped_column(Float, nullable=False)
    platform_fee: Mapped[float] = mapped_column(Float, default=0.0)
    monnify_reference: Mapped[str | None] = mapped_column(String, nullable=True, unique=True)
    note: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    project: Mapped["Project | None"] = relationship("Project")
