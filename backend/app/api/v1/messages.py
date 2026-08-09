from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.config import settings
from app.core.security import decode_access_token
from app.db.session import get_db
from app.db.session import SessionLocal
from app.models.message import Message
from app.models.project import Project
from app.models.user import KycStatus, User, UserRole
from app.models.notification import NotificationType
from app.schemas.message import MessageCreate, MessageOut, ThreadOut
from app.services.notify import notify
from app.services.ws_manager import manager

router = APIRouter(tags=["messages"])
legacy_router = APIRouter(prefix="/messages", tags=["messages"])


def _to_out(message: Message) -> MessageOut:
    out = MessageOut.model_validate(message)
    out.sender_name = f"{message.sender.first_name} {message.sender.last_name}" if message.sender else None
    return out


def _require_sender_kyc_if_client(user: User) -> None:
    """A client starting/continuing direct contact with a professional must
    be KYC-verified first, mirrors the gate on invites and bid acceptance."""
    if not settings.KYC_ENFORCEMENT_ENABLED:
        return
    if user.role == UserRole.client and user.kyc_status != KycStatus.verified:
        raise HTTPException(
            status_code=403,
            detail="Please verify your identity (NIN) before messaging professionals.",
        )


@legacy_router.get("", response_model=list[MessageOut])
def list_messages(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    messages = (
        db.query(Message)
        .filter((Message.sender_id == current_user.id) | (Message.recipient_id == current_user.id))
        .order_by(Message.created_at.desc())
        .all()
    )
    return [_to_out(m) for m in messages]


@legacy_router.post("", response_model=MessageOut, status_code=201)
def send_message(payload: MessageCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _require_sender_kyc_if_client(current_user)
    if not payload.body.strip() and not payload.attachment_url:
        raise HTTPException(status_code=400, detail="Message can't be empty")
    message = Message(
        sender_id=current_user.id,
        recipient_id=payload.recipient_id,
        project_id=payload.project_id,
        body=payload.body,
        attachment_url=payload.attachment_url,
    )
    db.add(message)
    db.commit()
    db.refresh(message)
    return _to_out(message)


@legacy_router.post("/{message_id}/read", response_model=MessageOut)
def mark_read(message_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    message = db.get(Message, message_id)
    if message and message.recipient_id == current_user.id:
        message.is_read = True
        db.commit()
        db.refresh(message)
    return _to_out(message)


@legacy_router.get("/threads", response_model=list[ThreadOut])
def list_threads(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    messages = (
        db.query(Message)
        .filter(
            (Message.sender_id == current_user.id) | (Message.recipient_id == current_user.id),
            Message.project_id.isnot(None),
        )
        .order_by(Message.created_at.asc())
        .all()
    )
    threads: dict[tuple[str, str], dict] = {}
    for m in messages:
        other_id = m.recipient_id if m.sender_id == current_user.id else m.sender_id
        key = (m.project_id, other_id)
        threads[key] = threads.get(key, {"unread": 0})
        threads[key]["last_message"] = m
        if m.recipient_id == current_user.id and not m.is_read:
            threads[key]["unread"] += 1

    out: list[ThreadOut] = []
    for (project_id, other_id), data in threads.items():
        last: Message = data["last_message"]
        project = db.get(Project, project_id)
        other_user = db.get(User, other_id)
        out.append(
            ThreadOut(
                project_id=project_id,
                project_title=project.title if project else "Project",
                other_user_id=other_id,
                other_user_name=f"{other_user.first_name} {other_user.last_name}" if other_user else "User",
                last_message=last.body,
                last_message_at=last.created_at,
                unread_count=data["unread"],
            )
        )
    out.sort(key=lambda t: t.last_message_at, reverse=True)
    return out


@router.get("/projects/{project_id}/messages", response_model=list[MessageOut])
def project_thread(
    project_id: str,
    other_user_id: Optional[str] = None,
    after: Optional[datetime] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    if not other_user_id:
        if current_user.id == project.client_id:
            other_user_id = project.assigned_professional_id
        else:
            other_user_id = project.client_id
    if not other_user_id:
        return []

    query = db.query(Message).filter(
        Message.project_id == project_id,
        (
            ((Message.sender_id == current_user.id) & (Message.recipient_id == other_user_id))
            | ((Message.sender_id == other_user_id) & (Message.recipient_id == current_user.id))
        ),
    )
    if after:
        query = query.filter(Message.created_at > after)
    messages = query.order_by(Message.created_at.asc()).all()
    return [_to_out(m) for m in messages]


@router.post("/projects/{project_id}/messages", response_model=MessageOut, status_code=201)
async def send_project_message(
    project_id: str,
    payload: MessageCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if not payload.recipient_id:
        raise HTTPException(status_code=400, detail="recipient_id is required")
    if not payload.body.strip() and not payload.attachment_url:
        raise HTTPException(status_code=400, detail="Message can't be empty")
    _require_sender_kyc_if_client(current_user)

    message = Message(
        sender_id=current_user.id,
        recipient_id=payload.recipient_id,
        project_id=project_id,
        body=payload.body,
        attachment_url=payload.attachment_url,
    )
    db.add(message)
    db.flush()
    is_client = current_user.id == project.client_id
    notify(
        db, payload.recipient_id, NotificationType.message_received,
        f"New message from {current_user.first_name}",
        body=(payload.body[:140] if payload.body else "Sent an attachment"),
        link=f"/{'talent' if is_client else 'client'}/dashboard/messages",
        email_also=False,
    )
    db.commit()
    db.refresh(message)
    out = _to_out(message)
    await manager.send_to(project_id, payload.recipient_id, out.model_dump(mode="json"))
    await manager.send_to(project_id, current_user.id, out.model_dump(mode="json"))
    return out


@router.websocket("/ws/projects/{project_id}/messages")
async def messages_websocket(websocket: WebSocket, project_id: str, token: str = Query(...)):
    """Live push channel for a project's message thread. The frontend still
    polls on a long interval as a fallback in case this connection drops or
    a proxy in front of the API doesn't support WebSocket upgrades."""
    payload = decode_access_token(token)
    if not payload or "sub" not in payload:
        await websocket.close(code=4401)
        return

    db = SessionLocal()
    try:
        user = db.get(User, payload["sub"])
        if not user or not user.is_active or payload.get("tv", 0) != user.token_version:
            await websocket.close(code=4401)
            return
        project = db.get(Project, project_id)
        if not project or user.id not in (project.client_id, project.assigned_professional_id):
            await websocket.close(code=4403)
            return
        user_id = user.id
    finally:
        db.close()

    await manager.connect(project_id, user_id, websocket)
    try:
        while True:
            await websocket.receive_text()  # keepalive/ping; we don't act on client messages here
    except WebSocketDisconnect:
        manager.disconnect(project_id, user_id, websocket)


@router.post("/projects/{project_id}/messages/read")
def mark_thread_read(
    project_id: str,
    other_user_id: str = Query(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    db.query(Message).filter(
        Message.project_id == project_id,
        Message.sender_id == other_user_id,
        Message.recipient_id == current_user.id,
        Message.is_read.is_(False),
    ).update({"is_read": True})
    db.commit()
    return {"status": "ok"}
