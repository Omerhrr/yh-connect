"""Staff management (full admins only; the /admin/staff path is super-only in
app/services/staff_access.py): custom roles with granular permissions, and
staff logins assigned to those roles."""

import secrets
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.deps import require_role
from app.core.security import hash_password
from app.db.session import get_db
from app.models.admin_role import AdminRole
from app.models.user import User, UserRole
from app.services.staff_access import AREAS, LEVELS, valid_permissions

router = APIRouter(prefix="/admin/staff", tags=["admin-staff"])


class RoleIn(BaseModel):
    name: str
    description: Optional[str] = None
    permissions: list[str] = []


class MemberCreate(BaseModel):
    email: str
    first_name: str
    last_name: str
    role_id: Optional[str] = None  # None = full admin


class MemberUpdate(BaseModel):
    role_id: Optional[str] = None
    set_full_admin: bool = False
    is_active: Optional[bool] = None
    reset_password: bool = False


def _role_out(r: AdminRole, db: Session) -> dict:
    members = db.query(User).filter(User.role == UserRole.admin, User.admin_role_id == r.id).count()
    return {
        "id": r.id, "name": r.name, "description": r.description or "",
        "permissions": r.permissions or [], "member_count": members,
    }


def _member_out(u: User) -> dict:
    return {
        "id": u.id, "email": u.email, "first_name": u.first_name, "last_name": u.last_name,
        "is_active": u.is_active, "role_id": u.admin_role_id,
        "role_name": u.admin_role_name, "is_full_admin": not u.admin_role_id,
        "created_at": u.created_at,
    }


@router.get("/catalog")
def catalog(current_user: User = Depends(require_role(UserRole.admin))):
    return {
        "areas": [{"key": k, "label": v[0], "description": v[1]} for k, v in AREAS.items()],
        "levels": list(LEVELS),
    }


@router.get("/roles")
def list_roles(current_user: User = Depends(require_role(UserRole.admin)), db: Session = Depends(get_db)):
    return [_role_out(r, db) for r in db.query(AdminRole).order_by(AdminRole.name).all()]


@router.post("/roles", status_code=201)
def create_role(payload: RoleIn, current_user: User = Depends(require_role(UserRole.admin)), db: Session = Depends(get_db)):
    name = payload.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Give the role a name")
    if db.query(AdminRole).filter(AdminRole.name.ilike(name)).first():
        raise HTTPException(status_code=409, detail="A role with that name already exists")
    perms = valid_permissions(payload.permissions)
    if not perms:
        raise HTTPException(status_code=400, detail="Pick at least one permission")
    r = AdminRole(name=name, description=(payload.description or "").strip() or None, permissions=perms)
    db.add(r)
    db.commit()
    db.refresh(r)
    return _role_out(r, db)


@router.put("/roles/{role_id}")
def update_role(role_id: str, payload: RoleIn, current_user: User = Depends(require_role(UserRole.admin)), db: Session = Depends(get_db)):
    r = db.get(AdminRole, role_id)
    if not r:
        raise HTTPException(status_code=404, detail="Role not found")
    name = payload.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Give the role a name")
    clash = db.query(AdminRole).filter(AdminRole.name.ilike(name), AdminRole.id != r.id).first()
    if clash:
        raise HTTPException(status_code=409, detail="A role with that name already exists")
    perms = valid_permissions(payload.permissions)
    if not perms:
        raise HTTPException(status_code=400, detail="Pick at least one permission")
    r.name = name
    r.description = (payload.description or "").strip() or None
    r.permissions = perms
    db.commit()
    db.refresh(r)
    return _role_out(r, db)


@router.delete("/roles/{role_id}", status_code=204)
def delete_role(role_id: str, current_user: User = Depends(require_role(UserRole.admin)), db: Session = Depends(get_db)):
    r = db.get(AdminRole, role_id)
    if not r:
        raise HTTPException(status_code=404, detail="Role not found")
    if db.query(User).filter(User.admin_role_id == r.id).count():
        raise HTTPException(status_code=400, detail="Reassign the people on this role before deleting it")
    db.delete(r)
    db.commit()


@router.get("/members")
def list_members(current_user: User = Depends(require_role(UserRole.admin)), db: Session = Depends(get_db)):
    users = db.query(User).filter(User.role == UserRole.admin).order_by(User.created_at.asc()).all()
    return [_member_out(u) for u in users]


@router.post("/members", status_code=201)
def create_member(payload: MemberCreate, current_user: User = Depends(require_role(UserRole.admin)), db: Session = Depends(get_db)):
    email = payload.email.strip().lower()
    if "@" not in email:
        raise HTTPException(status_code=400, detail="Enter a valid email")
    if db.query(User).filter(User.email.ilike(email)).first():
        raise HTTPException(status_code=409, detail="An account with this email already exists")
    if payload.role_id and not db.get(AdminRole, payload.role_id):
        raise HTTPException(status_code=404, detail="Role not found")
    temp_password = secrets.token_urlsafe(9)
    u = User(
        email=email,
        hashed_password=hash_password(temp_password),
        first_name=payload.first_name.strip(),
        last_name=payload.last_name.strip(),
        role=UserRole.admin,
        is_verified=True,
        email_verified_at=datetime.utcnow(),
        admin_role_id=payload.role_id or None,
    )
    db.add(u)
    db.commit()
    db.refresh(u)
    # Shown to the creating admin once; never stored in clear text.
    return {**_member_out(u), "temporary_password": temp_password}


@router.patch("/members/{user_id}")
def update_member(user_id: str, payload: MemberUpdate, current_user: User = Depends(require_role(UserRole.admin)), db: Session = Depends(get_db)):
    u = db.get(User, user_id)
    if not u or u.role != UserRole.admin:
        raise HTTPException(status_code=404, detail="Staff member not found")

    is_self = u.id == current_user.id
    was_full = not u.admin_role_id
    extra: dict = {}
    changed_access = False

    if payload.set_full_admin or payload.role_id is not None:
        if is_self:
            raise HTTPException(status_code=400, detail="You can't change your own access")
        if payload.role_id:
            if not db.get(AdminRole, payload.role_id):
                raise HTTPException(status_code=404, detail="Role not found")
            u.admin_role_id = payload.role_id
        else:
            u.admin_role_id = None
        changed_access = True

    if payload.is_active is not None:
        if is_self and not payload.is_active:
            raise HTTPException(status_code=400, detail="You can't deactivate your own account")
        u.is_active = payload.is_active
        changed_access = True

    if payload.reset_password:
        temp_password = secrets.token_urlsafe(9)
        u.hashed_password = hash_password(temp_password)
        extra["temporary_password"] = temp_password
        changed_access = True

    # Never leave the platform without an active full admin.
    if was_full and (u.admin_role_id or not u.is_active):
        others = (
            db.query(User)
            .filter(User.role == UserRole.admin, User.admin_role_id.is_(None), User.is_active.is_(True), User.id != u.id)
            .count()
        )
        if others == 0:
            db.rollback()
            raise HTTPException(status_code=400, detail="There must always be at least one active full admin")

    if changed_access:
        u.token_version = (u.token_version or 0) + 1  # forces a fresh sign-in
    db.commit()
    db.refresh(u)
    return {**_member_out(u), **extra}
