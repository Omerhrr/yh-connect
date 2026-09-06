# Running YH Connect with Docker

This repo now builds and runs as three containers: Postgres, the FastAPI
backend, and the Next.js frontend. This doc covers building/running locally
with Docker Compose, and deploying that same setup on the VPS.

## What's here

- `backend/Dockerfile` — the API image (Python 3.11, installs `requirements.txt`, runs `uvicorn`). Migrations run automatically on container start (same as today — see `app/main.py`'s startup hook), so there's no separate migration step to remember.
- `Dockerfile` (repo root) — the frontend image. Multi-stage build using Next's `output: "standalone"` mode, so the final image only ships the server bundle and the node_modules it actually needs, not the whole `node_modules` tree.
- `docker-compose.yml` — Postgres + api + web, ports published directly to the host (`8000`, `3000`). No TLS, no reverse proxy. Good for local dev or a first smoke test.
- `docker-compose.prod.yml` — the VPS version. Same three services, but `api`/`web` aren't published to the host at all — a `caddy` service is the only thing listening on 80/443, and it reverse-proxies to `web` and `api` over Docker's internal network. Caddy also handles TLS automatically (Let's Encrypt) — no certbot, no manual cert renewal.
- `Caddyfile` — Caddy's config; routes `/api/*` and `/uploads/*` to the backend, everything else to the frontend.
- `.env.docker.example` — every environment variable both compose files read, with comments. Copy to `.env.docker` and fill in real values (that file is gitignored).

## Local: build and run

```bash
cp .env.docker.example .env.docker
# edit .env.docker — at minimum set POSTGRES_PASSWORD and SECRET_KEY

docker compose --env-file .env.docker up -d --build
```

- Frontend: http://localhost:3000
- Backend: http://localhost:8000 (docs at `/docs` since `ENV` defaults to `production` in the compose file — set `ENV=development` in `.env.docker` if you want the interactive API docs and full CORS-from-localhost behavior during local testing)
- Postgres data persists in the `db_data` named volume; uploaded files persist in `api_uploads`.

Rebuild after changing code:

```bash
docker compose --env-file .env.docker up -d --build
```

Tear down (keeps volumes, so data survives):

```bash
docker compose down
```

Tear down and wipe all data (fresh database, fresh uploads):

```bash
docker compose down -v
```

## First admin account

The backend has a one-off bootstrap endpoint for creating the first admin
account, gated behind `SEED_SECRET` (same pattern as the current Render
deploy). Set `SEED_SECRET` to a random string in `.env.docker`, hit the
endpoint once, then clear the value again (and restart the `api` container)
to close the door:

```bash
curl "http://localhost:8000/api/v1/internal/seed?secret=whatever-you-set-SEED_SECRET-to&admin_email=you@yourcompany.com&admin_password=..."
```

It's a plain `GET` with query params (see `backend/app/api/v1/internal.py`),
so you can also just paste that URL into a browser. Add `&demo=true` to also
seed demo clients/professionals/projects, or `&reset_password=true` to reset
the password on an existing admin account instead of leaving it untouched.

## Deploying on the VPS

1. **Point DNS at the VPS first.** Create an A record for your domain pointing at the VPS's IP, and make sure it's resolving before starting Caddy — Caddy requests a Let's Encrypt certificate on first start and that requires the domain to already point at this machine.
2. **Install Docker + Compose plugin** on the VPS (`curl -fsSL https://get.docker.com | sh`, then `apt install docker-compose-plugin` or equivalent — exact steps depend on the distro).
3. **Copy the repo to the VPS** (git clone, or push+pull, or `scp` — whatever the team's normal deploy flow is; this doesn't change based on Docker).
4. **Edit `Caddyfile`**: replace `yourdomain.example` with the real domain.
5. **Set up `.env.docker`** on the VPS with real production values:
   ```
   BACKEND_CORS_ORIGINS=["https://yourdomain.example"]
   FRONTEND_BASE_URL=https://yourdomain.example
   PUBLIC_BASE_URL=https://yourdomain.example
   NEXT_PUBLIC_API_URL=https://yourdomain.example/api/v1
   ```
   Plus a real `SECRET_KEY`, `POSTGRES_PASSWORD`, and (when ready) the Resend/Monnify credentials — see `docker-compose.prod.yml`'s required (`:?...`) vars for the full list; compose will refuse to start with a clear error if any are missing.
6. **Start it:**
   ```bash
   docker compose -f docker-compose.prod.yml --env-file .env.docker up -d --build
   ```
7. **Create the first admin account** the same way as above, just against `https://yourdomain.example/api/v1/internal/seed`, then clear `SEED_SECRET` and restart the `api` service (`docker compose -f docker-compose.prod.yml restart api`).

### Updating a running deployment

```bash
git pull
docker compose -f docker-compose.prod.yml --env-file .env.docker up -d --build
```

Compose only rebuilds/restarts the services whose image actually changed, so
this is safe to run after every deploy.

### Backups

Postgres data lives in the `db_data` named volume. A simple periodic backup:

```bash
docker compose -f docker-compose.prod.yml exec db \
  pg_dump -U yhconnect yhconnect | gzip > backup-$(date +%F).sql.gz
```

Uploaded files (ID documents, portfolio images, etc.) live in the
`api_uploads` volume — back that up too if it matters
(`docker run --rm -v yh-connect_api_uploads:/data -v $(pwd):/backup alpine tar czf /backup/uploads-$(date +%F).tar.gz -C /data .`,
adjusting the volume name to whatever `docker volume ls` shows).

## What's not covered here

This only dockerizes the app itself. Things like firewall rules, SSH
hardening, log shipping/monitoring, and the actual VPS provisioning are
separate VPS-setup work, not part of this change.
