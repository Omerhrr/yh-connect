import json
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.config import settings
from app.core.security import decode_access_token
from app.db.session import get_db
from app.db.session import SessionLocal
from app.models.bid import Bid
from app.models.message import Message, MessageReaction
from app.models.project import Project
from app.models.project_invite import ProjectInvite
from app.models.project_access_request import AccessRequestStatus, ProjectAccessRequest
from app.models.user import KycStatus, User, UserRole
from app.models.notification import NotificationType
from app.schemas.message import (
    MessageCreate,
    MessageEdit,
    MessageOut,
    ProjectUpdateIn,
    ReactionCreate,
    ReactionSummary,
    ReplyPreview,
    ThreadOut,
)
from app.services.notify import notify_online_aware
from app.services.ws_manager import manager

router = APIRouter(tags=["messages"])
legacy_router = APIRouter(prefix="/messages", tags=["messages"])


def _reaction_summaries(message: Message, current_user_id: str) -> list[ReactionSummary]:
    by_emoji: dict[str, list[MessageReaction]] = {}
    for r in message.reactions:
        by_emoji.setdefault(r.emoji, []).append(r)
    summaries = []
    for emoji, reactions in by_emoji.items():
        summaries.append(
            ReactionSummary(
                emoji=emoji,
                count=len(reactions),
                mine=any(r.user_id == current_user_id for r in reactions),
                user_names=[f"{r.user.first_name} {r.user.last_name}" if r.user else "User" for r in reactions],
            )
        )
    summaries.sort(key=lambda s: s.emoji)
    return summaries


def _to_out(message: Message, current_user_id: Optional[str] = None) -> MessageOut:
    # Built field-by-field rather than MessageOut.model_validate(message):
    # from_attributes validation would also try to auto-validate the raw
    # `reactions`/`reply_to` ORM relationships against the response schema,
    # and MessageReaction rows don't have a count/mine/user_names shape,
    # that's computed below instead, so blanket validation blows up.
    out = MessageOut(
        id=message.id,
        project_id=message.project_id,
        sender_id=message.sender_id,
        recipient_id=message.recipient_id,
        body="" if message.is_deleted else message.body,
        attachment_url=None if message.is_deleted else message.attachment_url,
        message_type=message.message_type,
        duration_seconds=message.duration_seconds,
        is_read=message.is_read,
        is_deleted=message.is_deleted,
        edited_at=message.edited_at,
        created_at=message.created_at,
        sender_name=f"{message.sender.first_name} {message.sender.last_name}" if message.sender else None,
        reactions=[],
    )
    if message.reply_to:
        rt = message.reply_to
        out.reply_to = ReplyPreview(
            id=rt.id,
            sender_id=rt.sender_id,
            sender_name=f"{rt.sender.first_name} {rt.sender.last_name}" if rt.sender else None,
            body="" if rt.is_deleted else rt.body,
            message_type=rt.message_type,
            attachment_url=None if rt.is_deleted else rt.attachment_url,
            is_deleted=rt.is_deleted,
        )
    out.reactions = _reaction_summaries(message, current_user_id or "")
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


def _is_project_messaging_party(db: Session, project: Project, user: User) -> bool:
    """Who is allowed to take part in a project's message thread: the client,
    the assigned professional, and any professional who bid on or was
    invited to the project (so a client can vet bidders before hiring).
    Everyone else is locked out, the thread is private to the project."""
    if user.id in (project.client_id, project.assigned_professional_id):
        return True
    if user.role != UserRole.professional:
        return False
    if db.query(Bid).filter(Bid.project_id == project.id, Bid.professional_id == user.id).first():
        return True
    if (
        db.query(ProjectInvite)
        .filter(ProjectInvite.project_id == project.id, ProjectInvite.professional_id == user.id)
        .first()
    ):
        return True
    if (
        db.query(ProjectAccessRequest)
        .filter(
            ProjectAccessRequest.project_id == project.id,
            ProjectAccessRequest.professional_id == user.id,
            ProjectAccessRequest.status == AccessRequestStatus.approved,
        )
        .first()
    ):
        return True
    return False


def _require_project_messaging_party(db: Session, project: Project, user: User) -> None:
    if not _is_project_messaging_party(db, project, user):
        raise HTTPException(
            status_code=403,
            detail="You're not a participant on this project's conversation",
        )


def _user_is_project_participant(db: Session, project: Project, user_id: str) -> bool:
    """Same membership as _is_project_messaging_party but keyed by user id,
    used to validate who a message can be addressed to."""
    if user_id in (project.client_id, project.assigned_professional_id):
        return True
    if db.query(Bid).filter(Bid.project_id == project.id, Bid.professional_id == user_id).first():
        return True
    if (
        db.query(ProjectInvite)
        .filter(ProjectInvite.project_id == project.id, ProjectInvite.professional_id == user_id)
        .first()
    ):
        return True
    if (
        db.query(ProjectAccessRequest)
        .filter(
            ProjectAccessRequest.project_id == project.id,
            ProjectAccessRequest.professional_id == user_id,
            ProjectAccessRequest.status == AccessRequestStatus.approved,
        )
        .first()
    ):
        return True
    return False


def _require_recipient_is_project_participant(db: Session, project: Project, recipient_id: str, sender: User) -> None:
    """A message may be addressed to the client, the assigned professional,
    or (only when the sender is the client) a bidder/invitee being vetted.
    Nobody outside the project's participant set can be reached."""
    if _user_is_project_participant(db, project, recipient_id):
        return
    if sender.id == project.client_id:
        raise HTTPException(
            status_code=403,
            detail="You can only message someone who bid on or was invited to this project",
        )
    raise HTTPException(
        status_code=403,
        detail="You can only message the client or the assigned professional on this project",
    )


@legacy_router.get("", response_model=list[MessageOut])
def list_messages(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    messages = (
        db.query(Message)
        .filter((Message.sender_id == current_user.id) | (Message.recipient_id == current_user.id))
        .order_by(Message.created_at.desc())
        .all()
    )
    return [_to_out(m, current_user.id) for m in messages]


@legacy_router.post("", response_model=MessageOut, status_code=201)
def send_message(payload: MessageCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _require_sender_kyc_if_client(current_user)
    if not payload.body.strip() and not payload.attachment_url:
        raise HTTPException(status_code=400, detail="Message can't be empty")
    # project_id is required, not optional: without it there's no way to
    # verify the sender/recipient are actually parties to a shared project,
    # which would let any authenticated user message any other user
    # directly. See docs/AUDIT_2026-08-20.md finding #1.
    if not payload.project_id:
        raise HTTPException(status_code=400, detail="project_id is required")
    project = db.get(Project, payload.project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    _require_project_messaging_party(db, project, current_user)
    _require_recipient_is_project_participant(db, project, payload.recipient_id, current_user)
    message = Message(
        sender_id=current_user.id,
        recipient_id=payload.recipient_id,
        project_id=payload.project_id,
        body=payload.body,
        attachment_url=payload.attachment_url,
        message_type=payload.message_type,
        duration_seconds=payload.duration_seconds,
        reply_to_id=payload.reply_to_id,
    )
    db.add(message)
    db.commit()
    db.refresh(message)
    return _to_out(message, current_user.id)


@legacy_router.post("/{message_id}/read", response_model=MessageOut)
def mark_read(message_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    message = db.get(Message, message_id)
    if not message:
        raise HTTPException(status_code=404, detail="Message not found")
    if current_user.id not in (message.sender_id, message.recipient_id):
        raise HTTPException(status_code=403, detail="Not authorized to view this message")
    if message.recipient_id == current_user.id and not message.is_read:
        message.is_read = True
        db.commit()
        db.refresh(message)
    return _to_out(message, current_user.id)


@legacy_router.get("/unread-count")
def unread_message_count(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Total unread received messages across all project threads, used for
    the Messages nav badge. Counting received rows directly is simpler and
    cheaper than summing per-thread unread from list_threads."""
    count = (
        db.query(Message)
        .filter(
            Message.recipient_id == current_user.id,
            Message.is_read.is_(False),
            Message.is_deleted.is_(False),
        )
        .count()
    )
    return {"count": count}


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
                last_message=(
                    "This message was deleted"
                    if last.is_deleted
                    else (last.body or ("Voice note" if last.message_type == "voice" else "Attachment"))
                ),
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
    return [_to_out(m, current_user.id) for m in messages]


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
    _require_project_messaging_party(db, project, current_user)
    _require_recipient_is_project_participant(db, project, payload.recipient_id, current_user)

    reply_to = None
    if payload.reply_to_id:
        reply_to = db.get(Message, payload.reply_to_id)
        if not reply_to or reply_to.project_id != project_id:
            raise HTTPException(status_code=400, detail="The message being replied to could not be found")

    message = Message(
        sender_id=current_user.id,
        recipient_id=payload.recipient_id,
        project_id=project_id,
        body=payload.body,
        attachment_url=payload.attachment_url,
        message_type=payload.message_type,
        duration_seconds=payload.duration_seconds,
        reply_to_id=reply_to.id if reply_to else None,
    )
    db.add(message)
    db.flush()
    is_client = current_user.id == project.client_id
    notify_body = payload.body[:140] if payload.body else (
        "Sent a voice note" if payload.message_type == "voice" else "Sent an attachment"
    )
    # Only email if they're not actively watching the thread right now — see
    # notify_online_aware / ws_manager.is_online.
    notify_online_aware(
        db, payload.recipient_id, NotificationType.message_received,
        f"New message from {current_user.first_name}",
        body=notify_body,
        link=f"/{'talent' if is_client else 'client'}/dashboard/messages",
    )
    db.commit()
    db.refresh(message)
    out = _to_out(message, current_user.id)
    await manager.send_to(project_id, payload.recipient_id, out.model_dump(mode="json"))
    await manager.send_to(project_id, current_user.id, out.model_dump(mode="json"))
    return out


@router.post("/projects/{project_id}/updates", response_model=MessageOut, status_code=201)
async def post_project_update(
    project_id: str,
    payload: ProjectUpdateIn,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """A free-text project update from the client or the hired professional
    to the other party — the thing you'd want to send even when nothing
    money-related happened (a schedule change, a site visit, a heads-up).
    It's a real Message (message_type="update") so it lands directly in the
    thread and keeps the same log everything else does, just tagged so the
    UI can show a small "Update" badge instead of a plain chat bubble."""
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if current_user.id not in (project.client_id, project.assigned_professional_id):
        raise HTTPException(status_code=403, detail="Only the client or the hired professional can post project updates")
    if not payload.note.strip():
        raise HTTPException(status_code=400, detail="Update can't be empty")
    recipient_id = project.assigned_professional_id if current_user.id == project.client_id else project.client_id
    if not recipient_id:
        raise HTTPException(status_code=400, detail="No one to send this update to yet — a professional needs to be hired first")

    message = Message(
        project_id=project_id,
        sender_id=current_user.id,
        recipient_id=recipient_id,
        body=payload.note.strip(),
        message_type="update",
    )
    db.add(message)
    db.flush()
    is_client = current_user.id == project.client_id
    notify_online_aware(
        db, recipient_id, NotificationType.general,
        f"Project update on \"{project.title}\"",
        body=payload.note.strip()[:140],
        link=f"/{'talent' if is_client else 'client'}/dashboard/messages",
    )
    db.commit()
    db.refresh(message)
    out = _to_out(message, current_user.id)
    await manager.send_to(project_id, recipient_id, out.model_dump(mode="json"))
    await manager.send_to(project_id, current_user.id, out.model_dump(mode="json"))
    return out


@router.post("/messages/{message_id}/react", response_model=MessageOut)
async def react_to_message(
    message_id: str,
    payload: ReactionCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Toggle a reaction: a user has at most one active emoji per message,
    tapping the same emoji again removes it, tapping a different one swaps it,
    mirrors WhatsApp/iMessage tapback behavior."""
    message = db.get(Message, message_id)
    if not message:
        raise HTTPException(status_code=404, detail="Message not found")
    if current_user.id not in (message.sender_id, message.recipient_id):
        raise HTTPException(status_code=403, detail="Not authorized to react to this message")

    existing = (
        db.query(MessageReaction)
        .filter(MessageReaction.message_id == message_id, MessageReaction.user_id == current_user.id)
        .first()
    )
    if existing and existing.emoji == payload.emoji:
        db.delete(existing)
    elif existing:
        existing.emoji = payload.emoji
    else:
        db.add(MessageReaction(message_id=message_id, user_id=current_user.id, emoji=payload.emoji))
    db.commit()
    db.refresh(message)

    out = _to_out(message, current_user.id)
    if message.project_id:
        other_id = message.recipient_id if current_user.id == message.sender_id else message.sender_id
        event = {**out.model_dump(mode="json"), "event": "reaction"}
        await manager.send_to(message.project_id, other_id, event)
        await manager.send_to(message.project_id, current_user.id, event)
    return out


async def _broadcast_message_update(db: Session, message: Message, current_user_id: str) -> MessageOut:
    out = _to_out(message, current_user_id)
    if message.project_id:
        other_id = message.recipient_id if current_user_id == message.sender_id else message.sender_id
        event = {**out.model_dump(mode="json"), "event": "update"}
        await manager.send_to(message.project_id, other_id, event)
        await manager.send_to(message.project_id, current_user_id, event)
    return out


@router.patch("/messages/{message_id}", response_model=MessageOut)
async def edit_message(
    message_id: str,
    payload: MessageEdit,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    message = db.get(Message, message_id)
    if not message:
        raise HTTPException(status_code=404, detail="Message not found")
    if message.sender_id != current_user.id:
        raise HTTPException(status_code=403, detail="You can only edit your own messages")
    if message.is_deleted:
        raise HTTPException(status_code=400, detail="Can't edit a deleted message")
    if message.message_type != "text":
        raise HTTPException(status_code=400, detail="Only text messages can be edited")
    if not payload.body.strip():
        raise HTTPException(status_code=400, detail="Message can't be empty")

    message.body = payload.body.strip()
    message.edited_at = datetime.utcnow()
    db.commit()
    db.refresh(message)
    return await _broadcast_message_update(db, message, current_user.id)


@router.delete("/messages/{message_id}", response_model=MessageOut)
async def delete_message(
    message_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Soft delete, WhatsApp-style: the row stays (reactions/reply threads
    still resolve) but body/attachment are wiped and the bubble renders as
    a placeholder ("You deleted this message" / "This message was deleted")."""
    message = db.get(Message, message_id)
    if not message:
        raise HTTPException(status_code=404, detail="Message not found")
    if message.sender_id != current_user.id:
        raise HTTPException(status_code=403, detail="You can only delete your own messages")
    if message.is_deleted:
        return _to_out(message, current_user.id)

    message.is_deleted = True
    message.body = ""
    message.attachment_url = None
    db.commit()
    db.refresh(message)
    return await _broadcast_message_update(db, message, current_user.id)


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
        if not project or not _is_project_messaging_party(db, project, user):
            await websocket.close(code=4403)
            return
        user_id = user.id
    finally:
        db.close()

    await manager.connect(project_id, user_id, websocket)
    try:
        while True:
            raw = await websocket.receive_text()
            # The only inbound message we act on is a typing indicator ping,
            # e.g. {"type": "typing"}; relay it to the other participant so
            # their UI can show "X is typing…". Anything else (keepalive
            # pings, malformed frames) is ignored.
            try:
                data = json.loads(raw)
            except Exception:
                continue
            if isinstance(data, dict) and data.get("type") == "typing":
                db2 = SessionLocal()
                try:
                    project = db2.get(Project, project_id)
                    if project:
                        other_id = (
                            project.assigned_professional_id
                            if user_id == project.client_id
                            else project.client_id
                        )
                        if other_id:
                            await manager.send_to(project_id, other_id, {"event": "typing", "user_id": user_id})
                finally:
                    db2.close()
    except WebSocketDisconnect:
        manager.disconnect(project_id, user_id, websocket)


@router.post("/projects/{project_id}/messages/read")
def mark_thread_read(
    project_id: str,
    other_user_id: str = Query(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    _require_project_messaging_party(db, project, current_user)
    db.query(Message).filter(
        Message.project_id == project_id,
        Message.sender_id == other_user_id,
        Message.recipient_id == current_user.id,
        Message.is_read.is_(False),
    ).update({"is_read": True})
    db.commit()
    return {"status": "ok"}
