from typing import Optional

from pydantic import BaseModel

class ProjectMediaSettingsOut(BaseModel):

    images_enabled: bool = True
    image_max_mb: float = 5.0

    video_enabled: bool = False
    video_max_mb: float = 50.0

class ProjectMediaSettingsIn(BaseModel):
    images_enabled: Optional[bool] = None
    image_max_mb: Optional[float] = None
    video_enabled: Optional[bool] = None
    video_max_mb: Optional[float] = None
