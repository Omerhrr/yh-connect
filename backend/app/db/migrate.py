"""Lightweight, idempotent schema-sync for SQLite dev databases.

This project doesn't use Alembic. `Base.metadata.create_all()` (called on
startup) only creates tables that don't exist yet, it never adds columns to
tables that already exist. Since models get new fields over time, an existing
local `yhconnect.db` can drift out of sync and start throwing
`OperationalError: no such column: ...` at request time.

`sync_missing_columns` inspects the live database, compares each model's
columns against what's actually there, and issues `ALTER TABLE ... ADD
COLUMN` for anything missing. Safe to run on every startup, it's a no-op
once the schema is caught up. This is a dev convenience, not a substitute for
a real migration tool if this project grows past SQLite.
"""

import logging

from sqlalchemy import inspect, text
from sqlalchemy.engine import Engine

from app.db.base import Base

logger = logging.getLogger(__name__)

def sync_missing_columns(engine: Engine) -> None:
    inspector = inspect(engine)
    existing_tables = set(inspector.get_table_names())

    for table in Base.metadata.sorted_tables:
        if table.name not in existing_tables:

            continue

        existing_cols = {c["name"] for c in inspector.get_columns(table.name)}
        missing = [col for col in table.columns if col.name not in existing_cols]
        if not missing:
            continue

        with engine.begin() as conn:
            for column in missing:
                try:
                    coltype = column.type.compile(dialect=engine.dialect)
                except Exception:
                    coltype = "TEXT"

                default_sql = ""
                default = column.default
                if default is not None and getattr(default, "is_scalar", False):
                    val = default.arg
                    if isinstance(val, bool):
                        default_sql = f" DEFAULT {1 if val else 0}"
                    elif isinstance(val, (int, float)):
                        default_sql = f" DEFAULT {val}"
                    elif isinstance(val, str):
                        escaped = val.replace("'", "''")
                        default_sql = f" DEFAULT '{escaped}'"

                ddl = f'ALTER TABLE "{table.name}" ADD COLUMN "{column.name}" {coltype}{default_sql}'
                try:
                    conn.execute(text(ddl))
                    logger.info("Migrated: %s", ddl)
                except Exception as exc:
                    logger.warning("Could not add column %s.%s: %s", table.name, column.name, exc)
