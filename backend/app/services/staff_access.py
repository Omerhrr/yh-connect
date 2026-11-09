"""Staff roles & permissions for the admin area.

Permissions are strings "area:view" or "area:manage" ("manage" implies "view").
A full admin (no role assigned) can do everything. A restricted staff member
can only reach the admin API areas their role grants, enforced centrally in
`get_current_user` by matching the request path, so no individual endpoint can
forget to check. Any /admin path that isn't mapped below is treated as
super-admin-only, so new admin endpoints are locked down by default.
"""

from fastapi import HTTPException

from app.models.user import User, UserRole

# key -> (label, description)
AREAS: dict[str, tuple[str, str]] = {
    "analytics": ("Overview & analytics", "Dashboard numbers and analytics."),
    "users": ("Users", "Client and professional accounts, suspensions, wallet adjustments."),
    "verifications": ("Verifications", "Identity, address, business and certification reviews."),
    "verifier_portal": ("Verifier portal", "Issuing bodies and their verifier logins."),
    "disputes": ("Disputes", "View and resolve disputes."),
    "contracts": ("Contracts", "Contract oversight and nudges."),
    "projects": ("Projects", "All projects and cancellations."),
    "payments": ("Payments", "Wallet transactions and summaries."),
    "ledger": ("Ledger", "Double-entry ledger."),
    "content": ("Content", "Pages, blog, FAQ, highlights, categories, announcements."),
    "settings": ("Settings", "Fees, tiers, policies, states, receipts, acceptance fee."),
}

LEVELS = ("view", "manage")

# (path prefix after /api/v1, area). First match wins; more specific first.
_PATH_AREAS: list[tuple[str, str]] = [
    ("/admin/analytics", "analytics"),
    ("/admin/users", "users"),
    ("/admin/announcements", "content"),
    ("/admin/verifications", "verifications"),
    ("/admin/address-verifications", "verifications"),
    ("/admin/certifications", "verifications"),
    ("/admin/business-verifications", "verifications"),
    ("/admin/verifier-portal", "verifier_portal"),
    ("/admin/disputes", "disputes"),
    ("/disputes", "disputes"),
    ("/admin/contracts", "contracts"),
    ("/admin/projects", "projects"),
    ("/admin/wallet", "payments"),
    ("/admin/ledger", "ledger"),
    ("/admin/site-content", "content"),
    ("/admin/content", "content"),
    ("/admin/categories", "content"),
    ("/admin/settings", "settings"),
    ("/admin/receipt-settings", "settings"),
    ("/admin/project-media-settings", "settings"),
    ("/admin/states", "settings"),
]

SUPER_ONLY = "__super__"


def area_for_path(path: str, api_prefix: str) -> str | None:
    """Which area a request path belongs to; None = not an admin-gated path."""
    p = path
    if api_prefix and p.startswith(api_prefix):
        p = p[len(api_prefix):]
    p = p.rstrip("/") or "/"
    for prefix, area in _PATH_AREAS:
        if p == prefix or p.startswith(prefix + "/"):
            return area
    if p == "/admin" or p.startswith("/admin/"):
        return SUPER_ONLY  # staff management, admin registration, anything unmapped
    return None


def valid_permissions(perms: list[str]) -> list[str]:
    """Normalise a submitted permission list: drop unknowns, make 'manage'
    imply 'view', de-duplicate, keep a stable order."""
    out: set[str] = set()
    for perm in perms or []:
        area, _, level = perm.partition(":")
        if area in AREAS and level in LEVELS:
            out.add(f"{area}:{level}")
            if level == "manage":
                out.add(f"{area}:view")
    return sorted(out)


def enforce(user: User, method: str, path: str, api_prefix: str) -> None:
    """Raise 403 if this restricted staff member may not make this request."""
    if user.role != UserRole.admin or not user.admin_role_id:
        return  # not an admin, or a full admin
    area = area_for_path(path, api_prefix)
    if area is None:
        return
    if area == SUPER_ONLY:
        raise HTTPException(status_code=403, detail="This area is restricted to full administrators")
    needed = "view" if method.upper() in ("GET", "HEAD", "OPTIONS") else "manage"
    perms = set(user.admin_permissions or [])
    if f"{area}:{needed}" not in perms:
        raise HTTPException(
            status_code=403,
            detail=f"Your role doesn't have {needed} access to {AREAS[area][0]}",
        )
