from typing import Optional

from pydantic import BaseModel


class CategoryOut(BaseModel):
    id: str
    label: str
    icon: str
    description: Optional[str] = None
    professional_count: int = 0
    featured: bool = False

    class Config:
        from_attributes = True
