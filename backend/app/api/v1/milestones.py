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
from app.services.platform_settings import (
    get_platform_fee_percent,
    get_payment_withholding_percent,
    get_payment_withholding_release_days,
)
from app.services.auto_release import check_project_auto_release, release_due_withholds
from app.services.disputes import has_blocking_dispute
from app.services.escrow import disburse_milestone, refund_milestone, EscrowActionError
from app.services.project_log import post_system_message
from app.models.wallet import WalletTransaction, WalletTransactionType, WalletTransactionStatus
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
    withholding_percent = get_payment_withholding_percent(db)
    withholding_release_days = get_payment_withholding_release_days(db)
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
        withholding_percent=withholding_percent,
        withholding_release_days=withholding_release_days,
        withheld_amount=m.withheld_amount,
        withheld_release_at=m.withheld_release_at,
        withheld_released_at=m.withheld_released_at,
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

    check_project_auto_release(db, project)
    if project.assigned_professional_id:
        release_due_withholds(db, project.assigned_professional_id)
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

    if project.client_id == current_user.id:
        if project.status in (ProjectStatus.completed, ProjectStatus.cancelled):
            raise HTTPException(status_code=400, detail="This project is closed, milestones can't be added")
    elif current_user.role == UserRole.admin:
        pass
    else:
        raise HTTPException(status_code=403, detail="Only the client can add milestones to this project")
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
        f"🧾 New milestone \"{payload.title}\" — ₦{payload.amount:,.2f}. Fund it so the professional can start work on it.",
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

    if milestone.status not in (MilestoneStatus.funded, MilestoneStatus.submitted):
        raise HTTPException(status_code=400, detail="This milestone must be funded before work can begin")
    update = MilestoneUpdate(
        milestone_id=milestone_id,
        created_by=current_user.id,
        note=payload.note,
        photo_urls=",".join(payload.photo_urls) if payload.photo_urls else None,
    )
    db.add(update)

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

    if milestone.status in (MilestoneStatus.approved, MilestoneStatus.paid, MilestoneStatus.refunded):
        raise HTTPException(status_code=400, detail="This milestone is already closed out and can't be resubmitted")

    if milestone.status not in (MilestoneStatus.funded, MilestoneStatus.submitted):
        raise HTTPException(status_code=400, detail="This milestone must be funded before it can be submitted")

    milestone.status = MilestoneStatus.funded

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
    """Client approves the delivered work on a funded milestone. Approval and
    payout are now the same action — funds move to the professional's wallet
    instantly, there's no separate 'release payment' step anymore."""
    milestone = db.get(Milestone, milestone_id)
    if not milestone:
        raise HTTPException(status_code=404, detail="Milestone not found")
    project = milestone.project
    if project.client_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the client can approve this milestone")

    if milestone.status != MilestoneStatus.funded:
        raise HTTPException(status_code=400, detail="Milestone must be funded before it can be approved")
    if not project.assigned_professional_id:
        raise HTTPException(status_code=400, detail="No professional assigned to this project")
    if has_blocking_dispute(db, project.id, milestone.id):
        raise HTTPException(status_code=400, detail="This milestone is under dispute and its funds are on hold until it's resolved")

    funded_tx = (
        db.query(WalletTransaction)
        .filter(
            WalletTransaction.milestone_id == milestone.id,
            WalletTransaction.type == WalletTransactionType.funding,
            WalletTransaction.status == WalletTransactionStatus.successful,
        )
        .first()
    )
    if not funded_tx:
        raise HTTPException(status_code=400, detail="No escrow funding found for this milestone, it can't be approved")

    try:
        tx = disburse_milestone(db, milestone, project, current_user.id, note=f"Payout for milestone '{milestone.title}'")
    except EscrowActionError as e:
        raise HTTPException(status_code=400, detail=str(e))
    post_system_message(db, project, current_user.id, f"✅ Milestone \"{milestone.title}\" approved — ₦{tx.amount:,.2f} released instantly.")
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
    """Client declines a milestone's delivered work, always with a reason the
    professional gets to see. If nothing was ever funded on it, this is just
    a status flip; if it was funded (the normal case now that work only
    starts once escrow holds the money), the escrowed amount is refunded
    back to the client's wallet instead of being paid out. Already-closed
    milestones (approved/paid/refunded) are untouched — use a dispute for
    those, real payouts already happened."""
    milestone = db.get(Milestone, milestone_id)
    if not milestone:
        raise HTTPException(status_code=404, detail="Milestone not found")
    project = milestone.project
    if project.client_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the client can reject this milestone")
    if milestone.status not in (MilestoneStatus.pending, MilestoneStatus.in_progress, MilestoneStatus.submitted, MilestoneStatus.funded):
        raise HTTPException(
            status_code=400,
            detail="This milestone has already been approved or closed out — it can no longer be rejected outright. Use a dispute instead.",
        )
    if not payload.note or not payload.note.strip():
        raise HTTPException(status_code=400, detail="A note explaining the rejection is required")
    note = payload.note.strip()

    was_funded = milestone.status == MilestoneStatus.funded
    if was_funded:
        if has_blocking_dispute(db, project.id, milestone.id):
            raise HTTPException(status_code=400, detail="This milestone is under dispute and its funds are on hold until it's resolved")
        try:
            refund_milestone(db, milestone, project, current_user.id, note=f"Rejected: {note}")
        except EscrowActionError as e:
            raise HTTPException(status_code=400, detail=str(e))

    else:
        milestone.status = MilestoneStatus.rejected

    milestone.rejection_note = note
    milestone.rejected_at = datetime.utcnow()
    post_system_message(
        db, project, current_user.id,
        f"❌ Milestone \"{milestone.title}\" rejected: {note}" + (" Escrowed funds were refunded to the client." if was_funded else ""),
    )
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
