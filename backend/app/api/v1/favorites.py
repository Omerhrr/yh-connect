from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.favorite import Favorite, FavoriteTargetType
from app.models.profile import ProfessionalProfile
from app.models.project import Project
from app.models.user import User
from app.schemas.favorite import FavoriteCreate, FavoriteOut
from app.schemas.profile import ProfessionalOut
from app.schemas.project import ProjectOut
from app.api.v1.professionals import _to_out as _profile_to_out
from app.api.v1.projects import _to_out as _project_to_out

router = APIRouter(prefix="/favorites", tags=["favorites"])


@router.get("", response_model=list[FavoriteOut])
def list_favorites(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.query(Favorite).filter(Favorite.user_id == current_user.id).order_by(Favorite.created_at.desc()).all()


@router.post("", response_model=FavoriteOut, status_code=201)
def add_favorite(payload: FavoriteCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    existing = (
        db.query(Favorite)
        .filter(
            Favorite.user_id == current_user.id,
            Favorite.target_type == payload.target_type,
            Favorite.target_id == payload.target_id,
        )
        .first()
    )
    if existing:
        return existing

    fav = Favorite(user_id=current_user.id, target_type=payload.target_type, target_id=payload.target_id)
    db.add(fav)
    db.commit()
    db.refresh(fav)
    return fav


@router.delete("/{target_type}/{target_id}", status_code=204)
def remove_favorite(
    target_type: FavoriteTargetType,
    target_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    db.query(Favorite).filter(
        Favorite.user_id == current_user.id,
        Favorite.target_type == target_type,
        Favorite.target_id == target_id,
    ).delete()
    db.commit()


@router.get("/professionals", response_model=list[ProfessionalOut])
def favorite_professionals(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    favs = (
        db.query(Favorite)
        .filter(Favorite.user_id == current_user.id, Favorite.target_type == FavoriteTargetType.professional)
        .all()
    )
    profile_ids = [f.target_id for f in favs]
    if not profile_ids:
        return []
    profiles = db.query(ProfessionalProfile).filter(ProfessionalProfile.id.in_(profile_ids)).all()
    return [_profile_to_out(p, db) for p in profiles]


@router.get("/projects", response_model=list[ProjectOut])
def favorite_projects(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    favs = (
        db.query(Favorite)
        .filter(Favorite.user_id == current_user.id, Favorite.target_type == FavoriteTargetType.project)
        .all()
    )
    project_ids = [f.target_id for f in favs]
    if not project_ids:
        return []
    projects = db.query(Project).filter(Project.id.in_(project_ids)).all()
    return [_project_to_out(p, db) for p in projects]
