import enum
import uuid
from datetime import datetime

from sqlalchemy import String, Float, Text, ForeignKey, DateTime, Enum, Integer, Date, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


def gen_uuid() -> str:
    return str(uuid.uuid4())


class MilestoneStatus(str, enum.Enum):
    pending = "pending"       # defined, not started
    in_progress = "in_progress"
    submitted = "submitted"   # professional says it's done, awaiting client approval
    approved = "approved"     # client approved
    funded = "funded"         # client has paid into escrow for this milestone
    paid = "paid"             # disbursed to professional
    refunded = "refunded"     # escrow funds were returned to the client (dispute outcome)
    rejected = "rejected"     # client declined this milestone before any money moved


class Milestone(Base):
    __tablename__ = "milestones"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=gen_uuid)
    project_id: Mapped[str] = mapped_column(String, ForeignKey("projects.id"), nullable=False)
    # Who defined this milestone: the client, or the assigned professional
    # proposing it (the client's funding decision is the approval gate).
    created_by: Mapped[str | None] = mapped_column(String, ForeignKey("users.id"), nullable=True)
    title: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    amount: Mapped[float] = mapped_column(Float, nullable=False)
    due_date: Mapped[datetime | None] = mapped_column(Date, nullable=True)
    status: Mapped[MilestoneStatus] = mapped_column(Enum(MilestoneStatus), default=MilestoneStatus.pending)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    # Set (and refreshed) whenever the professional submits, independent of
    # whether that also flips `status` to "submitted" (it won't if the
    # milestone was already funded) — this is the one reliable signal for
    # "work was delivered on this date", used for the auto-release timer and
    # the "submitted N days ago" badge shown to the client.
    submitted_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    # Guards against sending the "will auto-release soon" reminder more than
    # once per submission.
    auto_release_reminder_sent: Mapped[bool] = mapped_column(Boolean, default=False)
    # Client's stated reason when rejecting a milestone that was never funded
    # (proposed/submitted but no money moved yet) — the record the user asked
    # for, and what the professional sees to know why and revise/resubmit.
    rejection_note: Mapped[str | None] = mapped_column(Text, nullable=True)
    rejected_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    # Payment protection holdback (see platform_settings
    # "payment_withholding_percent"/"payment_withholding_release_days"): the
    # portion of a released payout kept back from the professional's wallet
    # until `withheld_release_at`, at which point it's auto-credited. Null
    # `withheld_amount` means no holdback applied to this milestone's payout
    # (feature disabled, or milestone not yet paid).
    withheld_amount: Mapped[float | None] = mapped_column(Float, nullable=True)
    withheld_release_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    withheld_released_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    project: Mapped["Project"] = relationship("Project", back_populates="milestones")
    updates: Mapped[list["MilestoneUpdate"]] = relationship(
        "MilestoneUpdate", back_populates="milestone", cascade="all, delete-orphan", order_by="MilestoneUpdate.created_at"
    )
