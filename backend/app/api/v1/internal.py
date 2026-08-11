"""One-off bootstrap endpoint for freshly deployed environments (e.g. a brand
new Render Postgres database that has categories but no admin/demo data yet).

Not something normal API consumers ever call, there's no other way to create
the very first admin account on a database you don't have shell access to,
so this trades a little REST purity for a simple, secret-gated GET request
you can trigger from a browser URL.

Locked down by design:
- Fails closed: if SEED_SECRET isn't set in the environment, the endpoint
  always 404s, so accidentally deploying without setting it does NOT leave
  an open door.
- Requires the secret to match exactly (constant-time compare).
- Safe to call more than once: creating the admin no-ops if that email
  already exists, and the demo-data seed only ever touches its own
  @pro.yhconnect.demo / @client.yhconnect.demo scoped rows.

Recommended: unset SEED_SECRET in the Render dashboard once you've used
this, to close it back up.
"""
import hmac
import traceback

from fastapi import APIRouter, HTTPException, Query

from app.core.config import settings
from app.core.security import hash_password
from app.db.session import SessionLocal
from app.models.user import User, UserRole

router = APIRouter(prefix="/internal", tags=["internal"])


def _check_secret(secret: str) -> None:
    if not settings.SEED_SECRET or not hmac.compare_digest(secret, settings.SEED_SECRET):
        raise HTTPException(status_code=404, detail="Not found")


@router.get("/seed")
def bootstrap_seed(
    secret: str = Query(...),
    admin_email: str = Query("admin@yhconnect.ng"),
    admin_password: str = Query("AdminPass123!"),
    demo: bool = Query(False, description="Also seed demo clients/professionals/projects"),
):
    _check_secret(secret)
    results: dict[str, str] = {}

    # Deliberately catching everything and returning it in the response body
    # (rather than letting it 500 into a bare "Internal Server Error") so the
    # real error is visible right in the browser, this has been hard to get
    # out of Render's log viewer for whatever reason.
    try:
        db = SessionLocal()
        try:
            existing = db.query(User).filter(User.email == admin_email).first()
            if existing:
                results["admin"] = f"already exists (role={existing.role.value}), left untouched"
            else:
                admin = User(
                    email=admin_email,
                    hashed_password=hash_password(admin_password),
                    first_name="Admin",
                    last_name="User",
                    role=UserRole.admin,
                    is_verified=True,
                    is_active=True,
                )
                db.add(admin)
                db.commit()
                results["admin"] = f"created: {admin_email} / {admin_password}"
        except Exception:
            db.rollback()
            raise
        finally:
            db.close()

        if demo:
            from app.seed_demo_users import run as seed_demo

            seed_demo()
            results["demo"] = "seeded (see backend/demo_credentials.csv on the instance, or check the API for the accounts)"
    except Exception as e:
        results["error"] = f"{type(e).__name__}: {e}"
        results["traceback"] = traceback.format_exc()

    return results
