import enum
import uuid
from datetime import datetime

from sqlalchemy import String, DateTime, Enum, ForeignKey, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


def gen_uuid() -> str:
    return str(uuid.uuid4())


class NotificationType(str, enum.Enum):
    bid_received = "bid_received"
    bid_accepted = "bid_accepted"
    bid_rejected = "bid_rejected"
    bid_shortlisted = "bid_shortlisted"
    milestone_funded = "milestone_funded"
    milestone_released = "milestone_released"
    dispute_opened = "dispute_opened"
    dispute_message = "dispute_message"
    dispute_resolved = "dispute_resolved"
    invite_received = "invite_received"
    message_received = "message_received"
    kyc_status_changed = "kyc_status_changed"
    general = "general"


class Notification(Base):
    __tablename__ = "notifications"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=gen_uuid)
    user_id: Mapped[str] = mapped_column(String, ForeignKey("users.id"), nullable=False, index=True)
    type: Mapped[NotificationType] = mapped_column(Enum(NotificationType), default=NotificationType.general)
    title: Mapped[str] = mapped_column(String, nullable=False)
    body: Mapped[str | None] = mapped_column(Text, nullable=True)
    link: Mapped[str | None] = mapped_column(String, nullable=True)
    read_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
