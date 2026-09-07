"use client";

import { useEffect, useRef, useState } from "react";
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
  // Tracks whether we've already reconciled a cached "unverified" flag with
  // the server this mount, so a genuinely-unverified user doesn't refetch
  // on every render — see the effect below for why this check exists.
  const recheckedRef = useRef(false);

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
      // The cached user object can be stale: verification can complete in
      // a different tab (the emailed link often opens a new tab/window),
      // and this tab's in-memory session is never told to refresh. Trusting
      // a cached `false` here would bounce an already-verified user back to
      // /verify-email forever, so reconcile with the server once before
      // actually gating — only genuinely-unverified users get redirected.
      if (!recheckedRef.current) {
        recheckedRef.current = true;
        setRecovering(true);
        refreshMe().finally(() => setRecovering(false));
        return;
      }
      router.replace("/verify-email");
      return;
    }
  }, [enabled, hydrated, user, token, role, loginPath, router, refreshMe]);

  const ready =
    hydrated && !recovering && !!user && user.role === role && (user.role === "admin" || user.email_verified);
  return { ready, user };
}
