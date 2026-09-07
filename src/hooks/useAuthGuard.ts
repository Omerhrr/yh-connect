"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/store/auth";
import type { UserRole } from "@/lib/api";

export function useAuthGuard(role: UserRole, loginPath: string, enabled: boolean = true) {
  const router = useRouter();
  const user = useAuth((s) => s.user);
  const token = useAuth((s) => s.token);
  const refreshMe = useAuth((s) => s.refreshMe);
  const [hydrated, setHydrated] = useState(() => useAuth.persist?.hasHydrated?.() ?? true);
  const [recovering, setRecovering] = useState(false);

  useEffect(() => {
    if (hydrated) return;
    if (!useAuth.persist) {
      setHydrated(true);
      return;
    }
    if (useAuth.persist.hasHydrated()) {
      setHydrated(true);
      return;
    }
    const unsub = useAuth.persist.onFinishHydration(() => setHydrated(true));
    return unsub;
  }, [hydrated]);

  useEffect(() => {
    if (!enabled || !hydrated) return;
    if (!user && token) {
      setRecovering(true);
      refreshMe().finally(() => setRecovering(false));
      return;
    }
    if (!user) {
      router.replace(loginPath);
      return;
    }
    if (user.role !== role) {
      if (user.role === "admin") {
        router.replace("/admin");
        return;
      }
      router.replace(user.role === "professional" ? "/talent/dashboard" : "/client/dashboard");
      return;
    }
    // Email verification is a hard gate for client/talent — admins don't
    // need it (created internally, not via public signup).
    if (user.role !== "admin" && !user.email_verified) {
      router.replace("/verify-email");
      return;
    }
  }, [enabled, hydrated, user, token, role, loginPath, router, refreshMe]);

  const ready =
    hydrated && !recovering && !!user && user.role === role && (user.role === "admin" || user.email_verified);
  return { ready, user };
}
