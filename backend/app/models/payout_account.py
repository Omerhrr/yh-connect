import uuid
from datetime import datetime

from sqlalchemy import String, ForeignKey, DateTime, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


def gen_uuid() -> str:
    return str(uuid.uuid4())


class PayoutAccount(Base):
    """One bank account a professional can withdraw to. Replaces the old
    single bank_code/bank_account_number/bank_account_name columns on
    ProfessionalProfile — a professional can now add more than one (e.g. a
    personal account and a business account) and pick which is active.

    account_name is whatever Monnify's name-enquiry returns for the account
    number + bank code (the bank's own record, not user-entered), and
    name_match records whether that resolved name reasonably matches the
    professional's own account name (first_name/last_name on User) at the
    time it was added — a mismatch is a strong signal of a wrong or
    someone-else's account, so withdrawals are blocked to it (see wallet.py).
    """
    __tablename__ = "payout_accounts"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=gen_uuid)
    professional_id: Mapped[str] = mapped_column(String, ForeignKey("users.id"), nullable=False)

    bank_code: Mapped[str] = mapped_column(String, nullable=False)
    bank_name: Mapped[str | None] = mapped_column(String, nullable=True)
    account_number: Mapped[str] = mapped_column(String, nullable=False)
    account_name: Mapped[str] = mapped_column(String, nullable=False)
    name_match: Mapped[bool] = mapped_column(Boolean, default=False)

    is_default: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    professional: Mapped["User"] = relationship("User")
