import logging
import os
import sys
import traceback

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from slowapi.errors import RateLimitExceeded
from slowapi import _rate_limit_exceeded_handler

from app.api.v1.router import api_router
from app.core.config import settings
from app.core.limiter import limiter
from app.db.run_migrations import run_migrations
from app.seed import run as seed_categories
import app.models  # noqa: F401 ensures all models are registered on Base

logger = logging.getLogger("app.startup")

# Interactive docs/schema are useful in dev but are minor information
# disclosure of the whole API surface in production, gate them behind ENV.
_docs_enabled = not settings.is_production
app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_PREFIX}/openapi.json" if _docs_enabled else None,
    docs_url="/docs" if _docs_enabled else None,
    redoc_url="/redoc" if _docs_enabled else None,
)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    # In dev the frontend sometimes lands on a different port than 3000
    # (e.g. when something else is already squatting on it), accept any
    # localhost/127.0.0.1 port so that doesn't silently turn into a CORS
    # block. Static allow_origins above still applies for anything else
    # (e.g. a deployed frontend origin from BACKEND_CORS_ORIGINS).
    allow_origin_regex=r"http://(localhost|127\.0\.0\.1):\d+",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _check_production_config():
    """Fail loudly (or at least loudly warn) instead of silently running a
    real deployment with insecure/simulated defaults. See
    docs/AUDIT_2026-08-20.md findings #3 and #4."""
    if not settings.is_production:
        return
    if settings.SECRET_KEY == "dev-secret-change-me":
        # JWTs (including admin tokens) are signed with this well-known
        # string, forgeable by anyone. There's no legitimate reason for this
        # to still be the default in production, and Render's blueprint
        # already auto-generates a real one, so refuse to boot.
        raise RuntimeError(
            "SECRET_KEY is still the default dev value in a production "
            "environment (ENV=production). Set a real SECRET_KEY before "
            "starting the app."
        )
    if not settings.monnify_configured:
        logger.warning(
            "PRODUCTION WARNING: Monnify is not configured (MONNIFY_API_KEY/"
            "SECRET_KEY/CONTRACT_CODE unset). Wallet top-ups will simulate "
            "success and credit balance with no real payment taking place, "
            "and any syntactically valid NIN will auto-verify identity "
            "(Tier 2) with no real check taking place."
        )
    # NIN identity verification now goes through Monnify (see above) rather
    # than a separate VerifyMe contract, so there's no second credential to
    # check here — the monnify_configured warning above covers both payments
    # and NIN verification going unconfigured.


@app.on_event("startup")
def on_startup():
    # Startup failures on Render have been showing up as a bare "Exited with
    # status 3" with no visible traceback (likely stdout buffering combined
    # with how Uvicorn's lifespan handler surfaces the error). Wrap each
    # step individually, force-flush, and re-raise so the failure is both
    # loud in the logs AND still fails the deploy/health check as it should.
    try:
        logger.info("startup: checking production config...")
        _check_production_config()
        logger.info("startup: running migrations...")
        run_migrations()
        logger.info("startup: migrations complete, seeding categories...")
        seed_categories()
        logger.info("startup: seed complete, mounting uploads dir...")
        os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
        app.mount("/uploads", StaticFiles(directory=settings.UPLOAD_DIR), name="uploads")
        logger.info("startup: complete.")
    except Exception:
        traceback.print_exc(file=sys.stderr)
        sys.stderr.flush()
        sys.stdout.flush()
        logger.exception("startup failed")
        raise


@app.get("/")
def root():
    return {"name": settings.PROJECT_NAME, "status": "ok", "docs": "/docs" if _docs_enabled else None}


@app.get("/health")
def health():
    return {"status": "ok"}


app.include_router(api_router, prefix=settings.API_V1_PREFIX)
