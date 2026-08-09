from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_role
from app.db.session import get_db
from app.models.project import Project, ProjectStatus
from app.models.user import User, UserRole, KycStatus
from app.models.project_report import ProjectReport
from app.schemas.project import ProjectCreate, ProjectOut, ProjectUpdate, ProjectReportCreate, ProjectReportOut
from app.services.nlp_search import extract_keywords, match_categories

router = APIRouter(prefix="/projects", tags=["projects"])


def _to_out(project: Project, db: Session) -> ProjectOut:
    client = project.client
    completed_count = 0
    open_count = 0
    total_count = 0
    hire_rate = None
    if client:
        completed_count = (
            db.query(Project)
            .filter(Project.client_id == client.id, Project.status == ProjectStatus.completed)
            .count()
        )
        open_count = (
            db.query(Project)
            .filter(Project.client_id == client.id, Project.status == ProjectStatus.open)
            .count()
        )
        total_count = db.query(Project).filter(Project.client_id == client.id).count()
        hired_count = (
            db.query(Project)
            .filter(
                Project.client_id == client.id,
                Project.status.in_([ProjectStatus.in_progress, ProjectStatus.review, ProjectStatus.completed]),
            )
            .count()
        )
        if total_count > 0:
            hire_rate = round((hired_count / total_count) * 100)
    return ProjectOut(
        id=project.id,
        client_id=project.client_id,
        title=project.title,
        description=project.description,
        category=project.category,
        location=project.location,
        budget_min=project.budget_min,
        budget_max=project.budget_max,
        budget_type=project.budget_type,
        skills=project.skills_list,
        status=project.status,
        progress=project.computed_progress,
        assigned_professional_id=project.assigned_professional_id,
        created_at=project.created_at,
        bid_count=len(project.bids),
        client_company_name=client.company_name if client else None,
        client_is_verified_business=bool(client.is_verified_business) if client else False,
        client_completed_project_count=completed_count,
        client_kyc_verified=bool(client and client.kyc_status == KycStatus.verified),
        client_email_verified=bool(client and client.email_verified_at is not None),
        client_member_since=client.created_at if client else None,
        client_open_project_count=open_count,
        client_hire_rate=hire_rate,
    )


@router.get("", response_model=list[ProjectOut])
def list_projects(
    category_id: Optional[str] = None,
    status_filter: Optional[ProjectStatus] = None,
    q: Optional[str] = None,
    location: Optional[str] = None,
    budget_min: Optional[float] = None,
    budget_max: Optional[float] = None,
    sort_by: Optional[str] = None,  # newest | budget_asc | budget_desc | most_bids
    limit: int = 20,
    offset: int = 0,
    db: Session = Depends(get_db),
):
    limit = max(1, min(limit, 100))
    offset = max(0, offset)

    query = db.query(Project)
    if category_id:
        query = query.filter(Project.category_id == category_id)
    if status_filter:
        query = query.filter(Project.status == status_filter)
    else:
        query = query.filter(Project.status == ProjectStatus.open)
    if location:
        query = query.filter(Project.location.ilike(f"%{location}%"))
    if budget_min is not None:
        query = query.filter(Project.budget_max >= budget_min)
    if budget_max is not None:
        query = query.filter(Project.budget_min <= budget_max)
    query = query.order_by(Project.created_at.desc())

    if q:
        # Free-text search runs in Python (SQLite has no case-insensitive
        # full-text index here), so filtering/sorting happens after.
        # Natural-language queries ("I want tiling jobs near me") are
        # understood via a keyword/synonym match against the category
        # taxonomy first; if nothing matches, we fall back to plain keyword
        # substring matching on title/description/skills.
        matched_categories = match_categories(q)
        all_projects = query.all()
        if matched_categories:
            cat_rank = {c: i for i, c in enumerate(matched_categories)}
            projects = [p for p in all_projects if p.category_id in cat_rank]
            if not projects:
                projects = all_projects
            else:
                projects.sort(key=lambda p: (cat_rank.get(p.category_id, 999), -p.created_at.timestamp()))
        else:
            keywords = extract_keywords(q) or [q.lower()]
            projects = [
                p for p in all_projects
                if any(
                    kw in p.title.lower()
                    or kw in p.description.lower()
                    or kw in (p.skills or "").lower()
                    for kw in keywords
                )
            ]
    else:
        projects = query.all()

    sort_map = {
        "newest": lambda p: p.created_at,
        "budget_asc": lambda p: p.budget_min,
        "budget_desc": lambda p: -p.budget_max,
        "most_bids": lambda p: -len(p.bids),
    }
    if sort_by in sort_map:
        projects = sorted(projects, key=sort_map[sort_by], reverse=(sort_by == "newest"))

    projects = projects[offset : offset + limit]
    return [_to_out(p, db) for p in projects]


@router.post("", response_model=ProjectOut, status_code=201)
def create_project(
    payload: ProjectCreate,
    current_user: User = Depends(require_role(UserRole.client)),
    db: Session = Depends(get_db),
):
    project = Project(
        client_id=current_user.id,
        category_id=payload.category_id,
        title=payload.title,
        description=payload.description,
        location=payload.location,
        budget_min=payload.budget_min,
        budget_max=payload.budget_max,
        budget_type=payload.budget_type,
        skills=",".join(payload.skills) if payload.skills else None,
    )
    db.add(project)
    db.commit()
    db.refresh(project)
    return _to_out(project, db)


@router.get("/mine", response_model=list[ProjectOut])
def my_projects(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if current_user.role == UserRole.client:
        projects = db.query(Project).filter(Project.client_id == current_user.id).order_by(Project.created_at.desc()).all()
    else:
        projects = (
            db.query(Project)
            .filter(Project.assigned_professional_id == current_user.id)
            .order_by(Project.created_at.desc())
            .all()
        )
    return [_to_out(p, db) for p in projects]


@router.get("/{project_id}", response_model=ProjectOut)
def get_project(project_id: str, db: Session = Depends(get_db)):
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return _to_out(project, db)


@router.post("/{project_id}/report", response_model=ProjectReportOut, status_code=201)
def report_project(
    project_id: str,
    payload: ProjectReportCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    report = ProjectReport(
        project_id=project_id,
        reporter_id=current_user.id,
        reason=payload.reason,
        details=payload.details,
    )
    db.add(report)
    db.commit()
    db.refresh(report)
    return report


@router.patch("/{project_id}", response_model=ProjectOut)
def update_project(
    project_id: str,
    payload: ProjectUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if project.client_id != current_user.id and current_user.role != UserRole.admin:
        raise HTTPException(status_code=403, detail="Not authorized to modify this project")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(project, field, value)
    db.commit()
    db.refresh(project)
    return _to_out(project, db)
