"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useAuth } from "@/store/auth";
import { useAuthGuard } from "@/hooks/useAuthGuard";
import { DashboardShell } from "@/components/site/dashboard/DashboardShell";
import { TALENT_NAV } from "@/components/site/dashboard/navConfig";

export default function TalentDashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { ready, user } = useAuthGuard("professional", "/talent/login");
  const logout = useAuth((s) => s.logout);

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
    router.push("/");
  };

  return (
    <DashboardShell
      role="talent"
      rootHref="/talent/dashboard"
      navItems={TALENT_NAV}
      name={user ? `${user.first_name} ${user.last_name}` : "Professional"}
      email={user?.email || ""}
      avatarUrl={user?.avatar_url}
      profileHref="/talent/dashboard/profile"
      settingsHref="/talent/dashboard/settings"
      messagesHref="/talent/dashboard/messages"
      onLogout={handleLogout}
      emailVerified={user?.email_verified ?? true}
    >
      {children}
    </DashboardShell>
  );
}
