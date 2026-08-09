"""Run Alembic migrations programmatically on app startup.

Rather than requiring `alembic upgrade head` as a separate manual step in
dev, the FastAPI app runs migrations itself at startup, this keeps the old
"just start the server" workflow while getting real, versioned schema
management instead of the previous `create_all()` + column-sync hack
(see `app/db/migrate.py`, now unused/superseded by this).

One-time bootstrap wrinkle: any database created before this change (via
the old `Base.metadata.create_all()` path) already has all the tables the
baseline migration would create, but no `alembic_version` table to tell
Alembic that. Running `upgrade head` against it would try to `CREATE TABLE`
things that already exist and fail. So on first run against such a database,
we detect that case (no alembic_version table, but core tables already
present) and stamp it at head instead of upgrading, schema already matches
the baseline 1:1 since it was kept in sync via the old startup hack. Any
migration after the baseline runs normally as a real upgrade from then on.

In a deployed environment you'd more typically run `alembic upgrade head`
as an explicit release step before starting the app, but auto-upgrading on
startup is safe here too since migrations are additive and idempotent
(Alembic no-ops if already at head).
"""

import logging
import os

from alembic import command
from alembic.config import Config
from sqlalchemy import inspect

from app.db.session import engine

logger = logging.getLogger(__name__)

# backend/app/db/run_migrations.py -> backend/
_BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def _build_config() -> Config:
    ini_path = os.path.join(_BACKEND_DIR, "alembic.ini")
    cfg = Config(ini_path)
    cfg.set_main_option("script_location", os.path.join(_BACKEND_DIR, "migrations"))
    return cfg


def run_migrations() -> None:
    ini_path = os.path.join(_BACKEND_DIR, "alembic.ini")
    if not os.path.exists(ini_path):
        logger.warning("alembic.ini not found at %s, skipping migrations", ini_path)
        return

    cfg = _build_config()
    inspector = inspect(engine)
    existing_tables = set(inspector.get_table_names())

    if "alembic_version" not in existing_tables and "users" in existing_tables:
        # Pre-Alembic database (created via the old create_all/sync-columns
        # path), its schema already matches the baseline migration, so mark
        # it caught-up instead of trying to re-create existing tables.
        logger.info("Existing pre-Alembic database detected, stamping at head instead of upgrading.")
        command.stamp(cfg, "head")
        return

    command.upgrade(cfg, "head")
