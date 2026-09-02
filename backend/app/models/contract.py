import enum
import uuid
from datetime import datetime

from sqlalchemy import String, Text, ForeignKey, DateTime, Enum, Integer, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

def gen_uuid() -> str:
    return str(uuid.uuid4())

class ContractStatus(str, enum.Enum):
    draft = "draft"
    sent_to_client = "sent_to_client"
    sent_to_professional = "sent_to_professional"
    approved = "approved"

class Contract(Base):
    """The scope-of-work agreement auto-generated the moment a bid is
    accepted, sitting between acceptance and job commencement. Either party
    can edit it (the talent often knows the scope better than the client),
    and either can send it to the other for review. It only unlocks work
    (milestone funding) once both sides have approved the current content —
    any edit resets both approvals."""

    __tablename__ = "contracts"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=gen_uuid)
    project_id: Mapped[str] = mapped_column(String, ForeignKey("projects.id"), nullable=False, unique=True)
    bid_id: Mapped[str | None] = mapped_column(String, ForeignKey("bids.id"), nullable=True)
    client_id: Mapped[str] = mapped_column(String, ForeignKey("users.id"), nullable=False)
    professional_id: Mapped[str] = mapped_column(String, ForeignKey("users.id"), nullable=False)

    content: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[ContractStatus] = mapped_column(Enum(ContractStatus), default=ContractStatus.draft)

    client_approved: Mapped[bool] = mapped_column(Boolean, default=False)
    professional_approved: Mapped[bool] = mapped_column(Boolean, default=False)
    last_edited_by: Mapped[str | None] = mapped_column(String, nullable=True)  # "client" | "professional"
    version: Mapped[int] = mapped_column(Integer, default=1)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    approved_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    project: Mapped["Project"] = relationship("Project")
    client: Mapped["User"] = relationship("User", foreign_keys=[client_id])
    professional: Mapped["User"] = relationship("User", foreign_keys=[professional_id])

    @property
    def is_approved(self) -> bool:
        return self.status == ContractStatus.approved
