"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useAuth } from "@/store/auth";
import { setUnauthorizedHandler, type UserRole } from "@/lib/api";

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

  // A page can sit open for days with a cached user/token in localStorage.
  // If that session goes stale server-side (expired token, or the account
  // behind it was reset/deleted, e.g. via the reset_data CLI script), every
  // subsequent data fetch on the page starts 401ing while the dashboard
  // shell keeps rendering from the cached user — previously that just
  // produced a wall of "Could not load ..." toasts until the person
  // manually logged out and back in. Registering this here clears the
  // stale session and sends them to login the moment the first 401 for an
  // authenticated request comes back.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      useAuth.getState().logout();
      toast.error("Your session has expired. Please log in again.");
      router.replace(loginPath);
    });
    return () => setUnauthorizedHandler(null);
  }, [loginPath, router]);

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
