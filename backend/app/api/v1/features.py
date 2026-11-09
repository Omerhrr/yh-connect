from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.services.platform_settings import get_feature_flags

router = APIRouter(tags=["features"])


@router.get("/public/features")
def public_features(db: Session = Depends(get_db)):
    """Which optional features the admin has switched on (all off by default)."""
    return get_feature_flags(db)
