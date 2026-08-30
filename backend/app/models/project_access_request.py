import enum
import uuid
from datetime import datetime

from sqlalchemy import String, Text, ForeignKey, DateTime, Enum
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

def gen_uuid() -> str:
    return str(uuid.uuid4())

class AccessRequestType(str, enum.Enum):
    inspection = "inspection"
    chat = "chat"

class AccessRequestStatus(str, enum.Enum):
    pending = "pending"
    approved = "approved"
    rejected = "rejected"

class ProjectAccessRequest(Base):
    """A professional's request to either visit a project's site in person
    ('inspection') or simply open a chat with the client before bidding
    ('chat') — both require explicit client approval before the pair
    becomes a legitimate messaging party on the project (see
    _is_project_messaging_party in api/v1/messages.py). For an inspection,
    the client supplies the visit address/phone/details at approval time —
    the professional never enters an address themselves."""

    __tablename__ = "project_access_requests"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=gen_uuid)
    project_id: Mapped[str] = mapped_column(String, ForeignKey("projects.id"), nullable=False)
    professional_id: Mapped[str] = mapped_column(String, ForeignKey("users.id"), nullable=False)
    client_id: Mapped[str] = mapped_column(String, ForeignKey("users.id"), nullable=False)

    request_type: Mapped[AccessRequestType] = mapped_column(Enum(AccessRequestType), nullable=False)
    status: Mapped[AccessRequestStatus] = mapped_column(Enum(AccessRequestStatus), default=AccessRequestStatus.pending)

    note: Mapped[str | None] = mapped_column(Text, nullable=True)

    address: Mapped[str | None] = mapped_column(String, nullable=True)
    phone: Mapped[str | None] = mapped_column(String, nullable=True)
    details: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    responded_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    project: Mapped["Project"] = relationship("Project")
    professional: Mapped["User"] = relationship("User", foreign_keys=[professional_id])
    client: Mapped["User"] = relationship("User", foreign_keys=[client_id])
