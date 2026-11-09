"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";
import { useAuth } from "@/store/auth";
import { useAuthGuard } from "@/hooks/useAuthGuard";
import { DashboardShell } from "@/components/site/dashboard/DashboardShell";
import { ADMIN_NAV } from "@/components/site/dashboard/navConfig";
import { areaForPath, canAccess, firstAllowedHref } from "@/lib/adminAccess";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const isLoginPage = pathname === "/admin/login";
  const { ready, user } = useAuthGuard("admin", "/admin/login", !isLoginPage);
  const logout = useAuth((s) => s.logout);
  const refreshMe = useAuth((s) => s.refreshMe);

  // Pull fresh permissions (a role may have changed since this session started).
  const [fresh, setFresh] = useState(false);
  useEffect(() => {
    if (ready && !isLoginPage) refreshMe().finally(() => setFresh(true));
  }, [ready, isLoginPage, refreshMe]);

  // Staff only see the sections their role grants; full admins see everything.
  const area = areaForPath(pathname || "");
  const allowed = !area || canAccess(user, area);
  const home = firstAllowedHref(user);

  useEffect(() => {
    // Landing on the overview without access to it? Go to the first section they do have.
    if (ready && user && pathname === "/admin" && !allowed && home && home !== "/admin") {
      router.replace(home);
    }
  }, [ready, user, pathname, allowed, home, router]);

  if (isLoginPage) {
    return <>{children}</>;
  }

  if (!ready || !fresh) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }

  const handleLogout = () => {
    logout();
    toast.success("Logged out successfully");
    router.push("/admin/login");
  };

  const navItems = ADMIN_NAV.filter((item) => {
    const a = areaForPath(item.href);
    return !a || canAccess(user, a);
  });

  return (
    <DashboardShell
      role="admin"
      rootHref={home || "/admin"}
      navItems={navItems}
      name={user ? `${user.first_name} ${user.last_name}` : "Admin"}
      email={user?.email || ""}
      avatarUrl={user?.avatar_url}
      settingsHref={canAccess(user, "settings") ? "/admin/settings" : (home || "/admin")}
      onLogout={handleLogout}
    >
      {allowed ? (
        children
      ) : (
        <div className="max-w-md mx-auto py-20 text-center space-y-3">
          <h1 className="text-xl font-bold">You don&apos;t have access to this section</h1>
          <p className="text-sm text-muted-foreground">
            Your role{user?.admin_role_name ? ` (${user.admin_role_name})` : ""} doesn&apos;t include it. Ask a full administrator if you need it.
          </p>
          {home && <Link href={home} className="text-sm text-primary hover:underline">Go to {home === "/admin" ? "overview" : "your dashboard"}</Link>}
        </div>
      )}
    </DashboardShell>
  );
}
