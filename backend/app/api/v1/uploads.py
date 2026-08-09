import os
import uuid

from fastapi import APIRouter, Depends, UploadFile, File, HTTPException

from app.api.deps import get_current_user
from app.core.config import settings
from app.models.user import User

router = APIRouter(prefix="/uploads", tags=["uploads"])

ALLOWED_EXT = {".png", ".jpg", ".jpeg", ".webp", ".pdf"}
MAX_SIZE = 10 * 1024 * 1024  # 10MB


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
    return False


@router.post("")
async def upload_file(file: UploadFile = File(...), current_user: User = Depends(get_current_user)):
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in ALLOWED_EXT:
        raise HTTPException(status_code=400, detail=f"Unsupported file type: {ext}")

    contents = await file.read()
    if len(contents) > MAX_SIZE:
        raise HTTPException(status_code=400, detail="File too large (max 10MB)")
    if not contents or not _sniff_matches_extension(contents, ext):
        raise HTTPException(status_code=400, detail="File content does not match its extension")

    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    filename = f"{uuid.uuid4().hex}{ext}"
    path = os.path.join(settings.UPLOAD_DIR, filename)
    with open(path, "wb") as f:
        f.write(contents)

    url = f"{settings.PUBLIC_BASE_URL.rstrip('/')}/uploads/{filename}"
    return {"url": url}
