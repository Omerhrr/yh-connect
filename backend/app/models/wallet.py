import enum
import uuid
from datetime import datetime

from sqlalchemy import String, Float, ForeignKey, DateTime, Enum
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

def gen_uuid() -> str:
    return str(uuid.uuid4())

class WalletTransactionType(str, enum.Enum):
    topup = "topup"
    funding = "funding"
    release = "release"
    refund = "refund"
    withdrawal = "withdrawal"
    adjustment = "adjustment"

class WalletTransactionStatus(str, enum.Enum):
    pending = "pending"
    successful = "successful"
    failed = "failed"

class WalletTransaction(Base):
    __tablename__ = "wallet_transactions"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=gen_uuid)

    project_id: Mapped[str | None] = mapped_column(String, ForeignKey("projects.id"), nullable=True)
    milestone_id: Mapped[str | None] = mapped_column(String, ForeignKey("milestones.id"), nullable=True)

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
