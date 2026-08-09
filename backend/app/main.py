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

app = FastAPI(title=settings.PROJECT_NAME, openapi_url=f"{settings.API_V1_PREFIX}/openapi.json")
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


@app.on_event("startup")
def on_startup():
    # Startup failures on Render have been showing up as a bare "Exited with
    # status 3" with no visible traceback (likely stdout buffering combined
    # with how Uvicorn's lifespan handler surfaces the error). Wrap each
    # step individually, force-flush, and re-raise so the failure is both
    # loud in the logs AND still fails the deploy/health check as it should.
    try:
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
    return {"name": settings.PROJECT_NAME, "status": "ok", "docs": "/docs"}


@app.get("/health")
def health():
    return {"status": "ok"}


app.include_router(api_router, prefix=settings.API_V1_PREFIX)
