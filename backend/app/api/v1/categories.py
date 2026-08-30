from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.category import Category
from app.models.profile import ProfessionalProfile
from app.schemas.category import CategoryOut
from app.services.platform_settings import get_featured_category_ids

router = APIRouter(prefix="/categories", tags=["categories"])

@router.get("", response_model=list[CategoryOut])
def list_categories(db: Session = Depends(get_db)):
    categories = db.query(Category).order_by(Category.label).all()
    counts = dict(
        db.query(ProfessionalProfile.category_id, func.count(ProfessionalProfile.id))
        .group_by(ProfessionalProfile.category_id)
        .all()
    )
    featured_ids = set(get_featured_category_ids(db))
    out = [
        CategoryOut(
            id=c.id,
            label=c.label,
            icon=c.icon,
            description=c.description,
            professional_count=counts.get(c.id, 0),
            featured=c.id in featured_ids,
        )
        for c in categories
    ]

    out.sort(key=lambda c: (c.id not in featured_ids, c.label))
    return out
