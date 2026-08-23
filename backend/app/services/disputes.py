from datetime import datetime

from sqlalchemy.orm import Session

from app.models.dispute import Dispute, DisputeEvent, DisputeStatus, ProposalStatus, BLOCKING_STATUSES
from app.models.milestone import Milestone
from app.models.notification import NotificationType
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
        proposal_status=d.proposal_status, proposed_outcome=d.proposed_outcome,
        proposed_split_amount=d.proposed_split_amount, proposed_by=d.proposed_by,
        proposal_note=d.proposal_note, proposal_expires_at=d.proposal_expires_at,
    )
    out.project_title = d.project.title if d.project else None
    out.raised_by_name = _user_name(db, d.raised_by)
    out.resolved_by_name = _user_name(db, d.resolved_by)
    out.proposed_by_name = _user_name(db, d.proposed_by)
    out.message_count = len(d.messages)

    if d.milestone:
        out.milestone_title = d.milestone.title
        out.milestone_amount = d.milestone.amount
        out.milestone_status = d.milestone.status.value

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


def has_any_blocking_dispute(db: Session, project_id: str) -> bool:
    """True if there's an unresolved dispute anywhere on the project,
    regardless of which milestone (if any) it's scoped to. Unlike
    has_blocking_dispute (which is used to gate fund movement on one
    specific milestone), this is for project-level actions like completing
    or confirming the project: those shouldn't be allowed to proceed while
    ANY dispute is still open, even one scoped to a single already-paid
    milestone, or the client could lock in "completed" (unlocking reviews)
    while a live quality/payment dispute is still unresolved.
    """
    return (
        db.query(Dispute)
        .filter(Dispute.project_id == project_id, Dispute.status.in_(BLOCKING_STATUSES))
        .first()
        is not None
    )


class DisputeOutcomeError(Exception):
    pass


def apply_dispute_outcome(db: Session, dispute: Dispute, outcome, split_amount: float | None, actor_id: str, source: str) -> str | None:
    """Move real money for a dispute outcome, shared between an admin's
    resolution and a direct-resolution proposal the other party accepted —
    the same fund-movement path either way, no parallel/looser
    implementation for the "informal" resolution route. Returns a
    human-readable note of what happened, or None if no milestone was
    attached. Caller commits."""
    from app.services.escrow import EscrowActionError, disburse_milestone, refund_milestone, split_milestone

    if not dispute.milestone_id or outcome not in ("refund_client", "release_professional", "partial_split"):
        return None
    milestone = db.get(Milestone, dispute.milestone_id)
    if milestone is None:
        raise DisputeOutcomeError("The linked milestone no longer exists")
    if milestone.status.value not in ("funded", "approved"):
        return None
    try:
        if outcome == "refund_client":
            refund_milestone(db, milestone, dispute.project, actor_id, note=f"Dispute {source}: refund for milestone '{milestone.title}'")
            return "Funds refunded to the client."
        if outcome == "release_professional":
            disburse_milestone(db, milestone, dispute.project, actor_id, note=f"Dispute {source}: release for milestone '{milestone.title}'")
            return "Funds released to the professional."
        if outcome == "partial_split":
            if split_amount is None:
                raise DisputeOutcomeError("Specify how much of the milestone amount goes to the professional")
            split_milestone(db, milestone, dispute.project, actor_id, professional_amount=split_amount, note=f"Dispute {source}: partial split for milestone '{milestone.title}'")
            return f"₦{split_amount:,.2f} released to the professional, the rest refunded to the client."
    except EscrowActionError as e:
        raise DisputeOutcomeError(str(e))
    return None


def check_and_expire_proposals(db: Session, disputes: list[Dispute]) -> None:
    """Lazy auto-accept for direct-resolution proposals whose response
    window has passed — same "no scheduler, check on load" pattern as
    milestone auto-release. Puts real time pressure on an unresponsive
    party without anyone having to manually escalate."""
    from app.services.platform_settings import get_dispute_direct_resolution_hours

    now = datetime.utcnow()
    for d in disputes:
        if d.proposal_status != ProposalStatus.pending or not d.proposal_expires_at:
            continue
        if now < d.proposal_expires_at:
            continue
        try:
            fund_note = apply_dispute_outcome(db, d, d.proposed_outcome.value if d.proposed_outcome else None, d.proposed_split_amount, d.proposed_by, source="auto-accepted proposal")
        except DisputeOutcomeError:
            # Can't safely settle automatically (e.g. milestone state moved
            # under it) — leave it pending for a human to sort out rather
            # than silently expiring.
            continue
        d.proposal_status = ProposalStatus.accepted
        d.status = DisputeStatus.resolved
        d.outcome = d.proposed_outcome
        d.resolved_by = d.proposed_by
        d.resolved_at = now
        d.updated_at = now
        db.add(DisputeEvent(
            dispute_id=d.id, actor_id=None, from_status=DisputeStatus.open.value, to_status=DisputeStatus.resolved.value,
            note=f"Proposal auto-accepted after no response within the window.{f' ({fund_note})' if fund_note else ''}",
        ))
        from app.services.notify import notify
        project = d.project
        for party_id in (project.client_id, project.assigned_professional_id):
            if not party_id:
                continue
            role_path = "client" if party_id == project.client_id else "talent"
            notify(
                db, party_id, NotificationType.dispute_resolved,
                f"Dispute on \"{project.title}\" auto-resolved",
                body=f"The other party didn't respond to the proposed resolution in time, so it was automatically accepted.{f' {fund_note}' if fund_note else ''}",
                link=f"/{role_path}/dashboard/disputes/{d.id}", email_also=True,
            )
        db.commit()
