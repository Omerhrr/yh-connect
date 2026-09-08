"""Lightweight in-process background scheduler.

check_project_auto_release() and release_due_withholds() (app/services/
auto_release.py) were previously "lazy" only — they ran opportunistically
whenever a user happened to load a relevant page, with no real job runner
behind them. That meant a milestone or holdback with nobody visiting the
project could sit stale past its due date indefinitely.

This adds an actual periodic sweep, without pulling in a new dependency
(no APScheduler/Celery/etc): a single asyncio task, started in main.py's
startup hook and cancelled on shutdown, that wakes up every
MAINTENANCE_INTERVAL_SECONDS and processes every project/professional with
something due. The lazy per-request checks stay in place too as a fast path
so a user doesn't have to wait for the next sweep to see it happen live.
"""

import asyncio
import logging

from app.db.session import SessionLocal
from app.models.milestone import Milestone, MilestoneStatus
from app.models.project import Project
from app.services.auto_release import check_project_auto_release, release_due_withholds

logger = logging.getLogger("app.scheduler")

MAINTENANCE_INTERVAL_SECONDS = 15 * 60  # 15 minutes

def run_maintenance_once() -> None:
    """One full sweep: auto-release any submitted milestone past its review
    window, and release any payment-protection holdback past its date.
    Isolated per-project/per-professional try/except so one bad row can't
    stop the rest of the sweep, matching the existing per-milestone
    resilience in auto_release.py."""
    db = SessionLocal()
    try:
        projects = (
            db.query(Project)
            .join(Milestone, Milestone.project_id == Project.id)
            .filter(Milestone.status.in_([MilestoneStatus.funded, MilestoneStatus.approved]))
            .filter(Milestone.submitted_at.isnot(None))
            .distinct()
            .all()
        )
        for project in projects:
            try:
                check_project_auto_release(db, project)
            except Exception:
                logger.exception("auto-release sweep failed for project %s", project.id)
                db.rollback()

        professional_ids = [
            row[0]
            for row in (
                db.query(Project.assigned_professional_id)
                .join(Milestone, Milestone.project_id == Project.id)
                .filter(
                    Milestone.withheld_amount.isnot(None),
                    Milestone.withheld_amount > 0,
                    Milestone.withheld_released_at.is_(None),
                    Project.assigned_professional_id.isnot(None),
                )
                .distinct()
                .all()
            )
        ]
        for professional_id in professional_ids:
            try:
                release_due_withholds(db, professional_id)
            except Exception:
                logger.exception("withholding-release sweep failed for professional %s", professional_id)
                db.rollback()
    finally:
        db.close()

async def maintenance_loop(interval_seconds: int = MAINTENANCE_INTERVAL_SECONDS) -> None:
    while True:
        try:
            await asyncio.to_thread(run_maintenance_once)
        except Exception:
            logger.exception("scheduled maintenance sweep crashed")
        await asyncio.sleep(interval_seconds)
