"""Lazy, opportunistic reminders — same "no scheduler" pattern as
app/services/auto_release.py. These run whenever the relevant list/detail
endpoint is hit (an access-requests list, a contract fetch) rather than on
a cron, so a pending negotiation or approval that's gone quiet still gets a
nudge the next time anyone looks, with no new infra required.
"""

from datetime import datetime, timedelta

from sqlalchemy.orm import Session

from app.models.contract import Contract, ContractStatus
from app.models.notification import NotificationType
from app.models.project_access_request import AccessRequestType, ProjectAccessRequest
from app.services.notify import notify

SCHEDULE_REMINDER_AFTER = timedelta(hours=24)
CONTRACT_REMINDER_AFTER = timedelta(hours=24)
VISIT_REMINDER_WINDOW = timedelta(hours=24)


def check_schedule_reminder(db: Session, req: ProjectAccessRequest) -> None:
    """If an inspection date/time proposal has sat waiting on the other
    party for a day, nudge them once per pending proposal."""
    if req.request_type != AccessRequestType.inspection:
        return
    if req.schedule_status not in ("awaiting_client", "awaiting_talent"):
        return
    if req.schedule_reminder_sent or not req.schedule_updated_at:
        return
    if datetime.utcnow() - req.schedule_updated_at < SCHEDULE_REMINDER_AFTER:
        return

    waiting_on_id = req.client_id if req.schedule_status == "awaiting_client" else req.professional_id
    waiting_on_label = "client" if req.schedule_status == "awaiting_client" else "talent"
    when = req.proposed_datetime.strftime("%b %d, %Y %I:%M %p") if req.proposed_datetime else "the proposed time"
    notify(
        db, waiting_on_id, NotificationType.general,
        f"Inspection time still awaiting your response — \"{req.project.title}\"",
        body=f"A visit time of {when} is waiting on you to confirm or propose another. Nothing moves forward until you respond.",
        link=(f"/client/dashboard/projects/{req.project_id}" if req.schedule_status == "awaiting_client" else f"/talent/dashboard/find-work/{req.project_id}"),
        email_also=True,
    )
    req.schedule_reminder_sent = True
    db.commit()
    _ = waiting_on_label  # kept for clarity in body text if extended later


def check_visit_reminder(db: Session, req: ProjectAccessRequest) -> None:
    """Once a visit time is agreed, remind both sides ~a day beforehand so
    it isn't missed."""
    if req.schedule_status != "agreed" or not req.scheduled_datetime:
        return
    if req.visit_reminder_sent:
        return
    now = datetime.utcnow()
    if req.scheduled_datetime <= now:
        return
    if req.scheduled_datetime - now > VISIT_REMINDER_WINDOW:
        return

    when = req.scheduled_datetime.strftime("%b %d, %Y %I:%M %p")
    for user_id, link in (
        (req.client_id, f"/client/dashboard/projects/{req.project_id}"),
        (req.professional_id, f"/talent/dashboard/find-work/{req.project_id}"),
    ):
        notify(
            db, user_id, NotificationType.general,
            f"Inspection visit tomorrow — \"{req.project.title}\"",
            body=f"Reminder: the site visit is scheduled for {when}.",
            link=link, email_also=True,
        )
    req.visit_reminder_sent = True
    db.commit()


def check_contract_reminder(db: Session, contract: Contract) -> None:
    """If a contract has been sitting fully-sent (i.e. not in draft) and
    isn't yet approved by one side after a day, nudge whoever hasn't
    approved yet."""
    if contract.status == ContractStatus.approved or contract.status == ContractStatus.draft:
        return
    if contract.approval_reminder_sent:
        return
    if datetime.utcnow() - contract.updated_at < CONTRACT_REMINDER_AFTER:
        return

    pending: list[tuple[str, str]] = []
    if not contract.client_approved:
        pending.append((contract.client_id, f"/client/dashboard/projects/{contract.project_id}"))
    if not contract.professional_approved:
        pending.append((contract.professional_id, f"/talent/dashboard/find-work/{contract.project_id}"))

    for user_id, link in pending:
        notify(
            db, user_id, NotificationType.general,
            f"Contract still needs your approval — \"{contract.project.title}\"",
            body="The scope-of-work contract is waiting on your review. Work can't start until both sides approve it.",
            link=link, email_also=True,
        )
    contract.approval_reminder_sent = True
    db.commit()
