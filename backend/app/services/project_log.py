"""Mirrors milestone/change-order/wallet events into the project's message
thread as system log entries, so Messages becomes the single running record
of everything that happened on a project — not just the money-moving events,
and not just plain chat. See message_type == "system" (rendered as a
centered, non-bubble log line by the frontend, not attributable "chat" from
either party) vs "update" (a real authored note from one party to the other,
just tagged so it stands out from ordinary chat).
"""

from sqlalchemy.orm import Session

from app.models.message import Message
from app.models.notification import NotificationType
from app.models.project import Project
from app.services.notify import notify_online_aware

def _other_party(project: Project, actor_id: str) -> str | None:
    if actor_id == project.client_id:
        return project.assigned_professional_id
    if actor_id == project.assigned_professional_id:
        return project.client_id

    return project.client_id if actor_id != project.client_id else project.assigned_professional_id

def post_system_message(db: Session, project: Project, actor_id: str, body: str, link_role_path: str | None = None) -> Message | None:
    """Records `body` as a system log entry in the actor's thread with the
    other project party, and emails that party if they're not online. No-op
    (returns None) if there's no other party yet (e.g. project not hired)."""
    recipient_id = _other_party(project, actor_id)
    if not recipient_id or recipient_id == actor_id:
        return None

    message = Message(
        project_id=project.id,
        sender_id=actor_id,
        recipient_id=recipient_id,
        body=body,
        message_type="system",
    )
    db.add(message)
    db.flush()

    is_recipient_client = recipient_id == project.client_id
    role_path = link_role_path or ("client" if is_recipient_client else "talent")
    notify_online_aware(
        db, recipient_id, NotificationType.general,
        f"Update on \"{project.title}\"",
        body=body,
        link=f"/{role_path}/dashboard/messages",
    )
    return message
