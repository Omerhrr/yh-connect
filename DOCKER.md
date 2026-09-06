# Running YH Connect with Docker

This repo builds and runs as four containers: Postgres, the FastAPI backend,
the Next.js frontend, and Caddy (reverse proxy + automatic HTTPS). One
compose file, one env file — `docker compose up -d` and you're done.

## What's here

- `backend/Dockerfile` — the API image (Python 3.11, installs `requirements.txt`, runs `uvicorn`). Migrations run automatically on container start (same as today — see `app/main.py`'s startup hook), so there's no separate migration step to remember.
- `Dockerfile` (repo root) — the frontend image. Multi-stage build using Next's `output: "standalone"` mode, so the final image only ships the server bundle and the node_modules it actually needs, not the whole `node_modules` tree.
- `docker-compose.yml` — all four services. Only `caddy` is published to the host (80/443); `db`/`api`/`web` only talk to each other over Docker's internal network. Caddy handles TLS automatically via Let's Encrypt — no certbot, no manual cert renewal.
- `Caddyfile` — Caddy's config; routes `/api/*` and `/uploads/*` to the backend, everything else to the frontend.
- `.env.example` — every environment variable compose reads, with comments. Copy to `.env` and fill in real values — Docker Compose auto-loads a file literally named `.env` in this directory, so no `--env-file` flag is ever needed.

## Build and run

```bash
cp .env.example .env
# edit .env — at minimum set POSTGRES_PASSWORD, SECRET_KEY, and your domain
# (BACKEND_CORS_ORIGINS / FRONTEND_BASE_URL / PUBLIC_BASE_URL / NEXT_PUBLIC_API_URL)

# edit Caddyfile — replace yourdomain.example with your real domain
# (make sure its DNS A record already points at this machine before starting,
# Caddy requests a Let's Encrypt cert on first start)

docker compose up -d --build
```

Everyday commands from here on — no flags, no `-f`, no `--env-file`:

```bash
docker compose ps                 # status of all 4 containers
docker compose logs -f caddy       # watch the cert get issued, then tail logs
docker compose logs -f api         # backend logs
docker compose restart api         # restart one service
docker compose down                # stop (keeps volumes — data survives)
docker compose down -v             # stop AND wipe all data (fresh start)
```

Rebuild after changing code:

```bash
docker compose up -d --build
```

Postgres data persists in the `db_data` named volume; uploaded files persist in `api_uploads`.

## First admin account

The backend has a one-off bootstrap endpoint for creating the first admin
account, gated behind `SEED_SECRET`. Set `SEED_SECRET` to a random string in
`.env`, hit the endpoint once, then clear the value again (and restart the
`api` container) to close the door:

```bash
curl "https://yourdomain.example/api/v1/internal/seed?secret=whatever-you-set-SEED_SECRET-to&admin_email=you@yourcompany.com&admin_password=..."
```

It's a plain `GET` with query params (see `backend/app/api/v1/internal.py`),
so you can also just paste that URL into a browser. Add `&demo=true` to also
seed demo clients/professionals/projects, or `&reset_password=true` to reset
the password on an existing admin account instead of leaving it untouched.

Then:
```bash
# clear SEED_SECRET in .env
docker compose restart api
```

## Updating a running deployment

```bash
git pull
docker compose up -d --build
```

Compose only rebuilds/restarts the services whose image actually changed, so
this is safe to run after every deploy.

## Backups

Postgres data lives in the `db_data` named volume. A simple periodic backup:

```bash
docker compose exec db pg_dump -U yhconnect yhconnect | gzip > backup-$(date +%F).sql.gz
```

Uploaded files (ID documents, portfolio images, etc.) live in the
`api_uploads` volume — back that up too if it matters
(`docker run --rm -v yh-connect_api_uploads:/data -v $(pwd):/backup alpine tar czf /backup/uploads-$(date +%F).tar.gz -C /data .`,
adjusting the volume name to whatever `docker volume ls` shows).

## What's not covered here

This only dockerizes the app itself. Things like firewall rules, SSH
hardening, log shipping/monitoring, and the actual VPS provisioning are
separate VPS-setup work, not part of this change.
