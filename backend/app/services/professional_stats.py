"""Real (not fake) stats for the professional profile page: job counts,
dispute-free "job success" rate, and an approximate response-time label
derived from actual message reply times. No placeholder numbers."""

from datetime import timedelta

from sqlalchemy.orm import Session

from app.models.dispute import Dispute, DisputeOutcome
from app.models.message import Message
from app.models.profile import ProfessionalProfile
from app.models.project import Project, ProjectStatus
from app.schemas.profile_extras import ProfessionalStats

# Outcomes that count as a mark against the professional for job-success purposes.
_AGAINST_PRO_OUTCOMES = (DisputeOutcome.refund_client, DisputeOutcome.partial_split)


def compute_stats(db: Session, profile: ProfessionalProfile) -> ProfessionalStats:
    user_id = profile.user_id

    all_projects = db.query(Project).filter(Project.assigned_professional_id == user_id).all()
    total_projects = len(all_projects)
    completed = [p for p in all_projects if p.status == ProjectStatus.completed]
    completed_count = len(completed)

    job_success_rate = None
    if completed_count > 0:
        completed_ids = {p.id for p in completed}
        disputed_against = (
            db.query(Dispute.project_id)
            .filter(Dispute.project_id.in_(completed_ids), Dispute.outcome.in_(_AGAINST_PRO_OUTCOMES))
            .distinct()
            .count()
        )
        clean = max(completed_count - disputed_against, 0)
        job_success_rate = round((clean / completed_count) * 100)

    response_time_label = _response_time_label(db, user_id)

    return ProfessionalStats(
        total_projects=total_projects,
        completed_projects=completed_count,
        job_success_rate=job_success_rate,
        member_since=profile.user.created_at,
        response_time_label=response_time_label,
    )


def _response_time_label(db: Session, user_id: str) -> str:
    received = (
        db.query(Message)
        .filter(Message.recipient_id == user_id)
        .order_by(Message.created_at.desc())
        .limit(50)
        .all()
    )
    if not received:
        return "New professional"

    sent = (
        db.query(Message)
        .filter(Message.sender_id == user_id)
        .order_by(Message.created_at.asc())
        .all()
    )
    if not sent:
        return "New professional"

    sent_by_project: dict[str, list[Message]] = {}
    for m in sent:
        sent_by_project.setdefault(m.project_id, []).append(m)

    deltas_hours: list[float] = []
    window = timedelta(days=7)
    for r in received:
        candidates = sent_by_project.get(r.project_id, [])
        reply = next((s for s in candidates if s.created_at > r.created_at and s.created_at - r.created_at <= window), None)
        if reply:
            deltas_hours.append((reply.created_at - r.created_at).total_seconds() / 3600)

    if not deltas_hours:
        return "New professional"

    avg_hours = sum(deltas_hours) / len(deltas_hours)
    if avg_hours < 1:
        return "Usually responds within an hour"
    if avg_hours < 6:
        return "Usually responds within a few hours"
    if avg_hours < 24:
        return "Usually responds within a day"
    if avg_hours < 72:
        return "Usually responds within a few days"
    return "Response time varies"
