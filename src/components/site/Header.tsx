"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import {
  Menu,
  X,
  Zap,
  LogIn,
  UserPlus,
  Briefcase,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/site/ThemeToggle";
import { RoleSwitcher } from "@/components/site/dashboard/RoleSwitcher";
import { SmartLink } from "@/components/site/SmartLink";
import { useSiteContent } from "@/lib/siteContent";
import { useNav } from "@/store/nav";
import { useAuth } from "@/store/auth";

export function Header() {
  const { navigate } = useNav();
  const { user } = useAuth();
  const pathname = usePathname();
  const clientAuthed = user?.role === "client";
  const talentAuthed = user?.role === "professional";
  const [menuOpen, setMenuOpen] = useState(false);
  const { nav_links: navLinks } = useSiteContent("header");

  const go = (v: Parameters<typeof navigate>[0]) => {
    navigate(v);
    setMenuOpen(false);
  };

  const isActive = (href: string) => pathname === href || (href !== "/" && pathname?.startsWith(href + "/"));

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-16 items-center justify-between gap-3 px-4">
        {}
        <button
          onClick={() => go("home")}
          className="flex items-center gap-2 font-bold text-xl shrink-0"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Zap className="h-4 w-4" />
          </div>
          <span>
            YH <span className="text-primary">Connect</span>
          </span>
        </button>

        {}
        <nav className="hidden lg:flex items-center gap-4 xl:gap-5">
          {navLinks.map((link) => (
            <SmartLink
              key={link.label + link.href}
              href={link.href}
              className={`text-sm font-medium whitespace-nowrap transition-colors hover:text-primary ${isActive(link.href) ? "text-primary" : "text-muted-foreground"}`}
            >
              {link.label}
            </SmartLink>
          ))}
        </nav>

        {}
        <div className="flex items-center gap-1 shrink-0">
          {clientAuthed ? (
            <Button variant="ghost" size="sm" className="hidden lg:inline-flex whitespace-nowrap" onClick={() => go("client-dashboard")}>
              <Briefcase className="h-4 w-4 mr-1" /> My Dashboard
            </Button>
          ) : null}
          {talentAuthed ? (
            <Button size="sm" className="hidden lg:inline-flex whitespace-nowrap" onClick={() => go("talent-dashboard")}>
              <User className="h-4 w-4 mr-1" /> My Profile
            </Button>
          ) : null}
          <ThemeToggle />
          <button
            className="p-2"
            onClick={() => setMenuOpen((o) => !o)}
            aria-label="Toggle menu"
          >
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {}
      {menuOpen && (
        <div className="relative">
          <div className="lg:absolute lg:right-4 lg:top-2 lg:w-80 lg:rounded-xl lg:border lg:bg-background lg:shadow-lg border-t bg-background px-4 py-4 space-y-1">
            {}
            <div className="lg:hidden space-y-1 pb-2">
              {navLinks.map((link) => (
                <SmartLink
                  key={link.label + link.href}
                  href={link.href}
                  onClick={() => setMenuOpen(false)}
                  className="block w-full text-left py-2 text-sm font-medium"
                >
                  {link.label}
                </SmartLink>
              ))}
            </div>
            <hr className="border-border lg:hidden" />

            {}
            <div className="py-2 space-y-1">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                <Briefcase className="h-3.5 w-3.5" /> I'm Hiring
              </p>
              {clientAuthed ? (
                <button onClick={() => go("client-dashboard")} className="block w-full text-left py-2 text-sm font-medium text-primary">Client Dashboard</button>
              ) : talentAuthed ? (
                <RoleSwitcher onSwitched={() => setMenuOpen(false)} />
              ) : (
                <>
                  <button
                    onClick={() => go("client-login")}
                    className="flex w-full items-center gap-2 px-3 py-2 rounded-lg text-sm hover:bg-primary/10 hover:text-primary"
                  >
                    <LogIn className="h-4 w-4" /> Log In
                  </button>
                  <button
                    onClick={() => go("client-register")}
                    className="flex w-full items-center gap-2 px-3 py-2 rounded-lg text-sm hover:bg-primary/10 hover:text-primary"
                  >
                    <UserPlus className="h-4 w-4" /> Sign Up
                  </button>
                </>
              )}
            </div>


            <div className="py-2 space-y-1">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                <User className="h-3.5 w-3.5" /> I'm a Professional
              </p>
              {talentAuthed ? (
                <button onClick={() => go("talent-dashboard")} className="block w-full text-left py-2 text-sm font-medium text-primary">Talent Dashboard</button>
              ) : clientAuthed ? (
                <RoleSwitcher onSwitched={() => setMenuOpen(false)} />
              ) : (
                <>
                  <button
                    onClick={() => go("talent-login")}
                    className="flex w-full items-center gap-2 px-3 py-2 rounded-lg text-sm hover:bg-primary/10 hover:text-primary"
                  >
                    <LogIn className="h-4 w-4" /> Log In
                  </button>
                  <button
                    onClick={() => go("talent-register")}
                    className="flex w-full items-center gap-2 px-3 py-2 rounded-lg text-sm hover:bg-primary/10 hover:text-primary"
                  >
                    <UserPlus className="h-4 w-4" /> Sign Up
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
