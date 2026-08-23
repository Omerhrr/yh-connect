"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/store/auth";
import type { UserRole } from "@/lib/api";

/**
 * Route-level auth guard for the client/talent dashboard layouts.
 *
 * Auth state (`useAuth`) is persisted to localStorage via zustand's
 * `persist` middleware, which rehydrates asynchronously on the client. On a
 * hard refresh landing directly on a dashboard route, we have to wait for
 * that rehydration before deciding to redirect, otherwise a logged-in user
 * gets briefly bounced to the login page before their session loads.
 */
export function useAuthGuard(role: UserRole, loginPath: string, enabled: boolean = true) {
  const router = useRouter();
  const user = useAuth((s) => s.user);
  // `persist` can be momentarily unavailable during the very first
  // client-side module evaluation (e.g. Turbopack dev HMR races), guard
  // every access instead of assuming it's always there.
  const [hydrated, setHydrated] = useState(() => useAuth.persist?.hasHydrated?.() ?? true);

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
    if (!user) {
      router.replace(loginPath);
      return;
    }
    if (user.role !== role) {
      // Logged in, just as the other role, not logged out. This can happen
      // genuinely (someone bookmarked the wrong dashboard) but also
      // transiently while RoleSwitcher is mid-navigation: it updates the
      // session before the route finishes changing, so this still-mounted
      // guard can briefly see a "wrong role" user. Either way, send them to
      // their own dashboard instead of a login page they don't need (they're
      // already authenticated), so a switch settles on the right screen
      // instead of dead-ending on a login form.
      if (user.role === "admin") {
        router.replace("/admin");
        return;
      }
      router.replace(user.role === "professional" ? "/talent/dashboard" : "/client/dashboard");
      return;
    }
  }, [enabled, hydrated, user, role, loginPath, router]);

  const ready = hydrated && !!user && user.role === role;
  return { ready, user };
}
