"""Helper for creating in-app notifications (and, optionally, mirroring them
by email) at the key events across the platform: bids, invites, milestones,
disputes, messages. Keeping this in one place means every call site creates
notifications the same way instead of hand-rolling Notification() inserts.
"""
from sqlalchemy.orm import Session

from app.models.notification import Notification, NotificationType
from app.models.user import User
from app.services.email import send_notification_email


def notify(
    db: Session,
    user_id: str,
    type: NotificationType,
    title: str,
    body: str | None = None,
    link: str | None = None,
    email_also: bool = False,
) -> Notification:
    n = Notification(user_id=user_id, type=type, title=title, body=body, link=link)
    db.add(n)
    db.flush()

    if email_also:
        user = db.get(User, user_id)
        if user and user.email_notifications_enabled:
            frontend_link = None
            if link:
                from app.core.config import settings
                frontend_link = f"{settings.FRONTEND_BASE_URL.rstrip('/')}{link}"
            send_notification_email(user.email, user.first_name, title, body or title, frontend_link)

    return n
