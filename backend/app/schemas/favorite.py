from datetime import datetime

from pydantic import BaseModel

from app.models.favorite import FavoriteTargetType


class FavoriteCreate(BaseModel):
    target_type: FavoriteTargetType
    target_id: str


class FavoriteOut(BaseModel):
    id: str
    target_type: FavoriteTargetType
    target_id: str
    created_at: datetime

    class Config:
        from_attributes = True
