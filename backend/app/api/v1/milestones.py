from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.change_order import ChangeOrder, ChangeOrderStatus
from app.models.milestone import Milestone, MilestoneStatus
from app.models.milestone_update import MilestoneUpdate
from app.models.project import Project, ProjectStatus
from app.models.user import User, UserRole
from app.services.platform_settings import get_platform_fee_percent
from app.services.auto_release import check_project_auto_release
from app.services.project_log import post_system_message
from app.schemas.milestone import (
    ChangeOrderCreate,
    ChangeOrderOut,
    MilestoneCreate,
    MilestoneOut,
    MilestoneRejectIn,
    MilestoneUpdateIn,
    MilestoneUpdateOut,
)

router = APIRouter(tags=["milestones"])


def _update_out(u: MilestoneUpdate) -> MilestoneUpdateOut:
    return MilestoneUpdateOut(
        id=u.id,
        milestone_id=u.milestone_id,
        created_by=u.created_by,
        author_name=f"{u.author.first_name} {u.author.last_name}" if u.author else None,
        note=u.note,
        photo_urls=u.photo_url_list,
        created_at=u.created_at,
    )


def _milestone_out(m: Milestone, db: Session) -> MilestoneOut:
    creator_name = None
    if m.created_by:
        creator = db.get(User, m.created_by)
        if creator:
            creator_name = f"{creator.first_name} {creator.last_name}"
    fee_percent = get_platform_fee_percent(db)
    return MilestoneOut(
        id=m.id,
        project_id=m.project_id,
        created_by=m.created_by,
        created_by_name=creator_name,
        title=m.title,
        description=m.description,
        amount=m.amount,
        due_date=m.due_date,
        status=m.status,
        sort_order=m.sort_order,
        created_at=m.created_at,
        submitted_at=m.submitted_at,
        platform_fee_percent=fee_percent,
        net_to_professional=round(m.amount * (1 - fee_percent / 100), 2),
        rejection_note=m.rejection_note,
        rejected_at=m.rejected_at,
        updates=[_update_out(u) for u in m.updates],
    )


def _require_project_party(project: Project, user: User):
    if user.id not in (project.client_id, project.assigned_professional_id) and user.role != UserRole.admin:
        raise HTTPException(status_code=403, detail="Not authorized for this project")


@router.get("/projects/{project_id}/milestones", response_model=list[MilestoneOut])
def list_milestones(project_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    _require_project_party(project, current_user)
    # Opportunistic auto-release check, see app/services/auto_release.py —
    # no scheduler in this app, so this is the load-bearing trigger point.
    check_project_auto_release(db, project)
    return [_milestone_out(m, db) for m in project.milestones]


@router.post("/projects/{project_id}/milestones", response_model=MilestoneOut, status_code=201)
def create_milestone(
    project_id: str,
    payload: MilestoneCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    # The client owns the plan, but the hired professional can propose
    # milestones too (badged with created_by). The client's funding decision
    # is the approval gate, so money never moves without the client.
    if project.client_id == current_user.id:
        if project.status in (ProjectStatus.completed, ProjectStatus.cancelled):
            raise HTTPException(status_code=400, detail="This project is closed, milestones can't be added")
    elif project.assigned_professional_id == current_user.id:
        if project.status != ProjectStatus.in_progress:
            raise HTTPException(status_code=403, detail="You can propose milestones once the project is active")
    elif current_user.role == UserRole.admin:
        pass
    else:
        raise HTTPException(status_code=403, detail="Not authorized to add milestones to this project")
    if payload.amount <= 0:
        raise HTTPException(status_code=400, detail="Milestone amount must be greater than zero")
    sort_order = len(project.milestones)
    milestone = Milestone(
        project_id=project_id,
        created_by=current_user.id,
        title=payload.title,
        description=payload.description,
        amount=payload.amount,
        due_date=payload.due_date,
        sort_order=sort_order,
    )
    db.add(milestone)
    db.flush()
    post_system_message(
        db, project, current_user.id,
        f"🧾 New milestone \"{payload.title}\" — ₦{payload.amount:,.2f}."
        + (" Fund it to approve and get started." if current_user.id == project.assigned_professional_id else ""),
    )
    db.commit()
    db.refresh(milestone)
    return _milestone_out(milestone, db)


@router.post("/milestones/{milestone_id}/updates", response_model=MilestoneUpdateOut, status_code=201)
def post_milestone_update(
    milestone_id: str,
    payload: MilestoneUpdateIn,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    milestone = db.get(Milestone, milestone_id)
    if not milestone:
        raise HTTPException(status_code=404, detail="Milestone not found")
    _require_project_party(milestone.project, current_user)
    update = MilestoneUpdate(
        milestone_id=milestone_id,
        created_by=current_user.id,
        note=payload.note,
        photo_urls=",".join(payload.photo_urls) if payload.photo_urls else None,
    )
    db.add(update)
    if milestone.status == MilestoneStatus.pending:
        milestone.status = MilestoneStatus.in_progress
    # Mirror into the project's message thread too — Messages is meant to be
    # the running log of everything, not just milestone updates tied to money.
    project = milestone.project
    photo_note = " (with photos)" if payload.photo_urls else ""
    body = f"📝 Update on milestone \"{milestone.title}\": {payload.note}{photo_note}" if payload.note else f"📝 Progress update on milestone \"{milestone.title}\"{photo_note}."
    post_system_message(db, project, current_user.id, body)
    db.commit()
    db.refresh(update)
    return _update_out(update)


@router.post("/milestones/{milestone_id}/submit", response_model=MilestoneOut)
def submit_milestone(milestone_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    milestone = db.get(Milestone, milestone_id)
    if not milestone:
        raise HTTPException(status_code=404, detail="Milestone not found")
    if milestone.project.assigned_professional_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the assigned professional can submit this milestone")
    # Once the client has signed off (approved) or money has actually moved
    # (paid/refunded), submitting again would reopen a closed milestone and,
    # combined with approve/release, could trigger a second payout for the
    # same work. Only allow it while the milestone is still genuinely active.
    if milestone.status in (MilestoneStatus.approved, MilestoneStatus.paid, MilestoneStatus.refunded):
        raise HTTPException(status_code=400, detail="This milestone is already closed out and can't be resubmitted")
    # If the client already funded it (e.g. paid upfront before the
    # professional finished), that's a strictly more-advanced state for
    # approval purposes, don't regress it back down to "submitted" just
    # because the professional also clicked submit, that would erase the
    # funded signal approve_milestone / release rely on.
    if milestone.status != MilestoneStatus.funded:
        milestone.status = MilestoneStatus.submitted
    # Always refresh this regardless of the status branch above — it's the
    # one signal ("work was actually delivered on this date") that the
    # auto-release timer and the client-facing "submitted N days ago" badge
    # rely on, and it needs to be set even when the milestone was already
    # funded (so `status` stays "funded" rather than regressing).
    milestone.submitted_at = datetime.utcnow()
    milestone.auto_release_reminder_sent = False
    post_system_message(
        db, milestone.project, current_user.id,
        f"📤 Milestone \"{milestone.title}\" submitted for approval.",
    )
    db.commit()
    db.refresh(milestone)
    return _milestone_out(milestone, db)


@router.post("/milestones/{milestone_id}/approve", response_model=MilestoneOut)
def approve_milestone(milestone_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    milestone = db.get(Milestone, milestone_id)
    if not milestone:
        raise HTTPException(status_code=404, detail="Milestone not found")
    if milestone.project.client_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the client can approve this milestone")
    # Must actually be funded first. Approving a merely-"submitted" (never
    # funded) milestone used to be allowed here, and release_milestone_payout
    # (app/api/v1/wallet.py) accepts "approved" as release-eligible, so that
    # gap let a milestone be paid out to the professional without the client's
    # wallet ever having been debited, effectively fabricating a payout. Real
    # money bug, keep this strict.
    if milestone.status != MilestoneStatus.funded:
        raise HTTPException(status_code=400, detail="Milestone must be funded before it can be approved")
    milestone.status = MilestoneStatus.approved
    post_system_message(db, milestone.project, current_user.id, f"✅ Milestone \"{milestone.title}\" approved — ready to release payment.")
    db.commit()
    db.refresh(milestone)
    return _milestone_out(milestone, db)


@router.post("/milestones/{milestone_id}/reject", response_model=MilestoneOut)
def reject_milestone(
    milestone_id: str,
    payload: MilestoneRejectIn,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Client declines a milestone before any money has moved on it — e.g. a
    milestone the professional proposed (directly, or via an approved change
    order) that the client doesn't agree with. Once a milestone is funded,
    real money is on the line, and refunds/disputes are the correct path
    instead (this deliberately does not touch funded/approved/paid/refunded
    milestones)."""
    milestone = db.get(Milestone, milestone_id)
    if not milestone:
        raise HTTPException(status_code=404, detail="Milestone not found")
    if milestone.project.client_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the client can reject this milestone")
    if milestone.status not in (MilestoneStatus.pending, MilestoneStatus.in_progress, MilestoneStatus.submitted):
        raise HTTPException(
            status_code=400,
            detail="This milestone has already been funded or closed out — it can no longer be rejected outright. Use a dispute or refund instead.",
        )
    if not payload.note or not payload.note.strip():
        raise HTTPException(status_code=400, detail="A note explaining the rejection is required")
    milestone.status = MilestoneStatus.rejected
    milestone.rejection_note = payload.note.strip()
    milestone.rejected_at = datetime.utcnow()
    post_system_message(db, milestone.project, current_user.id, f"❌ Milestone \"{milestone.title}\" rejected: {payload.note.strip()}")
    db.commit()
    db.refresh(milestone)
    return _milestone_out(milestone, db)


@router.post("/projects/{project_id}/change-orders", response_model=ChangeOrderOut, status_code=201)
def create_change_order(
    project_id: str,
    payload: ChangeOrderCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    _require_project_party(project, current_user)
    if project.status in (ProjectStatus.completed, ProjectStatus.cancelled):
        raise HTTPException(status_code=400, detail="This project is closed, change orders can't be proposed on it anymore")
    co = ChangeOrder(project_id=project_id, proposed_by=current_user.id, description=payload.description, amount_delta=payload.amount_delta)
    db.add(co)
    db.flush()
    delta_note = f" (+₦{payload.amount_delta:,.2f})" if payload.amount_delta > 0 else (f" (-₦{abs(payload.amount_delta):,.2f})" if payload.amount_delta < 0 else "")
    post_system_message(db, project, current_user.id, f"📋 Change order proposed: {payload.description}{delta_note}")
    db.commit()
    db.refresh(co)
    return co


@router.get("/projects/{project_id}/change-orders", response_model=list[ChangeOrderOut])
def list_change_orders(project_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    _require_project_party(project, current_user)
    return project.change_orders


@router.patch("/change-orders/{change_order_id}", response_model=ChangeOrderOut)
def update_change_order(
    change_order_id: str,
    status: ChangeOrderStatus,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    co = db.get(ChangeOrder, change_order_id)
    if not co:
        raise HTTPException(status_code=404, detail="Change order not found")
    # Whoever *didn't* propose it has to be the one who approves/rejects —
    # not always the client. A change order the client proposed (e.g. a
    # scope cut) still needs the professional's sign-off before it takes
    # effect, otherwise a client could unilaterally shrink the agreed price
    # without the professional ever agreeing to the new terms.
    approver_id = (
        co.project.assigned_professional_id if co.proposed_by == co.project.client_id else co.project.client_id
    )
    if current_user.id != approver_id and current_user.role != UserRole.admin:
        raise HTTPException(status_code=403, detail="Only the other party to this change order can approve or reject it")
    if co.status != ChangeOrderStatus.proposed:
        raise HTTPException(status_code=400, detail=f"This change order is already {co.status.value}")
    if co.project.status in (ProjectStatus.completed, ProjectStatus.cancelled):
        raise HTTPException(status_code=400, detail="This project is closed, change orders can no longer be acted on")
    co.status = status
    project = co.project

    # Approving extra paid work creates the milestone for it immediately —
    # written scope and cost move together, the way construction change
    # orders are supposed to work, instead of leaving the client and
    # professional to separately remember to add a milestone for it later
    # (or, worse, the professional starting work on an "approved" change
    # order that was never actually backed by fundable money).
    if status == ChangeOrderStatus.approved and co.amount_delta > 0:
        milestone = Milestone(
            project_id=project.id,
            created_by=current_user.id,
            title=f"Change order: {co.description[:80]}",
            description=co.description,
            amount=co.amount_delta,
            sort_order=len(project.milestones),
        )
        db.add(milestone)
        db.flush()
        co.resulting_milestone_id = milestone.id

    if status == ChangeOrderStatus.approved:
        body = (
            f"✅ Change order approved: {co.description[:100]} — ₦{co.amount_delta:,.2f} milestone created, fund it to get started."
            if co.resulting_milestone_id
            else f"✅ Change order approved: {co.description[:100]} (no additional cost)."
        )
    else:
        body = f"❌ Change order rejected: {co.description[:100]}"
    post_system_message(db, project, current_user.id, body)

    db.commit()
    db.refresh(co)
    return co
