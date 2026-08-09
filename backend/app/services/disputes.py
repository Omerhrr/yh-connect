from sqlalchemy.orm import Session

from app.models.dispute import Dispute, BLOCKING_STATUSES
from app.models.user import User, UserRole
from app.schemas.dispute import DisputeDetailOut, DisputeEventOut, DisputeMessageOut, DisputeOut


def _user_name(db: Session, user_id: str | None) -> str | None:
    if not user_id:
        return None
    u = db.get(User, user_id)
    return f"{u.first_name} {u.last_name}" if u else None


def build_dispute_out(d: Dispute, db: Session) -> DisputeOut:
    out = DisputeOut(
        id=d.id, project_id=d.project_id, milestone_id=d.milestone_id, category=d.category,
        raised_by=d.raised_by, reason=d.reason, evidence_urls=d.evidence_url_list, status=d.status,
        outcome=d.outcome, resolution_note=d.resolution_note, resolved_at=d.resolved_at,
        created_at=d.created_at, updated_at=d.updated_at,
    )
    out.project_title = d.project.title if d.project else None
    out.raised_by_name = _user_name(db, d.raised_by)
    out.resolved_by_name = _user_name(db, d.resolved_by)
    out.message_count = len(d.messages)

    if d.milestone:
        out.milestone_title = d.milestone.title
        out.milestone_amount = d.milestone.amount

    if d.project:
        other_party = d.project.assigned_professional_id if d.raised_by == d.project.client_id else d.project.client_id
        out.other_party_id = other_party
        out.other_party_name = _user_name(db, other_party)

    return out


def build_dispute_detail_out(d: Dispute, db: Session) -> DisputeDetailOut:
    base = build_dispute_out(d, db)
    messages = []
    for m in d.messages:
        sender = db.get(User, m.sender_id)
        messages.append(
            DisputeMessageOut(
                id=m.id, sender_id=m.sender_id,
                sender_name=f"{sender.first_name} {sender.last_name}" if sender else None,
                is_admin=bool(sender and sender.role == UserRole.admin),
                body=m.body, created_at=m.created_at,
            )
        )
    events = []
    for e in d.events:
        events.append(
            DisputeEventOut(
                id=e.id, actor_id=e.actor_id, actor_name=_user_name(db, e.actor_id),
                from_status=e.from_status, to_status=e.to_status, note=e.note, created_at=e.created_at,
            )
        )
    return DisputeDetailOut(**base.model_dump(), messages=messages, events=events)


def has_blocking_dispute(db: Session, project_id: str, milestone_id: str | None) -> bool:
    """True if there's an unresolved dispute that should freeze fund movement.

    A dispute tied to a specific milestone only blocks that milestone. A
    dispute with no milestone_id (raised against the project generally)
    blocks every milestone on the project, since it's not scoped to one
    payment.
    """
    query = db.query(Dispute).filter(
        Dispute.project_id == project_id,
        Dispute.status.in_(BLOCKING_STATUSES),
    )
    for d in query.all():
        if d.milestone_id is None or d.milestone_id == milestone_id:
            return True
    return False
