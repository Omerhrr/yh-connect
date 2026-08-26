from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_role
from app.db.session import get_db
from app.models.project import Project
from app.models.project_access_request import (
    AccessRequestStatus,
    AccessRequestType,
    ProjectAccessRequest,
)
from app.models.user import User, UserRole
from app.models.notification import NotificationType
from app.schemas.project_access_request import (
    AccessRequestCreate,
    AccessRequestOut,
    AccessRequestRespond,
)
from app.services.notify import notify

router = APIRouter(tags=["project-access-requests"])


def _to_out(req: ProjectAccessRequest) -> AccessRequestOut:
    out = AccessRequestOut.model_validate(req)
    out.project_title = req.project.title if req.project else None
    out.professional_name = f"{req.professional.first_name} {req.professional.last_name}" if req.professional else None
    out.client_name = f"{req.client.first_name} {req.client.last_name}" if req.client else None
    return out


@router.post("/projects/{project_id}/access-requests", response_model=AccessRequestOut, status_code=201)
def create_access_request(
    project_id: str,
    payload: AccessRequestCreate,
    current_user: User = Depends(require_role(UserRole.professional)),
    db: Session = Depends(get_db),
):
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    existing = (
        db.query(ProjectAccessRequest)
        .filter(
            ProjectAccessRequest.project_id == project_id,
            ProjectAccessRequest.professional_id == current_user.id,
            ProjectAccessRequest.request_type == payload.request_type,
            ProjectAccessRequest.status == AccessRequestStatus.pending,
        )
        .first()
    )
    if existing:
        raise HTTPException(status_code=409, detail="You already have a pending request of this type on this project")

    req = ProjectAccessRequest(
        project_id=project_id,
        professional_id=current_user.id,
        client_id=project.client_id,
        request_type=payload.request_type,
        note=payload.note,
    )
    db.add(req)
    db.flush()

    kind = "an inspection visit" if payload.request_type == AccessRequestType.inspection else "a chat"
    notify(
        db, project.client_id, NotificationType.general,
        f"{current_user.first_name} {current_user.last_name} requested {kind} on \"{project.title}\"",
        body=payload.note or None,
        link=f"/client/dashboard/projects/{project.id}",
        email_also=True,
    )
    db.commit()
    db.refresh(req)
    return _to_out(req)


@router.get("/projects/{project_id}/access-requests", response_model=list[AccessRequestOut])
def list_project_access_requests(
    project_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if project.client_id != current_user.id and current_user.role != UserRole.admin:
        raise HTTPException(status_code=403, detail="Not authorized to view these requests")
    reqs = (
        db.query(ProjectAccessRequest)
        .filter(ProjectAccessRequest.project_id == project_id)
        .order_by(ProjectAccessRequest.created_at.desc())
        .all()
    )
    return [_to_out(r) for r in reqs]


@router.get("/access-requests/mine", response_model=list[AccessRequestOut])
def my_access_requests(
    current_user: User = Depends(require_role(UserRole.professional)), db: Session = Depends(get_db)
):
    reqs = (
        db.query(ProjectAccessRequest)
        .filter(ProjectAccessRequest.professional_id == current_user.id)
        .order_by(ProjectAccessRequest.created_at.desc())
        .all()
    )
    return [_to_out(r) for r in reqs]


@router.patch("/access-requests/{request_id}", response_model=AccessRequestOut)
def respond_to_access_request(
    request_id: str,
    payload: AccessRequestRespond,
    current_user: User = Depends(require_role(UserRole.client)),
    db: Session = Depends(get_db),
):
    req = db.get(ProjectAccessRequest, request_id)
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
    if req.client_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to respond to this request")
    if req.status != AccessRequestStatus.pending:
        raise HTTPException(status_code=400, detail="This request has already been responded to")
    if payload.status not in (AccessRequestStatus.approved, AccessRequestStatus.rejected):
        raise HTTPException(status_code=400, detail="Status must be 'approved' or 'rejected'")

    if payload.status == AccessRequestStatus.approved and req.request_type == AccessRequestType.inspection:
        if not payload.address or not payload.address.strip():
            raise HTTPException(status_code=400, detail="Please provide the visit address to approve an inspection")
        req.address = payload.address.strip()
        req.phone = (payload.phone or "").strip() or None
        req.details = (payload.details or "").strip() or None

    req.status = payload.status
    req.responded_at = datetime.utcnow()

    kind = "inspection visit" if req.request_type == AccessRequestType.inspection else "chat"
    if payload.status == AccessRequestStatus.approved:
        notify(
            db, req.professional_id, NotificationType.general,
            f"Your {kind} request on \"{req.project.title}\" was approved",
            body="You can now open the chat for this project." + (
                " The client shared the visit address there." if req.request_type == AccessRequestType.inspection else ""
            ),
            link=f"/talent/dashboard/find-work/{req.project_id}",
            email_also=True,
        )
    else:
        notify(
            db, req.professional_id, NotificationType.general,
            f"Your {kind} request on \"{req.project.title}\" was declined",
            link=f"/talent/dashboard/find-work/{req.project_id}",
            email_also=True,
        )

    db.commit()
    db.refresh(req)
    return _to_out(req)
