from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.change_order import ChangeOrder, ChangeOrderStatus
from app.models.milestone import Milestone, MilestoneStatus
from app.models.milestone_update import MilestoneUpdate
from app.models.project import Project
from app.models.user import User, UserRole
from app.schemas.milestone import (
    ChangeOrderCreate,
    ChangeOrderOut,
    MilestoneCreate,
    MilestoneOut,
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


def _milestone_out(m: Milestone) -> MilestoneOut:
    return MilestoneOut(
        id=m.id,
        project_id=m.project_id,
        title=m.title,
        description=m.description,
        amount=m.amount,
        due_date=m.due_date,
        status=m.status,
        sort_order=m.sort_order,
        created_at=m.created_at,
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
    return [_milestone_out(m) for m in project.milestones]


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
    if project.client_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the client can define milestones")
    sort_order = len(project.milestones)
    milestone = Milestone(
        project_id=project_id,
        title=payload.title,
        description=payload.description,
        amount=payload.amount,
        due_date=payload.due_date,
        sort_order=sort_order,
    )
    db.add(milestone)
    db.commit()
    db.refresh(milestone)
    return _milestone_out(milestone)


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
    milestone.status = MilestoneStatus.submitted
    db.commit()
    db.refresh(milestone)
    return _milestone_out(milestone)


@router.post("/milestones/{milestone_id}/approve", response_model=MilestoneOut)
def approve_milestone(milestone_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    milestone = db.get(Milestone, milestone_id)
    if not milestone:
        raise HTTPException(status_code=404, detail="Milestone not found")
    if milestone.project.client_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the client can approve this milestone")
    if milestone.status != MilestoneStatus.funded and milestone.status != MilestoneStatus.submitted:
        raise HTTPException(status_code=400, detail="Milestone must be submitted (and ideally funded) before approval")
    milestone.status = MilestoneStatus.approved
    db.commit()
    db.refresh(milestone)
    return _milestone_out(milestone)


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
    co = ChangeOrder(project_id=project_id, proposed_by=current_user.id, description=payload.description, amount_delta=payload.amount_delta)
    db.add(co)
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
    if co.project.client_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the client can approve/reject change orders")
    co.status = status
    db.commit()
    db.refresh(co)
    return co
