from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_role
from app.core.config import settings
from app.db.session import get_db
from app.models.bid import Bid, BidStatus
from app.models.category import Category
from app.models.change_order import ChangeOrder, ChangeOrderStatus
from app.models.milestone import Milestone, MilestoneStatus
from app.models.profile import ProfessionalProfile
from app.models.project import BudgetType, Project, ProjectStatus
from app.models.user import User, UserRole, KycStatus
from app.models.wallet import WalletTransaction, WalletTransactionStatus, WalletTransactionType
from app.models.project_report import ProjectReport
from app.models.notification import NotificationType
from app.schemas.project import ClosingNoteIn, ProjectCreate, ProjectOut, ProjectUpdate, ProjectReportCreate, ProjectReportOut
from app.schemas.project_media import ProjectMediaSettingsOut
from app.services.disputes import has_any_blocking_dispute, has_blocking_dispute
from app.services.nlp_search import extract_keywords, match_categories
from app.services.notify import notify
from app.services.platform_settings import get_project_media_settings

router = APIRouter(prefix="/projects", tags=["projects"])


@router.get("/media-settings", response_model=ProjectMediaSettingsOut)
def project_media_settings(db: Session = Depends(get_db)):
    """Public (no auth) so the 'post a project' form knows whether to show
    image/video upload fields and what size caps to enforce client-side,
    before the client is necessarily logged in as... well, they always are
    to post, but this stays cheap to call from anywhere without a token."""
    return ProjectMediaSettingsOut(**get_project_media_settings(db))


MAX_PROJECT_IMAGES = 8


def _gate_media(db: Session, image_urls: list[str] | None, video_url: str | None) -> tuple[list[str], str | None]:
    """Silently drops media the admin has disabled/exceeds limits, rather
    than erroring — a client's post shouldn't fail outright just because
    e.g. video got turned off between when they opened the form and when
    they submitted."""
    media = get_project_media_settings(db)
    images = list(image_urls or [])
    if not media["images_enabled"]:
        images = []
    images = images[:MAX_PROJECT_IMAGES]
    video = video_url if media["video_enabled"] else None
    return images, video


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
    payment_verified = bool(client) and (
        db.query(WalletTransaction)
        .filter(
            WalletTransaction.client_id == client.id,
            WalletTransaction.type == WalletTransactionType.funding,
            WalletTransaction.status == WalletTransactionStatus.successful,
        )
        .first()
        is not None
    )
    contract_amount = None
    milestones_total = 0.0
    remaining_unallocated = None
    if project.assigned_professional_id:
        accepted_bid = (
            db.query(Bid)
            .filter(Bid.project_id == project.id, Bid.status == BidStatus.accepted)
            .order_by(Bid.created_at.desc())
            .first()
        )
        if accepted_bid:
            contract_amount = accepted_bid.offered_amount if accepted_bid.offered_amount is not None else accepted_bid.amount
            # Approved change orders permanently move the contract price —
            # scope additions raise it, scope reductions lower it — even the
            # ones that were too small/negative to spin up their own
            # milestone (create_change_order/update_change_order only create
            # a milestone for amount_delta > 0).
            approved_delta = (
                db.query(ChangeOrder)
                .filter(ChangeOrder.project_id == project.id, ChangeOrder.status == ChangeOrderStatus.approved)
                .with_entities(ChangeOrder.amount_delta)
                .all()
            )
            contract_amount += sum(d for (d,) in approved_delta)
            milestones_total = sum(
                m.amount for m in project.milestones
                if m.status not in (MilestoneStatus.rejected, MilestoneStatus.refunded)
            )
            remaining_unallocated = round(contract_amount - milestones_total, 2)
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
        timeline=project.timeline,
        image_urls=project.image_urls or [],
        video_url=project.video_url,
        status=project.status,
        progress=project.computed_progress,
        assigned_professional_id=project.assigned_professional_id,
        closing_note=project.closing_note,
        created_at=project.created_at,
        bid_count=len(project.bids),
        contract_amount=contract_amount,
        milestones_total=milestones_total,
        remaining_unallocated=remaining_unallocated,
        client_company_name=client.company_name if client else None,
        client_is_verified_business=bool(client.is_verified_business) if client else False,
        client_completed_project_count=completed_count,
        client_kyc_verified=bool(client and client.kyc_status == KycStatus.verified),
        client_payment_verified=payment_verified,
        client_email_verified=bool(client and client.email_verified_at is not None),
        client_member_since=client.created_at if client else None,
        client_open_project_count=open_count,
        client_hire_rate=hire_rate,
    )


@router.get("", response_model=list[ProjectOut])
def list_projects(
    category_id: Optional[str] = None,
    status_filter: Optional[ProjectStatus] = None,
    client_id: Optional[str] = None,
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
    if client_id:
        # A client's job history (any status) shown on their public profile
        # so professionals can see their full posting track record, not just
        # currently-open listings — mirrors what the client sees of their own
        # projects, just scoped read-only and without status defaulting to
        # "open only".
        query = query.filter(Project.client_id == client_id)
        if status_filter:
            query = query.filter(Project.status == status_filter)
    elif status_filter:
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
    # Only enforceable once outbound email actually works — with no provider
    # configured, verification links can never be delivered, so the existing
    # (no gate) behavior is kept rather than locking every client out.
    if settings.email_configured and current_user.email_verified_at is None:
        raise HTTPException(status_code=403, detail="Please verify your email address before posting a project.")
    if not db.get(Category, payload.category_id):
        raise HTTPException(status_code=400, detail="Unknown category")
    if payload.budget_min < 0 or payload.budget_max < 0:
        raise HTTPException(status_code=400, detail="Budget can't be negative")
    if payload.budget_min > 0 and payload.budget_max > 0 and payload.budget_min > payload.budget_max:
        raise HTTPException(status_code=400, detail="Minimum budget can't exceed the maximum")
    image_urls, video_url = _gate_media(db, payload.image_urls, payload.video_url)
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
        timeline=payload.timeline,
        image_urls=image_urls or None,
        video_url=video_url,
    )
    db.add(project)
    db.commit()
    db.refresh(project)
    _notify_matching_professionals(db, project)
    return _to_out(project, db)


def _notify_matching_professionals(db: Session, project: Project) -> None:
    """Tell professionals whose profile fits this project that it exists,
    instead of relying on them to stumble onto it in Find Work. Matches on
    category first (the strong signal), then narrows to a skills overlap
    when the project listed any — falling back to the full category match
    if nobody's listed skills happen to overlap, same "don't over-filter
    down to nothing" idea as the search fallback in list_projects."""
    matching = (
        db.query(ProfessionalProfile)
        .filter(ProfessionalProfile.category_id == project.category_id)
        .filter(ProfessionalProfile.availability != "offline")
        .all()
    )
    if project.skills_list:
        wanted = {s.strip().lower() for s in project.skills_list}
        with_overlap = [p for p in matching if wanted & {s.strip().lower() for s in p.skills_list}]
        if with_overlap:
            matching = with_overlap

    if project.budget_min == 0 and project.budget_max == 0:
        budget_note = "Budget Not Set — send your quote"
    else:
        budget_note = (
            f"₦{project.budget_min:,.0f}–₦{project.budget_max:,.0f}" if project.budget_type == BudgetType.fixed
            else f"₦{project.budget_min:,.0f}–₦{project.budget_max:,.0f}/hr"
        )
    for p in matching:
        notify(
            db, p.user_id, NotificationType.general,
            f"New project in your category: \"{project.title}\"",
            body=f"{project.location or 'Remote'} · {budget_note}",
            link=f"/talent/dashboard/find-work/{project.id}",
            email_also=True,
        )
    db.commit()


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
    data = payload.model_dump(exclude_unset=True)
    if current_user.role != UserRole.admin:
        # Status / assignment / progress drive the hiring and escrow flow and
        # are owned by the accept-a-bid and milestone transitions, not by a
        # free-form PATCH; a client could otherwise mark a project completed
        # or assign any professional without accepting a proposal.
        for field in ("status", "assigned_professional_id", "progress"):
            data.pop(field, None)
    if "category_id" in data and data["category_id"] is not None:
        if not db.get(Category, data["category_id"]):
            raise HTTPException(status_code=400, detail="Unknown category")
    if "skills" in data and data["skills"] is not None:
        data["skills"] = ",".join(data["skills"])
    if "image_urls" in data or "video_url" in data:
        gated_images, gated_video = _gate_media(
            db,
            data.get("image_urls", project.image_urls),
            data.get("video_url", project.video_url),
        )
        if "image_urls" in data:
            data["image_urls"] = gated_images or None
        if "video_url" in data:
            data["video_url"] = gated_video
    for field, value in data.items():
        setattr(project, field, value)
    db.commit()
    db.refresh(project)
    return _to_out(project, db)


@router.post("/{project_id}/complete", response_model=ProjectOut)
def complete_project(
    project_id: str,
    current_user: User = Depends(require_role(UserRole.client)),
    db: Session = Depends(get_db),
):
    """Client moves an in-progress project into final review (the "review"
    state): the work is done as far as the client is concerned, and the
    assigned professional gets a chance to leave a closing note or raise any
    final issues before the client confirms completion. Guards: no open
    dispute, and no escrow money left sitting in funded or approved milestones
    (release or refund those first, or raise a dispute), so funds are never
    stranded."""
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if project.client_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to move this project to review")
    if project.status != ProjectStatus.in_progress:
        raise HTTPException(status_code=400, detail="Only in-progress projects can move to final review")
    if has_any_blocking_dispute(db, project.id):
        raise HTTPException(status_code=400, detail="Resolve the open dispute on this project before completing it")
    funded = (
        db.query(Milestone)
        .filter(
            Milestone.project_id == project.id,
            Milestone.status.in_([MilestoneStatus.funded, MilestoneStatus.approved]),
        )
        .count()
    )
    if funded:
        raise HTTPException(
            status_code=400,
            detail=(
                f"{funded} milestone{'s' if funded != 1 else ''} still hold{'s' if funded == 1 else ''} escrow funds. "
                "Release or refund them (or open a dispute) before completing the project."
            ),
        )
    project.status = ProjectStatus.review
    if project.assigned_professional_id:
        notify(
            db, project.assigned_professional_id, NotificationType.general,
            f"\"{project.title}\" is under final review",
            body="The client has moved the project to final review. You can leave a closing note before they sign off.",
            link=f"/talent/dashboard/find-work/{project.id}", email_also=True,
        )
    db.commit()
    db.refresh(project)
    return _to_out(project, db)


@router.post("/{project_id}/confirm", response_model=ProjectOut)
def confirm_project(
    project_id: str,
    current_user: User = Depends(require_role(UserRole.client)),
    db: Session = Depends(get_db),
):
    """Final sign-off: client confirms completion of a project under review.
    This is the only transition into `completed` (besides the milestone
    auto-path, which now also lands in review first), so the professional's
    closing note window always happens before reviews unlock."""
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if project.client_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to confirm this project")
    if project.status != ProjectStatus.review:
        raise HTTPException(status_code=400, detail="Only projects under final review can be confirmed complete")
    if has_any_blocking_dispute(db, project.id):
        raise HTTPException(status_code=400, detail="Resolve the open dispute before confirming completion")
    project.status = ProjectStatus.completed
    project.completed_at = datetime.utcnow()
    notify(
        db, project.client_id, NotificationType.general,
        f"\"{project.title}\" is complete",
        body="You confirmed final sign-off. You can leave a review for the professional.",
        link=f"/client/dashboard/projects/{project.id}", email_also=True,
    )
    if project.assigned_professional_id:
        notify(
            db, project.assigned_professional_id, NotificationType.general,
            f"\"{project.title}\" is complete",
            body="The client confirmed final sign-off. You can leave a review for the client.",
            link=f"/talent/dashboard/find-work/{project.id}", email_also=False,
        )
    db.commit()
    db.refresh(project)
    return _to_out(project, db)


@router.post("/{project_id}/reopen", response_model=ProjectOut)
def reopen_project(
    project_id: str,
    current_user: User = Depends(require_role(UserRole.client)),
    db: Session = Depends(get_db),
):
    """Client pulls a project out of final review back into active work (e.g.
    the professional's closing note surfaced a real remaining issue), so more
    milestones can be added and funded."""
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if project.client_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to reopen this project")
    if project.status != ProjectStatus.review:
        raise HTTPException(status_code=400, detail="Only projects under final review can be reopened")
    project.status = ProjectStatus.in_progress
    if project.assigned_professional_id:
        notify(
            db, project.assigned_professional_id, NotificationType.general,
            f"\"{project.title}\" was reopened",
            body="The client reopened the project for more work. New milestones can be added.",
            link=f"/talent/dashboard/find-work/{project.id}", email_also=False,
        )
    db.commit()
    db.refresh(project)
    return _to_out(project, db)


@router.post("/{project_id}/closing-note", response_model=ProjectOut)
def post_closing_note(
    project_id: str,
    payload: ClosingNoteIn,
    current_user: User = Depends(require_role(UserRole.professional)),
    db: Session = Depends(get_db),
):
    """The assigned professional replies during final review: a closing note
    (or a flag that work isn't done) that the client sees before signing off.
    Empty note clears it. Posting a note notifies the client."""
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if project.assigned_professional_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the assigned professional can leave a closing note")
    if project.status != ProjectStatus.review:
        raise HTTPException(status_code=400, detail="A closing note can only be left while the project is under final review")
    note = payload.note.strip()
    project.closing_note = note or None
    notify(
        db, project.client_id, NotificationType.general,
        f"Closing note from {current_user.first_name} on \"{project.title}\"",
        body=note or "The professional cleared their closing note.",
        link=f"/client/dashboard/projects/{project.id}", email_also=True,
    )
    db.commit()
    db.refresh(project)
    return _to_out(project, db)


@router.post("/{project_id}/close", response_model=ProjectOut)
def close_project(
    project_id: str,
    current_user: User = Depends(require_role(UserRole.client)),
    db: Session = Depends(get_db),
):
    """A client can close their own open project (no one hired yet).
    Distinct from the admin force-cancel: this is the normal "I'm no longer
    pursuing this" path and only applies while the project is still open."""
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if project.client_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to close this project")
    if project.status != ProjectStatus.open:
        raise HTTPException(status_code=400, detail="Only open projects can be closed")
    project.status = ProjectStatus.cancelled
    db.commit()
    db.refresh(project)
    return _to_out(project, db)
