from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_role
from app.db.session import get_db
from app.models.dispute import BLOCKING_STATUSES, Dispute, DisputeEvent, DisputeMessage, DisputeStatus
from app.models.milestone import Milestone
from app.models.notification import NotificationType
from app.models.project import Project
from app.models.user import User, UserRole
from app.schemas.dispute import (
    DisputeCreate,
    DisputeDetailOut,
    DisputeMessageCreate,
    DisputeMessageOut,
    DisputeOut,
    DisputeResolve,
)
from app.services.disputes import build_dispute_detail_out, build_dispute_out
from app.services.escrow import EscrowActionError, disburse_milestone, refund_milestone
from app.services.notify import notify

router = APIRouter(prefix="/disputes", tags=["disputes"])

# Admin-driven status transitions allowed from each current status. Keeps a
# PATCH from jumping e.g. resolved -> escalated with no trail, or resolving
# something that was already withdrawn by the raiser.
ADMIN_TRANSITIONS: dict[DisputeStatus, set[DisputeStatus]] = {
    DisputeStatus.open: {DisputeStatus.under_review, DisputeStatus.escalated, DisputeStatus.resolved},
    DisputeStatus.under_review: {DisputeStatus.escalated, DisputeStatus.resolved},
    DisputeStatus.escalated: {DisputeStatus.under_review, DisputeStatus.resolved},
    DisputeStatus.resolved: set(),
    DisputeStatus.withdrawn: set(),
}


def _get_party_dispute(dispute_id: str, current_user: User, db: Session) -> Dispute:
    dispute = db.get(Dispute, dispute_id)
    if not dispute:
        raise HTTPException(status_code=404, detail="Dispute not found")
    project = dispute.project
    if current_user.role != UserRole.admin and current_user.id not in (project.client_id, project.assigned_professional_id):
        raise HTTPException(status_code=403, detail="Not authorized for this dispute")
    return dispute


@router.post("", response_model=DisputeOut, status_code=201)
def create_dispute(payload: DisputeCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    project = db.get(Project, payload.project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if current_user.id not in (project.client_id, project.assigned_professional_id):
        raise HTTPException(status_code=403, detail="Not authorized for this project")

    if payload.milestone_id:
        milestone = db.get(Milestone, payload.milestone_id)
        if not milestone or milestone.project_id != project.id:
            raise HTTPException(status_code=400, detail="Milestone does not belong to this project")

    existing = (
        db.query(Dispute)
        .filter(Dispute.project_id == project.id, Dispute.milestone_id == payload.milestone_id)
        .filter(Dispute.status.in_(BLOCKING_STATUSES))
        .first()
    )
    if existing:
        raise HTTPException(status_code=400, detail="There's already an open dispute for this milestone/project")

    if not payload.reason.strip():
        raise HTTPException(status_code=400, detail="Please describe the issue")

    dispute = Dispute(
        project_id=payload.project_id,
        milestone_id=payload.milestone_id,
        raised_by=current_user.id,
        category=payload.category,
        reason=payload.reason.strip(),
        evidence_urls=",".join(payload.evidence_urls) if payload.evidence_urls else None,
    )
    db.add(dispute)
    db.flush()
    db.add(DisputeEvent(dispute_id=dispute.id, actor_id=current_user.id, from_status=None, to_status=DisputeStatus.open.value, note="Dispute filed"))

    other_party = project.assigned_professional_id if current_user.id == project.client_id else project.client_id
    if other_party:
        notify(
            db, other_party, NotificationType.dispute_opened,
            f"A dispute was opened on \"{project.title}\"",
            body=dispute.reason,
            link=f"/{'talent' if other_party == project.assigned_professional_id else 'client'}/dashboard/disputes/{dispute.id}",
            email_also=True,
        )
    db.commit()
    db.refresh(dispute)
    return build_dispute_out(dispute, db)


@router.get("/mine", response_model=list[DisputeOut])
def my_disputes(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    disputes = (
        db.query(Dispute)
        .join(Project, Dispute.project_id == Project.id)
        .filter((Project.client_id == current_user.id) | (Project.assigned_professional_id == current_user.id))
        .order_by(Dispute.created_at.desc())
        .all()
    )
    return [build_dispute_out(d, db) for d in disputes]


@router.get("/{dispute_id}", response_model=DisputeDetailOut)
def get_dispute(dispute_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    dispute = _get_party_dispute(dispute_id, current_user, db)
    return build_dispute_detail_out(dispute, db)


@router.post("/{dispute_id}/messages", response_model=DisputeMessageOut, status_code=201)
def add_dispute_message(
    dispute_id: str,
    payload: DisputeMessageCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    dispute = _get_party_dispute(dispute_id, current_user, db)
    if dispute.status in (DisputeStatus.resolved, DisputeStatus.withdrawn):
        raise HTTPException(status_code=400, detail="This dispute is closed")
    if not payload.body.strip():
        raise HTTPException(status_code=400, detail="Message can't be empty")

    msg = DisputeMessage(dispute_id=dispute.id, sender_id=current_user.id, body=payload.body.strip())
    db.add(msg)

    project = dispute.project
    recipients = {dispute.raised_by, project.client_id, project.assigned_professional_id} - {current_user.id, None}
    for uid in recipients:
        role_path = "client" if uid == project.client_id else "talent"
        notify(
            db, uid, NotificationType.dispute_message,
            f"New reply on the dispute for \"{project.title}\"",
            body=msg.body,
            link=f"/{role_path}/dashboard/disputes/{dispute.id}",
            email_also=True,
        )
    db.commit()
    db.refresh(msg)
    sender = current_user
    return DisputeMessageOut(
        id=msg.id, sender_id=msg.sender_id, sender_name=f"{sender.first_name} {sender.last_name}",
        is_admin=sender.role == UserRole.admin, body=msg.body, created_at=msg.created_at,
    )


@router.post("/{dispute_id}/withdraw", response_model=DisputeOut)
def withdraw_dispute(dispute_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    dispute = db.get(Dispute, dispute_id)
    if not dispute:
        raise HTTPException(status_code=404, detail="Dispute not found")
    if dispute.raised_by != current_user.id:
        raise HTTPException(status_code=403, detail="Only the person who raised this dispute can withdraw it")
    if dispute.status not in (DisputeStatus.open, DisputeStatus.under_review):
        raise HTTPException(status_code=400, detail="This dispute can no longer be withdrawn")

    prev = dispute.status
    dispute.status = DisputeStatus.withdrawn
    dispute.updated_at = datetime.utcnow()
    db.add(DisputeEvent(dispute_id=dispute.id, actor_id=current_user.id, from_status=prev.value, to_status=DisputeStatus.withdrawn.value, note="Withdrawn by raiser"))

    project = dispute.project
    other_party = project.assigned_professional_id if current_user.id == project.client_id else project.client_id
    if other_party:
        notify(
            db, other_party, NotificationType.general,
            f"A dispute on \"{project.title}\" was withdrawn",
            body="The other party withdrew this dispute. Funds are no longer on hold for it.",
            link=f"/{'talent' if other_party == project.assigned_professional_id else 'client'}/dashboard/disputes/{dispute.id}",
            email_also=True,
        )
    db.commit()
    db.refresh(dispute)
    return build_dispute_out(dispute, db)


@router.patch("/{dispute_id}", response_model=DisputeDetailOut)
def resolve_dispute(
    dispute_id: str,
    payload: DisputeResolve,
    current_user: User = Depends(require_role(UserRole.admin)),
    db: Session = Depends(get_db),
):
    dispute = db.get(Dispute, dispute_id)
    if not dispute:
        raise HTTPException(status_code=404, detail="Dispute not found")

    allowed = ADMIN_TRANSITIONS.get(dispute.status, set())
    if payload.status != dispute.status and payload.status not in allowed:
        raise HTTPException(status_code=400, detail=f"Can't move a dispute from {dispute.status.value} to {payload.status.value}")
    if payload.status == DisputeStatus.resolved and not payload.outcome:
        raise HTTPException(status_code=400, detail="An outcome is required to resolve a dispute")

    prev = dispute.status
    dispute.status = payload.status
    dispute.resolution_note = payload.resolution_note
    dispute.updated_at = datetime.utcnow()

    fund_note = None
    if payload.status == DisputeStatus.resolved:
        dispute.outcome = payload.outcome
        dispute.resolved_by = current_user.id
        dispute.resolved_at = datetime.utcnow()

        if dispute.milestone_id and payload.outcome in ("refund_client", "release_professional"):
            milestone = db.get(Milestone, dispute.milestone_id)
            project = dispute.project
            try:
                if payload.outcome == "refund_client" and milestone.status.value in ("funded", "approved"):
                    disburse_note = f"Dispute resolution: refund for milestone '{milestone.title}'"
                    refund_milestone(db, milestone, project, current_user.id, note=disburse_note)
                    fund_note = "₦ refunded to the client."
                elif payload.outcome == "release_professional" and milestone.status.value in ("funded", "approved"):
                    disburse_note = f"Dispute resolution: release for milestone '{milestone.title}'"
                    disburse_milestone(db, milestone, project, current_user.id, note=disburse_note)
                    fund_note = "Funds released to the professional."
            except EscrowActionError as e:
                raise HTTPException(status_code=400, detail=f"Could not complete the fund action: {e}")

    db.add(DisputeEvent(
        dispute_id=dispute.id, actor_id=current_user.id, from_status=prev.value, to_status=payload.status.value,
        note=(payload.resolution_note or "") + (f" ({fund_note})" if fund_note else ""),
    ))

    project = db.get(Project, dispute.project_id)
    if project:
        for party_id in (project.client_id, project.assigned_professional_id):
            if not party_id:
                continue
            role_path = "client" if party_id == project.client_id else "talent"
            notify(
                db, party_id, NotificationType.dispute_resolved if payload.status == DisputeStatus.resolved else NotificationType.general,
                f"Dispute on \"{project.title}\" was {payload.status.value.replace('_', ' ')}",
                body=payload.resolution_note or "An administrator has updated this dispute.",
                link=f"/{role_path}/dashboard/disputes/{dispute.id}", email_also=True,
            )

    db.commit()
    db.refresh(dispute)
    return build_dispute_detail_out(dispute, db)
