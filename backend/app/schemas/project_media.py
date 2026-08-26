from typing import Optional

from pydantic import BaseModel


class ProjectMediaSettingsOut(BaseModel):
    # Images: on by default so clients get the benefit immediately; admin
    # can turn off or cap size.
    images_enabled: bool = True
    image_max_mb: float = 5.0
    # Video: off by default (bigger files, more moderation surface) until an
    # admin deliberately opts in.
    video_enabled: bool = False
    video_max_mb: float = 50.0


class ProjectMediaSettingsIn(BaseModel):
    images_enabled: Optional[bool] = None
    image_max_mb: Optional[float] = None
    video_enabled: Optional[bool] = None
    video_max_mb: Optional[float] = None
