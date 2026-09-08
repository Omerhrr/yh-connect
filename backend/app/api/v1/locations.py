from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.deps import require_role
from app.data.nigeria_states import STATE_LGAS, STATE_NAMES
from app.db.session import get_db
from app.models.state_setting import StateSetting
from app.models.user import User, UserRole

router = APIRouter(prefix="/locations", tags=["locations"])


class StateOut(BaseModel):
    name: str
    active: bool

    class Config:
        from_attributes = True


def _ensure_seeded(db: Session) -> list[StateSetting]:
    existing = {s.name: s for s in db.query(StateSetting).all()}
    changed = False
    for name in STATE_NAMES:
        if name not in existing:
            row = StateSetting(name=name, active=(name == "Kaduna"))
            db.add(row)
            existing[name] = row
            changed = True
    if changed:
        db.commit()
    return [existing[n] for n in STATE_NAMES]


@router.get("/states", response_model=list[StateOut])
def list_states(db: Session = Depends(get_db)):
    """Public: all Nigerian states + FCT, with their active flag."""
    return _ensure_seeded(db)


@router.get("/states/active", response_model=list[StateOut])
def list_active_states(db: Session = Depends(get_db)):
    """Public: only the states currently selectable by users."""
    rows = _ensure_seeded(db)
    return [r for r in rows if r.active]


@router.get("/states/{state}/lgas", response_model=list[str])
def list_lgas(state: str, db: Session = Depends(get_db)):
    """Public: local government areas for a given (active) state."""
    row = db.get(StateSetting, state)
    if not row or not row.active:
        raise HTTPException(status_code=404, detail="State not found or not active")
    lgas = STATE_LGAS.get(state)
    if lgas is None:
        raise HTTPException(status_code=404, detail="State not found")
    return lgas


# --- Admin ---

admin_router = APIRouter(prefix="/admin/states", tags=["admin"])


class StateToggleIn(BaseModel):
    active: bool


@admin_router.get("", response_model=list[StateOut])
def admin_list_states(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.admin)),
):
    return _ensure_seeded(db)


@admin_router.patch("/{state}", response_model=StateOut)
def admin_toggle_state(
    state: str,
    payload: StateToggleIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.admin)),
):
    row = db.get(StateSetting, state)
    if not row:
        raise HTTPException(status_code=404, detail="Unknown state")
    row.active = payload.active
    db.commit()
    db.refresh(row)
    return row
