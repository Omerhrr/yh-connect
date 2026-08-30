"use client";

import { useRouter, usePathname } from "next/navigation";

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
