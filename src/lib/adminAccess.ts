import type { UserOut } from "@/lib/api";

export type AdminArea =
  | "analytics" | "users" | "verifications" | "verifier_portal" | "disputes" | "contracts"
  | "projects" | "payments" | "ledger" | "content" | "settings" | "staff";

/** Which area each admin page belongs to ("staff" = full admins only). */
export const ADMIN_HREF_AREA: { href: string; area: AdminArea }[] = [
  { href: "/admin/analytics", area: "analytics" },
  { href: "/admin/verifications", area: "verifications" },
  { href: "/admin/verifier-portal", area: "verifier_portal" },
  { href: "/admin/disputes", area: "disputes" },
  { href: "/admin/contracts", area: "contracts" },
  { href: "/admin/payments", area: "payments" },
  { href: "/admin/ledger", area: "ledger" },
  { href: "/admin/users", area: "users" },
  { href: "/admin/projects", area: "projects" },
  { href: "/admin/content", area: "content" },
  { href: "/admin/team", area: "staff" },
  { href: "/admin/settings", area: "settings" },
  { href: "/admin", area: "analytics" }, // overview, keep last so prefixes match first
];

export function isFullAdmin(user?: UserOut | null): boolean {
  const p = user?.admin_permissions;
  return !!p && p.includes("*");
}

export function canAccess(user: UserOut | null | undefined, area: AdminArea, level: "view" | "manage" = "view"): boolean {
  if (!user || user.role !== "admin") return false;
  // A session saved before roles existed has no permissions field. Fail closed:
  // grant nothing until the profile is refreshed (the admin layout refreshes
  // on load and shows a spinner meanwhile).
  if (user.admin_permissions == null) return false;
  if (isFullAdmin(user)) return true;
  if (area === "staff") return false;
  return !!user.admin_permissions?.includes(`${area}:${level}`);
}

export function areaForPath(pathname: string): AdminArea | null {
  for (const { href, area } of ADMIN_HREF_AREA) {
    if (href === "/admin") {
      if (pathname === "/admin") return area;
      continue;
    }
    if (pathname === href || pathname.startsWith(href + "/")) return area;
  }
  return null;
}

export function firstAllowedHref(user: UserOut | null | undefined): string | null {
  for (const { href, area } of ADMIN_HREF_AREA) {
    if (canAccess(user, area)) return href;
  }
  return null;
}
