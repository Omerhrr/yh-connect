"""Consultant / middleman (stakeholder feedback F11).

A client can tick "needs a consultant" on a project. Getting the consultant is
its own process, separate from bidding on the work: professionals apply to
consult, the client appoints one, and the appointed consultant supervises the
project and gives the client recommendations on the bids."""

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.bid import Bid
from app.models.consultant import ConsultantApplication, ConsultantNote
from app.models.notification import NotificationType
from app.models.project import Project, ProjectStatus
from app.models.user import User, UserRole
from app.services.notify import notify

router = APIRouter(tags=["consultants"])

VERDICTS = {"recommend", "not_recommend", "neutral"}


class ApplyIn(BaseModel):
    note: str | None = None
    proposed_fee: float | None = None


class NoteIn(BaseModel):
    body: str
    bid_id: str | None = None
    verdict: str = "neutral"


class ApplicationOut(BaseModel):
    id: str
    professional_id: str
    professional_name: str
    note: str | None = None
    proposed_fee: float | None = None
    status: str
    created_at: datetime


class NoteOut(BaseModel):
    id: str
    bid_id: str | None = None
    verdict: str
    body: str
    consultant_name: str
    created_at: datetime


class ConsultantBidOut(BaseModel):
    id: str
    professional_id: str
    professional_name: str
    amount: float
    estimated_days: int | None = None
    cover_letter: str | None = None
    status: str


class ConsultantStateOut(BaseModel):
    needs_consultant: bool
    consultant_id: str | None = None
    consultant_name: str | None = None
    role: str  # client | consultant | applicant | other
    my_application: ApplicationOut | None = None
    applications: list[ApplicationOut] = []
    notes: list[NoteOut] = []
    bids: list[ConsultantBidOut] = []


class ConsultantProjectOut(BaseModel):
    id: str
    title: str
    location: str | None = None
    budget_min: float
    budget_max: float
    status: str
    created_at: datetime
    already_applied: bool = False


def _name(u: User | None) -> str:
    return f"{u.first_name} {u.last_name}".strip() if u else "Unknown"


def _project(db: Session, project_id: str) -> Project:
    p = db.get(Project, project_id)
    if not p:
        raise HTTPException(status_code=404, detail="Project not found")
    return p


def _app_out(db: Session, a: ConsultantApplication) -> ApplicationOut:
    return ApplicationOut(
        id=a.id, professional_id=a.professional_id, professional_name=_name(db.get(User, a.professional_id)),
        note=a.note, proposed_fee=a.proposed_fee, status=a.status, created_at=a.created_at,
    )


def _client_link(pid: str) -> str:
    return f"/client/dashboard/projects/{pid}"


def _talent_link(pid: str) -> str:
    return f"/talent/dashboard/find-work/{pid}"


@router.get("/consultant/open-projects", response_model=list[ConsultantProjectOut])
def open_consultant_projects(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if current_user.role != UserRole.professional:
        raise HTTPException(status_code=403, detail="Professionals only")
    projects = (
        db.query(Project)
        .filter(Project.needs_consultant.is_(True), Project.consultant_id.is_(None), Project.status == ProjectStatus.open,
                Project.client_id != current_user.id)
        .order_by(Project.created_at.desc())
        .limit(100)
        .all()
    )
    applied = {
        a.project_id for a in db.query(ConsultantApplication).filter(
            ConsultantApplication.professional_id == current_user.id, ConsultantApplication.status == "pending")
    }
    return [
        ConsultantProjectOut(
            id=p.id, title=p.title, location=p.location, budget_min=p.budget_min, budget_max=p.budget_max,
            status=p.status.value, created_at=p.created_at, already_applied=p.id in applied,
        )
        for p in projects
    ]


@router.get("/consultant/mine", response_model=list[ConsultantProjectOut])
def my_consulting_projects(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    projects = db.query(Project).filter(Project.consultant_id == current_user.id).order_by(Project.created_at.desc()).all()
    return [
        ConsultantProjectOut(
            id=p.id, title=p.title, location=p.location, budget_min=p.budget_min, budget_max=p.budget_max,
            status=p.status.value, created_at=p.created_at,
        )
        for p in projects
    ]


@router.get("/projects/{project_id}/consultant", response_model=ConsultantStateOut)
def consultant_state(project_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    p = _project(db, project_id)
    is_client = current_user.id == p.client_id
    is_consultant = bool(p.consultant_id) and current_user.id == p.consultant_id
    is_admin = current_user.role == UserRole.admin
    mine = (
        db.query(ConsultantApplication)
        .filter(ConsultantApplication.project_id == p.id, ConsultantApplication.professional_id == current_user.id)
        .order_by(ConsultantApplication.created_at.desc())
        .first()
    )
    role = "client" if is_client else "consultant" if is_consultant else "applicant" if mine else "other"
    out = ConsultantStateOut(
        needs_consultant=bool(p.needs_consultant),
        consultant_id=p.consultant_id,
        consultant_name=_name(db.get(User, p.consultant_id)) if p.consultant_id else None,
        role=role,
        my_application=_app_out(db, mine) if mine else None,
    )
    if is_client or is_admin:
        apps = db.query(ConsultantApplication).filter(ConsultantApplication.project_id == p.id).order_by(
            ConsultantApplication.created_at.desc()).all()
        out.applications = [_app_out(db, a) for a in apps]
    if is_client or is_consultant or is_admin:
        notes = db.query(ConsultantNote).filter(ConsultantNote.project_id == p.id).order_by(ConsultantNote.created_at.desc()).all()
        out.notes = [
            NoteOut(id=n.id, bid_id=n.bid_id, verdict=n.verdict, body=n.body,
                    consultant_name=_name(db.get(User, n.consultant_id)), created_at=n.created_at)
            for n in notes
        ]
    if is_consultant or is_admin:
        bids = db.query(Bid).filter(Bid.project_id == p.id).order_by(Bid.created_at.desc()).all()
        out.bids = [
            ConsultantBidOut(id=b.id, professional_id=b.professional_id, professional_name=_name(db.get(User, b.professional_id)),
                             amount=b.amount, estimated_days=b.estimated_days, cover_letter=b.cover_letter, status=b.status.value)
            for b in bids
        ]
    return out


@router.post("/projects/{project_id}/consultant/apply", response_model=ApplicationOut, status_code=201)
def apply_as_consultant(project_id: str, payload: ApplyIn, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    p = _project(db, project_id)
    if current_user.role != UserRole.professional:
        raise HTTPException(status_code=403, detail="Only professionals can apply to consult")
    if current_user.id == p.client_id:
        raise HTTPException(status_code=400, detail="You can't consult on your own project")
    if not p.needs_consultant:
        raise HTTPException(status_code=400, detail="This project isn't looking for a consultant")
    if p.consultant_id:
        raise HTTPException(status_code=400, detail="A consultant has already been appointed")
    if p.assigned_professional_id == current_user.id:
        raise HTTPException(status_code=400, detail="The hired professional can't also be the consultant")
    if payload.proposed_fee is not None and payload.proposed_fee < 0:
        raise HTTPException(status_code=400, detail="Fee can't be negative")
    existing = db.query(ConsultantApplication).filter(
        ConsultantApplication.project_id == p.id, ConsultantApplication.professional_id == current_user.id,
        ConsultantApplication.status == "pending").first()
    if existing:
        raise HTTPException(status_code=400, detail="You've already applied")
    a = ConsultantApplication(project_id=p.id, professional_id=current_user.id,
                              note=(payload.note or "").strip() or None, proposed_fee=payload.proposed_fee)
    db.add(a)
    notify(db, p.client_id, NotificationType.general, "New consultant application",
           f"{_name(current_user)} applied to consult on \"{p.title}\".", _client_link(p.id))
    db.commit()
    db.refresh(a)
    return _app_out(db, a)


@router.post("/projects/{project_id}/consultant/withdraw", status_code=204)
def withdraw_application(project_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    a = db.query(ConsultantApplication).filter(
        ConsultantApplication.project_id == project_id, ConsultantApplication.professional_id == current_user.id,
        ConsultantApplication.status == "pending").first()
    if not a:
        raise HTTPException(status_code=404, detail="No pending application")
    a.status = "withdrawn"
    db.commit()


@router.post("/projects/{project_id}/consultant/applications/{application_id}/appoint", response_model=ConsultantStateOut)
def appoint_consultant(project_id: str, application_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    p = _project(db, project_id)
    if current_user.id != p.client_id:
        raise HTTPException(status_code=403, detail="Only the client can appoint a consultant")
    if p.consultant_id:
        raise HTTPException(status_code=400, detail="A consultant is already appointed")
    a = db.get(ConsultantApplication, application_id)
    if not a or a.project_id != p.id or a.status != "pending":
        raise HTTPException(status_code=404, detail="Application not found")
    a.status = "appointed"
    p.consultant_id = a.professional_id
    others = db.query(ConsultantApplication).filter(
        ConsultantApplication.project_id == p.id, ConsultantApplication.id != a.id, ConsultantApplication.status == "pending").all()
    for o in others:
        o.status = "declined"
        notify(db, o.professional_id, NotificationType.general, "Consultant application declined",
               f"The client chose another consultant for \"{p.title}\".", _talent_link(p.id))
    notify(db, a.professional_id, NotificationType.general, "You're the consultant",
           f"You were appointed consultant on \"{p.title}\".", _talent_link(p.id), email_also=True)
    db.commit()
    return consultant_state(project_id, current_user, db)


@router.post("/projects/{project_id}/consultant/remove", response_model=ConsultantStateOut)
def remove_consultant(project_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    p = _project(db, project_id)
    if current_user.id != p.client_id:
        raise HTTPException(status_code=403, detail="Only the client can remove the consultant")
    if not p.consultant_id:
        raise HTTPException(status_code=400, detail="No consultant appointed")
    old = p.consultant_id
    p.consultant_id = None
    notify(db, old, NotificationType.general, "Consultant role ended",
           f"You're no longer the consultant on \"{p.title}\".", _talent_link(p.id))
    db.commit()
    return consultant_state(project_id, current_user, db)


@router.post("/projects/{project_id}/consultant/notes", response_model=NoteOut, status_code=201)
def add_consultant_note(project_id: str, payload: NoteIn, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    p = _project(db, project_id)
    if not p.consultant_id or current_user.id != p.consultant_id:
        raise HTTPException(status_code=403, detail="Only the appointed consultant can post notes")
    if not payload.body.strip():
        raise HTTPException(status_code=400, detail="Note can't be empty")
    if payload.verdict not in VERDICTS:
        raise HTTPException(status_code=400, detail="Invalid verdict")
    if payload.bid_id:
        bid = db.get(Bid, payload.bid_id)
        if not bid or bid.project_id != p.id:
            raise HTTPException(status_code=400, detail="Bid doesn't belong to this project")
    n = ConsultantNote(project_id=p.id, consultant_id=current_user.id, bid_id=payload.bid_id,
                       verdict=payload.verdict, body=payload.body.strip())
    db.add(n)
    notify(db, p.client_id, NotificationType.general, "Consultant note",
           payload.body.strip()[:140], _client_link(p.id))
    db.commit()
    db.refresh(n)
    return NoteOut(id=n.id, bid_id=n.bid_id, verdict=n.verdict, body=n.body,
                   consultant_name=_name(current_user), created_at=n.created_at)
