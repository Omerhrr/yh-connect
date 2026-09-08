"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useAuth } from "@/store/auth";
import { useAuthGuard } from "@/hooks/useAuthGuard";
import { DashboardShell } from "@/components/site/dashboard/DashboardShell";
import { CLIENT_NAV } from "@/components/site/dashboard/navConfig";
import { tryCreateProjectFromGuestDraft } from "@/lib/guestProjectDraft";

export default function ClientDashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { ready, user } = useAuthGuard("client", "/client/login");
  const logout = useAuth((s) => s.logout);

  // Catch-all for the guest project draft: if the user lands here already
  // verified (e.g. they verified in another tab and just logged back in,
  // rather than clicking "Continue" from the verify-email success screen),
  // still auto-post anything left over from the pre-registration wizard.
  const recoveryAttempted = useRef(false);
  useEffect(() => {
    if (!ready || !user?.email_verified || recoveryAttempted.current) return;
    recoveryAttempted.current = true;
    tryCreateProjectFromGuestDraft().then((id) => {
      if (id) {
        toast.success("Your project from before you verified has been posted!");
        router.push(`/client/dashboard/projects/${id}`);
      }
    });
  }, [ready, user?.email_verified, router]);

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
      role="client"
      rootHref="/client/dashboard"
      navItems={CLIENT_NAV}
      name={user ? `${user.first_name} ${user.last_name}` : "Client"}
      email={user?.email || ""}
      avatarUrl={user?.avatar_url}
      profileHref="/client/dashboard/profile"
      settingsHref="/client/dashboard/settings"
      messagesHref="/client/dashboard/messages"
      onLogout={handleLogout}
      emailVerified={user?.email_verified ?? true}
    >
      {children}
    </DashboardShell>
  );
}
