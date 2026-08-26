import os
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, Request, UploadFile, File, HTTPException, Query
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.config import settings
from app.core.limiter import limiter
from app.db.session import get_db
from app.models.user import User
from app.services.platform_settings import get_project_media_settings

router = APIRouter(prefix="/uploads", tags=["uploads"])

ALLOWED_EXT = {".png", ".jpg", ".jpeg", ".webp", ".pdf", ".webm", ".ogg", ".mp3", ".wav", ".m4a"}
MAX_SIZE = 10 * 1024 * 1024  # 10MB — default cap for the generic (non project-media) purpose

IMAGE_EXT = {".png", ".jpg", ".jpeg", ".webp"}
VIDEO_EXT = {".mp4", ".mov", ".webm"}
# Hard ceiling regardless of what an admin sets, so a misconfigured setting
# (or a stale one from before this cap existed) can't turn the upload
# endpoint into an unbounded disk-filling vector.
VIDEO_HARD_CAP_MB = 500


def _sniff_matches_extension(contents: bytes, ext: str) -> bool:
    """Verify the file's actual magic bytes match its claimed extension, a
    renamed .exe or .html can't just call itself photo.png and get through.
    Checks real file signatures rather than trusting the filename."""
    if ext in (".jpg", ".jpeg"):
        return contents[:3] == b"\xff\xd8\xff"
    if ext == ".png":
        return contents[:8] == b"\x89PNG\r\n\x1a\n"
    if ext == ".webp":
        return contents[:4] == b"RIFF" and contents[8:12] == b"WEBP"
    if ext == ".pdf":
        return contents[:5] == b"%PDF-"
    if ext == ".webm":
        # WebM/Matroska container, what browser MediaRecorder produces by
        # default — used for both the voice-message feature and, now,
        # video uploads (browsers commonly record/export video as webm too).
        return contents[:4] == b"\x1a\x45\xdf\xa3"
    if ext == ".ogg":
        return contents[:4] == b"OggS"
    if ext == ".wav":
        return contents[:4] == b"RIFF" and contents[8:12] == b"WAVE"
    if ext == ".mp3":
        return contents[:3] == b"ID3" or contents[:2] in (b"\xff\xfb", b"\xff\xf3", b"\xff\xf2")
    if ext in (".m4a", ".mp4", ".mov"):
        # ISO base media file format ("ftyp" box at byte offset 4) — covers
        # m4a (Safari/iOS MediaRecorder audio), and mp4/mov video files.
        return contents[4:8] == b"ftyp"
    return False


@router.post("")
@limiter.limit("60/hour")
async def upload_file(
    request: Request,
    file: UploadFile = File(...),
    purpose: Optional[str] = Query(
        None,
        description="Optional upload context: 'project_image' or 'project_video'. Applies admin-configured size limits and (for video) checks the feature is enabled. Omit for the generic 10MB cap used everywhere else (avatars, logos, certifications, KYC docs, chat attachments).",
    ),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ext = os.path.splitext(file.filename or "")[1].lower()

    if purpose == "project_video":
        media = get_project_media_settings(db)
        if not media["video_enabled"]:
            raise HTTPException(status_code=400, detail="Video attachments are currently disabled")
        if ext not in VIDEO_EXT:
            raise HTTPException(status_code=400, detail=f"Unsupported video type: {ext}")
        max_size = int(min(media["video_max_mb"], VIDEO_HARD_CAP_MB) * 1024 * 1024)
    elif purpose == "project_image":
        if ext not in IMAGE_EXT:
            raise HTTPException(status_code=400, detail=f"Unsupported image type: {ext}")
        media = get_project_media_settings(db)
        if not media["images_enabled"]:
            raise HTTPException(status_code=400, detail="Image attachments are currently disabled")
        max_size = int(media["image_max_mb"] * 1024 * 1024)
    else:
        if ext not in ALLOWED_EXT:
            raise HTTPException(status_code=400, detail=f"Unsupported file type: {ext}")
        max_size = MAX_SIZE

    contents = await file.read()
    if len(contents) > max_size:
        raise HTTPException(status_code=400, detail=f"File too large (max {max_size // (1024 * 1024)}MB)")
    if not contents or not _sniff_matches_extension(contents, ext):
        raise HTTPException(status_code=400, detail="File content does not match its extension")

    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    filename = f"{uuid.uuid4().hex}{ext}"
    path = os.path.join(settings.UPLOAD_DIR, filename)
    with open(path, "wb") as f:
        f.write(contents)

    url = f"{settings.PUBLIC_BASE_URL.rstrip('/')}/uploads/{filename}"
    return {"url": url}
