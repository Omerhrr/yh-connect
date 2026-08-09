import enum
import uuid
from datetime import datetime

from sqlalchemy import String, Float, Text, ForeignKey, DateTime, Enum
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


def gen_uuid() -> str:
    return str(uuid.uuid4())


class InviteStatus(str, enum.Enum):
    pending = "pending"
    accepted = "accepted"
    declined = "declined"


class ProjectInvite(Base):
    __tablename__ = "project_invites"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=gen_uuid)
    project_id: Mapped[str] = mapped_column(String, ForeignKey("projects.id"), nullable=False)
    professional_id: Mapped[str] = mapped_column(String, ForeignKey("users.id"), nullable=False)
    client_id: Mapped[str] = mapped_column(String, ForeignKey("users.id"), nullable=False)

    proposed_amount: Mapped[float | None] = mapped_column(Float, nullable=True)
    message: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[InviteStatus] = mapped_column(Enum(InviteStatus), default=InviteStatus.pending)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    project: Mapped["Project"] = relationship("Project")
    professional: Mapped["User"] = relationship("User", foreign_keys=[professional_id])
    client: Mapped["User"] = relationship("User", foreign_keys=[client_id])
