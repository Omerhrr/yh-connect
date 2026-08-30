# YH Connect API (FastAPI backend)

Backend for YH Connect — a marketplace connecting clients with construction professionals
(architects, civil/structural engineers, contractors, MEP, quantity surveyors, and related trades).

## Stack
- FastAPI + SQLAlchemy 2.0
- SQLite by default for local dev (zero setup); PostgreSQL supported via `DATABASE_URL`
- JWT auth (python-jose + passlib/bcrypt)

## Setup

```bash
cd backend
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env        # edit DATABASE_URL / SECRET_KEY as needed
uvicorn app.main:app --reload --port 8000
```

The app runs pending Alembic migrations and seeds the construction category
taxonomy automatically on startup — see **Database & migrations** below.

API docs: http://localhost:8000/docs

## Using PostgreSQL

1. Create a database: `createdb yhconnect`
2. In `.env`, set:
   `DATABASE_URL=postgresql+psycopg2://USER:PASSWORD@localhost:5432/yhconnect`
3. Restart the server — migrations run automatically against the new database.

## Database & migrations

Schema is managed with [Alembic](https://alembic.sqlalchemy.org/), not
`create_all`. On every app startup, `run_migrations()`
(`app/db/run_migrations.py`) runs `alembic upgrade head` automatically
against whatever `DATABASE_URL` points to — no manual step needed for local
dev, just start the server.

**If you have a database from before Alembic was added** (tables already
exist but there's no `alembic_version` table), the first startup detects
this and stamps it at the current head instead of trying to re-create
existing tables. This is automatic and only matters once.

### Making schema changes

1. Edit the relevant model(s) under `app/models/`.
2. Generate a migration: `alembic revision --autogenerate -m "short description"`
3. Review the generated file under `migrations/versions/` — autogenerate
   doesn't always get things like column renames right, so check the diff.
4. Commit the migration alongside the model change. It applies automatically
   next time the app starts (or run `alembic upgrade head` manually).

### Useful commands

```bash
alembic current       # currently applied revision
alembic history        # all migrations
alembic upgrade head   # apply all pending migrations
alembic downgrade -1    # roll back the most recent migration
alembic stamp head      # mark the DB as up to date without running DDL
```

## Key endpoints

- `POST /api/v1/auth/register/client` — client signup
- `POST /api/v1/auth/register/professional` — professional signup (with title/category/skills)
- `POST /api/v1/auth/login` — returns JWT
- `GET  /api/v1/auth/me` — current user
- `GET  /api/v1/categories` — construction category taxonomy
- `GET  /api/v1/professionals` — browse/filter professionals
- `GET  /api/v1/projects` — browse open projects
- `POST /api/v1/projects` — post a project (client only)
- `POST /api/v1/projects/{id}/bids` — submit a proposal (professional only)
- `PATCH /api/v1/bids/{id}` — accept/reject a proposal (client only)
- `GET/POST /api/v1/messages` — simple messaging
- `POST /api/v1/reviews` — leave a review after project completion

## Payments (Monnify)

Escrow-style payments run through Monnify (`app/services/monnify.py`),
currently in **simulated mode** until real API credentials are set in
`.env` (`MONNIFY_API_KEY`, `MONNIFY_SECRET_KEY`, `MONNIFY_CONTRACT_CODE`,
`MONNIFY_WEBHOOK_SECRET`). In simulated mode, funding/disbursement calls
succeed immediately without hitting Monnify's API — enough to exercise the
full milestone → fund → approve → release flow end to end in development.

## Notes / next steps

See `../docs/platform-hardening-plan.md` for the current build plan
(routing migration for a real back button, admin panel + CMS, deferred
marketplace features). Monnify activation with live keys is intentionally
excluded from that plan until the team is ready.
