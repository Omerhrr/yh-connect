"use client";

import { useRouter, usePathname } from "next/navigation";

// Legacy view-key vocabulary, kept so existing call sites
// (HomePage.tsx, AuthPages.tsx, Footer.tsx, Header.tsx) don't need to change
// one-by-one. `navigate(view)` now pushes a real Next.js route instead of
// flipping in-memory state, so browser/gesture back works everywhere.
export type ViewKey =
  | "home"
  | "how-it-works"
  | "for-clients"
  | "for-talents"
  | "find-talent"
  | "find-work"
  | "blog"
  | "privacy"
  | "terms"
  | "client-login"
  | "client-register"
  | "client-dashboard"
  | "talent-login"
  | "talent-register"
  | "talent-dashboard"
  | "not-found";

export const VIEW_ROUTES: Record<ViewKey, string> = {
  home: "/",
  "how-it-works": "/how-it-works",
  "for-clients": "/for-clients",
  "for-talents": "/for-talents",
  "find-talent": "/find-talent",
  "find-work": "/find-work",
  blog: "/blog",
  privacy: "/privacy",
  terms: "/terms",
  "client-login": "/client/login",
  "client-register": "/client/register",
  "client-dashboard": "/client/dashboard",
  "talent-login": "/talent/login",
  "talent-register": "/talent/register",
  "talent-dashboard": "/talent/dashboard",
  "not-found": "/not-found",
};

function pathToView(pathname: string | null): ViewKey {
  if (!pathname) return "home";
  const entry = Object.entries(VIEW_ROUTES).find(([, route]) =>
    route === "/" ? pathname === "/" : pathname === route || pathname.startsWith(route + "/")
  );
  return (entry?.[0] as ViewKey) ?? "home";
}

/**
 * Compatibility shim over Next.js's router. Real navigation/back-button
 * support now comes from actual routes (see docs/platform-hardening-plan.md,
 * Phase 2), this hook just keeps the old `navigate("view-key")` call sites
 * working without a mechanical find-and-replace across every page.
 *
 * `setClientAuth`/`setTalentAuth` are now no-ops: auth state lives in
 * `useAuth` (`user.role`), set once via `setSession` on login.
 */
export function useNav() {
  const router = useRouter();
  const pathname = usePathname();

  const navigate = (view: ViewKey, anchor?: string, query?: Record<string, string>) => {
    const path = VIEW_ROUTES[view] || "/";
    const qs = query ? `?${new URLSearchParams(query).toString()}` : "";
    router.push(`${path}${qs}${anchor ? `#${anchor}` : ""}`);
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "auto" });
    }
  };

  return {
    view: pathToView(pathname),
    navigate,
    setClientAuth: (_value: boolean) => {},
    setTalentAuth: (_value: boolean) => {},
  };
}
