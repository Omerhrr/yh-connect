"""Username normalization, validation, and suggestion helpers."""

import re
import secrets

from sqlalchemy.orm import Session

from app.models.user import User

USERNAME_RE = re.compile(r"^[a-z0-9_]{3,20}$")


def normalize_username(raw: str) -> str:
    return raw.strip().lower()


def is_valid_username(username: str) -> bool:
    return bool(USERNAME_RE.match(username))


def is_username_taken(db: Session, username: str, exclude_user_id: str | None = None) -> bool:
    query = db.query(User).filter(User.username == username)
    if exclude_user_id:
        query = query.filter(User.id != exclude_user_id)
    return query.first() is not None


def _base_candidates(first_name: str, last_name: str) -> list[str]:
    first = re.sub(r"[^a-z0-9]", "", first_name.lower())
    last = re.sub(r"[^a-z0-9]", "", last_name.lower())
    candidates = []
    if first and last:
        candidates += [f"{first}{last}", f"{first}.{last}".replace(".", "_"), f"{first[0]}{last}"]
    if first:
        candidates.append(first)
    if last:
        candidates.append(last)
    # Dedupe, keep order, drop anything too short/long for the regex.
    seen: list[str] = []
    for c in candidates:
        c = c[:20]
        if len(c) >= 3 and c not in seen:
            seen.append(c)
    return seen


def suggest_usernames(db: Session, first_name: str, last_name: str, count: int = 5) -> list[str]:
    """Generate available username suggestions from a name. Tries clean
    variants first (johndoe, john_doe, jdoe, john), then falls back to
    appending random digits to the best candidate until enough are free."""
    suggestions: list[str] = []
    candidates = _base_candidates(first_name, last_name) or ["user"]

    for base in candidates:
        if len(suggestions) >= count:
            break
        if not is_username_taken(db, base):
            suggestions.append(base)

    primary = candidates[0]
    attempts = 0
    while len(suggestions) < count and attempts < 25:
        attempts += 1
        suffix = "".join(secrets.choice("0123456789") for _ in range(3))
        candidate = f"{primary[:16]}{suffix}"
        if candidate not in suggestions and not is_username_taken(db, candidate):
            suggestions.append(candidate)

    return suggestions[:count]
