"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
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
    if (!user || user.role !== role) {
      toast.error(`Please log in as a ${role === "professional" ? "talent" : role} first.`);
      router.replace(loginPath);
    }
  }, [enabled, hydrated, user, role, loginPath, router]);

  const ready = hydrated && !!user && user.role === role;
  return { ready, user };
}
