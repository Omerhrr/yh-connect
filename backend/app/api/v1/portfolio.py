from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import require_role
from app.db.session import get_db
from app.models.portfolio import PortfolioItem
from app.models.profile import ProfessionalProfile
from app.models.user import User, UserRole
from app.schemas.portfolio import PortfolioItemCreate, PortfolioItemOut

router = APIRouter(prefix="/professionals/me/portfolio", tags=["portfolio"])


def _out(item: PortfolioItem) -> PortfolioItemOut:
    return PortfolioItemOut(
        id=item.id,
        profile_id=item.profile_id,
        title=item.title,
        description=item.description,
        image_urls=item.image_url_list,
        completed_date=item.completed_date,
        created_at=item.created_at,
    )


@router.post("", response_model=PortfolioItemOut, status_code=201)
def add_portfolio_item(
    payload: PortfolioItemCreate,
    current_user: User = Depends(require_role(UserRole.professional)),
    db: Session = Depends(get_db),
):
    profile = db.query(ProfessionalProfile).filter(ProfessionalProfile.user_id == current_user.id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    item = PortfolioItem(
        profile_id=profile.id,
        title=payload.title,
        description=payload.description,
        image_urls=",".join(payload.image_urls) if payload.image_urls else None,
        completed_date=payload.completed_date,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return _out(item)


@router.delete("/{item_id}", status_code=204)
def delete_portfolio_item(
    item_id: str,
    current_user: User = Depends(require_role(UserRole.professional)),
    db: Session = Depends(get_db),
):
    item = db.get(PortfolioItem, item_id)
    if not item or item.profile.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Portfolio item not found")
    db.delete(item)
    db.commit()
