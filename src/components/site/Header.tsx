"use client";

import { useState } from "react";
import {
  Menu,
  X,
  ChevronDown,
  Zap,
  LogIn,
  UserPlus,
  Briefcase,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/site/ThemeToggle";
import { useNav } from "@/store/nav";
import { useAuth } from "@/store/auth";

export function Header() {
  const { navigate, view } = useNav();
  const { user } = useAuth();
  const clientAuthed = user?.role === "client";
  const talentAuthed = user?.role === "professional";
  const [mobileOpen, setMobileOpen] = useState(false);
  const [clientOpen, setClientOpen] = useState(false);
  const [talentOpen, setTalentOpen] = useState(false);

  const closeAll = () => {
    setClientOpen(false);
    setTalentOpen(false);
    setMobileOpen(false);
  };

  const go = (v: Parameters<typeof navigate>[0]) => {
    navigate(v);
    closeAll();
  };

  const isActive = (v: string) => view === v;

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        {/* Logo */}
        <button
          onClick={() => go("home")}
          className="flex items-center gap-2 font-bold text-xl"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Zap className="h-4 w-4" />
          </div>
          <span>
            YH <span className="text-primary">Connect</span>
          </span>
        </button>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-6">
          <button
            onClick={() => go("how-it-works")}
            className={`text-sm font-medium transition-colors hover:text-primary ${isActive("how-it-works") ? "text-primary" : "text-muted-foreground"}`}
          >
            How It Works
          </button>
          <button
            onClick={() => go("find-talent")}
            className={`text-sm font-medium transition-colors hover:text-primary ${isActive("find-talent") ? "text-primary" : "text-muted-foreground"}`}
          >
            Find Professionals
          </button>
          <button
            onClick={() => go("find-work")}
            className={`text-sm font-medium transition-colors hover:text-primary ${isActive("find-work") ? "text-primary" : "text-muted-foreground"}`}
          >
            Find Projects
          </button>
        </nav>

        {/* Desktop Auth */}
        <div className="hidden md:flex items-center gap-2">
          <ThemeToggle />
          {clientAuthed ? (
            <Button variant="ghost" size="sm" onClick={() => go("client-dashboard")}>
              <Briefcase className="h-4 w-4 mr-1" /> My Dashboard
            </Button>
          ) : (
            <div className="relative">
              <Button
                variant="ghost"
                size="sm"
                className="hover:bg-primary/10 hover:text-primary"
                onClick={() => { setClientOpen((o) => !o); setTalentOpen(false); }}
              >
                <Briefcase className="h-4 w-4 mr-1" />
                I'm Hiring
                <ChevronDown className={`ml-1 h-3 w-3 transition-transform ${clientOpen ? "rotate-180" : ""}`} />
              </Button>
              {clientOpen && (
                <div className="absolute right-0 top-full mt-1 w-44 rounded-lg border bg-popover shadow-lg py-1 z-50">
                  <button
                    onClick={() => go("client-login")}
                    className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-primary/10 hover:text-primary"
                  >
                    <LogIn className="h-3.5 w-3.5" /> Log In
                  </button>
                  <button
                    onClick={() => go("client-register")}
                    className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-primary/10 hover:text-primary"
                  >
                    <UserPlus className="h-3.5 w-3.5" /> Sign Up
                  </button>
                </div>
              )}
            </div>
          )}

          {talentAuthed ? (
            <Button size="sm" onClick={() => go("talent-dashboard")}>
              <User className="h-4 w-4 mr-1" /> My Profile
            </Button>
          ) : (
            <div className="relative">
              <Button
                size="sm"
                onClick={() => { setTalentOpen((o) => !o); setClientOpen(false); }}
              >
                <User className="h-4 w-4 mr-1" />
                I'm a Professional
                <ChevronDown className={`ml-1 h-3 w-3 transition-transform ${talentOpen ? "rotate-180" : ""}`} />
              </Button>
              {talentOpen && (
                <div className="absolute right-0 top-full mt-1 w-44 rounded-lg border bg-popover shadow-lg py-1 z-50">
                  <button
                    onClick={() => go("talent-login")}
                    className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-primary/10 hover:text-primary"
                  >
                    <LogIn className="h-3.5 w-3.5" /> Log In
                  </button>
                  <button
                    onClick={() => go("talent-register")}
                    className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-primary/10 hover:text-primary"
                  >
                    <UserPlus className="h-3.5 w-3.5" /> Sign Up
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Mobile toggles */}
        <div className="flex items-center gap-1 md:hidden">
          <ThemeToggle />
          <button
            className="p-2"
            onClick={() => setMobileOpen((o) => !o)}
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden border-t bg-background px-4 py-4 space-y-3">
          <button onClick={() => go("how-it-works")} className="block w-full text-left py-2 text-sm font-medium">How It Works</button>
          <button onClick={() => go("find-talent")} className="block w-full text-left py-2 text-sm font-medium">Find Professionals</button>
          <button onClick={() => go("find-work")} className="block w-full text-left py-2 text-sm font-medium">Find Projects</button>
          <hr className="border-border" />
          {clientAuthed ? (
            <button onClick={() => go("client-dashboard")} className="block w-full text-left py-2 text-sm font-medium text-primary">Client Dashboard</button>
          ) : (
            <>
              <button onClick={() => go("client-login")} className="block w-full text-left py-2 text-sm">Client Login</button>
              <button onClick={() => go("client-register")} className="block w-full text-left py-2 text-sm">Client Sign Up</button>
            </>
          )}
          {talentAuthed ? (
            <button onClick={() => go("talent-dashboard")} className="block w-full text-left py-2 text-sm font-medium text-primary">Talent Dashboard</button>
          ) : (
            <>
              <button onClick={() => go("talent-login")} className="block w-full text-left py-2 text-sm">Talent Login</button>
              <button onClick={() => go("talent-register")} className="block w-full text-left py-2 text-sm">Talent Sign Up</button>
            </>
          )}
        </div>
      )}
    </header>
  );
}
