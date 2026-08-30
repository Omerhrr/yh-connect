"use client";

import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";
import { useAuth } from "@/store/auth";
import { useAuthGuard } from "@/hooks/useAuthGuard";
import { DashboardShell } from "@/components/site/dashboard/DashboardShell";
import { ADMIN_NAV } from "@/components/site/dashboard/navConfig";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const isLoginPage = pathname === "/admin/login";
  const { ready, user } = useAuthGuard("admin", "/admin/login", !isLoginPage);
  const logout = useAuth((s) => s.logout);

  if (isLoginPage) {
    return <>{children}</>;
  }

  if (!ready) {
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

  return (
    <DashboardShell
      role="admin"
      rootHref="/admin"
      navItems={ADMIN_NAV}
      name={user ? `${user.first_name} ${user.last_name}` : "Admin"}
      email={user?.email || ""}
      avatarUrl={user?.avatar_url}
      settingsHref="/admin/settings"
      onLogout={handleLogout}
    >
      {children}
    </DashboardShell>
  );
}
