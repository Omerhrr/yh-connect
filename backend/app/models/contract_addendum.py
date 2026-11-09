import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


def gen_uuid() -> str:
    return str(uuid.uuid4())


class ContractAddendum(Base):
    """A separately-approved amendment / out-of-scope work agreement attached
    to an approved *flexible* contract. The original contract is preserved
    untouched; each addendum is its own mini-contract that both parties must
    approve before it takes effect. status: pending | approved | rejected."""

    __tablename__ = "contract_addenda"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=gen_uuid)
    contract_id: Mapped[str] = mapped_column(String, ForeignKey("contracts.id"), nullable=False, index=True)
    project_id: Mapped[str] = mapped_column(String, ForeignKey("projects.id"), nullable=False, index=True)
    proposed_by: Mapped[str] = mapped_column(String, ForeignKey("users.id"), nullable=False)
    title: Mapped[str] = mapped_column(String, nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    amount_delta: Mapped[float] = mapped_column(Float, default=0.0)
    status: Mapped[str] = mapped_column(String, default="pending")
    client_approved: Mapped[bool] = mapped_column(Boolean, default=False)
    professional_approved: Mapped[bool] = mapped_column(Boolean, default=False)
    resulting_milestone_id: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    approved_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
