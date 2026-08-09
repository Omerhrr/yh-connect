from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.profile import ProfessionalProfile
from app.models.project import Project, ProjectStatus
from app.models.review import Review
from app.models.user import User
from app.models.notification import NotificationType
from app.schemas.review import ReviewCreate, ReviewOut, ReviewRespond
from app.services.notify import notify
from datetime import datetime

router = APIRouter(prefix="/reviews", tags=["reviews"])


def _to_out(r: Review, db: Session) -> ReviewOut:
    out = ReviewOut.model_validate(r)
    reviewer = db.get(User, r.reviewer_id)
    out.reviewer_name = f"{reviewer.first_name} {reviewer.last_name}" if reviewer else None
    return out


@router.post("", response_model=ReviewOut, status_code=201)
def create_review(payload: ReviewCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    project = db.get(Project, payload.project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if current_user.id not in (project.client_id, project.assigned_professional_id):
        raise HTTPException(status_code=403, detail="Not authorized to review this project")
    if project.status != ProjectStatus.completed:
        raise HTTPException(status_code=400, detail="You can only leave a review once the project is completed")
    if payload.reviewee_id not in (project.client_id, project.assigned_professional_id) or payload.reviewee_id == current_user.id:
        raise HTTPException(status_code=400, detail="Invalid reviewee for this project")
    existing = (
        db.query(Review)
        .filter(Review.project_id == payload.project_id, Review.reviewer_id == current_user.id)
        .first()
    )
    if existing:
        raise HTTPException(status_code=409, detail="You have already reviewed this project")

    review = Review(
        project_id=payload.project_id,
        reviewer_id=current_user.id,
        reviewee_id=payload.reviewee_id,
        rating=payload.rating,
        comment=payload.comment,
    )
    db.add(review)

    profile = db.query(ProfessionalProfile).filter(ProfessionalProfile.user_id == payload.reviewee_id).first()
    if profile:
        total = profile.rating * profile.review_count + payload.rating
        profile.review_count += 1
        profile.rating = round(total / profile.review_count, 2)

    is_reviewee_client = payload.reviewee_id == project.client_id
    notify(
        db, payload.reviewee_id, NotificationType.general,
        f"You received a {payload.rating}-star review",
        body=payload.comment or f"For \"{project.title}\"",
        link=f"/{'client' if is_reviewee_client else 'talent'}/dashboard",
        email_also=False,
    )

    db.commit()
    db.refresh(review)
    return _to_out(review, db)


@router.get("/for/{user_id}", response_model=list[ReviewOut])
def reviews_for_user(user_id: str, db: Session = Depends(get_db)):
    reviews = db.query(Review).filter(Review.reviewee_id == user_id).order_by(Review.created_at.desc()).all()
    return [_to_out(r, db) for r in reviews]


@router.patch("/{review_id}/respond", response_model=ReviewOut)
def respond_to_review(
    review_id: str,
    payload: ReviewRespond,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    review = db.get(Review, review_id)
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")
    if review.reviewee_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the reviewed party can respond to this review")
    if review.response_body:
        raise HTTPException(status_code=400, detail="You've already responded to this review")

    review.response_body = payload.response_body.strip()
    review.responded_at = datetime.utcnow()
    notify(
        db, review.reviewer_id, NotificationType.general,
        "Someone responded to your review",
        body=review.response_body,
        email_also=False,
    )
    db.commit()
    db.refresh(review)
    return _to_out(review, db)
