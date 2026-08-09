"""Real project work-history feed for a professional's profile: actual YH
Connect projects they were hired on, with the client's review if one exists.
Distinct from self-reported `EmploymentHistory` (prior jobs elsewhere)."""

from sqlalchemy.orm import Session

from app.models.project import Project, ProjectStatus
from app.models.review import Review
from app.schemas.profile_extras import WorkHistoryItem


def _amount_label(project: Project) -> str:
    if project.budget_min == project.budget_max:
        return f"₦{project.budget_min:,.0f}"
    return f"₦{project.budget_min:,.0f} - ₦{project.budget_max:,.0f}"


def get_work_history(db: Session, professional_user_id: str, limit: int = 30) -> list[WorkHistoryItem]:
    projects = (
        db.query(Project)
        .filter(
            Project.assigned_professional_id == professional_user_id,
            Project.status.in_([ProjectStatus.completed, ProjectStatus.in_progress, ProjectStatus.review]),
        )
        .order_by(Project.created_at.desc())
        .limit(limit)
        .all()
    )
    items: list[WorkHistoryItem] = []
    for p in projects:
        review = (
            db.query(Review)
            .filter(Review.project_id == p.id, Review.reviewee_id == professional_user_id)
            .first()
        )
        client = p.client
        items.append(WorkHistoryItem(
            project_id=p.id,
            project_title=p.title,
            client_name=f"{client.first_name} {client.last_name[0]}." if client else "Client",
            client_company=client.company_name if client else None,
            status=p.status.value,
            created_at=p.created_at,
            completed_at=p.completed_at,
            amount_range_label=_amount_label(p),
            review_rating=review.rating if review else None,
            review_comment=review.comment if review else None,
        ))
    return items
