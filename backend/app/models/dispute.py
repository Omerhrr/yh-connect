import enum
import uuid
from datetime import datetime

from sqlalchemy import String, Text, ForeignKey, DateTime, Enum, Float
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


def gen_uuid() -> str:
    return str(uuid.uuid4())


class DisputeStatus(str, enum.Enum):
    open = "open"                # just filed, awaiting admin triage
    under_review = "under_review"  # an admin has picked it up and is actively looking into it
    escalated = "escalated"      # flagged as higher priority / needs senior review
    resolved = "resolved"        # admin has made a final call
    withdrawn = "withdrawn"      # the raiser retracted it


# Statuses that still block fund release / new funding on the related milestone.
BLOCKING_STATUSES = (DisputeStatus.open, DisputeStatus.under_review, DisputeStatus.escalated)


class DisputeCategory(str, enum.Enum):
    payment = "payment"
    quality = "quality"
    non_delivery = "non_delivery"
    scope_disagreement = "scope_disagreement"
    unresponsive = "unresponsive"
    other = "other"


class DisputeOutcome(str, enum.Enum):
    refund_client = "refund_client"
    release_professional = "release_professional"
    partial_split = "partial_split"
    no_action = "no_action"


class ProposalStatus(str, enum.Enum):
    none = "none"
    pending = "pending"
    accepted = "accepted"
    declined = "declined"
    expired = "expired"


class Dispute(Base):
    __tablename__ = "disputes"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=gen_uuid)
    project_id: Mapped[str] = mapped_column(String, ForeignKey("projects.id"), nullable=False)
    milestone_id: Mapped[str | None] = mapped_column(String, ForeignKey("milestones.id"), nullable=True)
    raised_by: Mapped[str] = mapped_column(String, ForeignKey("users.id"), nullable=False)
    category: Mapped[DisputeCategory] = mapped_column(Enum(DisputeCategory), default=DisputeCategory.other)
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    evidence_urls: Mapped[str | None] = mapped_column(Text, nullable=True)  # comma-separated

    status: Mapped[DisputeStatus] = mapped_column(Enum(DisputeStatus), default=DisputeStatus.open)
    outcome: Mapped[DisputeOutcome | None] = mapped_column(Enum(DisputeOutcome), nullable=True)
    resolution_note: Mapped[str | None] = mapped_column(Text, nullable=True)
    resolved_by: Mapped[str | None] = mapped_column(String, ForeignKey("users.id"), nullable=True)
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    # First-tier direct resolution: either party can propose a settlement
    # before this ever reaches an admin, the way Fiverr's Resolution Center
    # and Upwork's initial claim step work. If the other side doesn't
    # respond within the window, it auto-accepts, putting time pressure on
    # an unresponsive party without anyone having to escalate.
    proposal_status: Mapped[ProposalStatus] = mapped_column(Enum(ProposalStatus), default=ProposalStatus.none)
    proposed_outcome: Mapped[DisputeOutcome | None] = mapped_column(Enum(DisputeOutcome), nullable=True)
    proposed_split_amount: Mapped[float | None] = mapped_column(Float, nullable=True)
    proposed_by: Mapped[str | None] = mapped_column(String, ForeignKey("users.id"), nullable=True)
    proposal_note: Mapped[str | None] = mapped_column(Text, nullable=True)
    proposal_expires_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    project: Mapped["Project"] = relationship("Project")
    milestone: Mapped["Milestone"] = relationship("Milestone")
    messages: Mapped[list["DisputeMessage"]] = relationship(
        "DisputeMessage", back_populates="dispute", cascade="all, delete-orphan", order_by="DisputeMessage.created_at"
    )
    events: Mapped[list["DisputeEvent"]] = relationship(
        "DisputeEvent", back_populates="dispute", cascade="all, delete-orphan", order_by="DisputeEvent.created_at"
    )

    @property
    def evidence_url_list(self) -> list[str]:
        if not self.evidence_urls:
            return []
        return [u.strip() for u in self.evidence_urls.split(",") if u.strip()]


class DisputeMessage(Base):
    """Threaded back-and-forth on a dispute case: raiser, other party, and admins."""

    __tablename__ = "dispute_messages"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=gen_uuid)
    dispute_id: Mapped[str] = mapped_column(String, ForeignKey("disputes.id"), nullable=False)
    sender_id: Mapped[str] = mapped_column(String, ForeignKey("users.id"), nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    dispute: Mapped["Dispute"] = relationship("Dispute", back_populates="messages")


class DisputeEvent(Base):
    """Audit trail of every status change on a dispute, for accountability."""

    __tablename__ = "dispute_events"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=gen_uuid)
    dispute_id: Mapped[str] = mapped_column(String, ForeignKey("disputes.id"), nullable=False)
    actor_id: Mapped[str | None] = mapped_column(String, ForeignKey("users.id"), nullable=True)
    from_status: Mapped[str | None] = mapped_column(String, nullable=True)
    to_status: Mapped[str] = mapped_column(String, nullable=False)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    dispute: Mapped["Dispute"] = relationship("Dispute", back_populates="events")
