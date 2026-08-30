"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Bell, ChevronRight, LogOut, Mail, Menu, MessageSquare, Search, Settings, User, X, Zap } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/site/UserAvatar";
import { ThemeToggle } from "@/components/site/ThemeToggle";
import { RoleSwitcher } from "@/components/site/dashboard/RoleSwitcher";
import type { DashboardNavItem } from "@/components/site/dashboard/navConfig";
import { useProjectUnread } from "@/hooks/useProjectUnread";
import { api, type NotificationOut } from "@/lib/api";
import { useTheme } from "@/store/theme";
import { toast } from "sonner";

function isNavItemActive(pathname: string, item: DashboardNavItem, rootHref: string) {
  if (item.href === rootHref) return pathname === rootHref;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export function DashboardShell({
  role,
  rootHref,
  navItems,
  children,
  name,
  email,
  avatarUrl,
  profileHref,
  settingsHref,
  messagesHref,
  onLogout,
  emailVerified = true,
}: {
  role: "client" | "talent" | "admin";
  rootHref: string;
  navItems: DashboardNavItem[];
  children: React.ReactNode;
  name: string;
  email: string;
  avatarUrl?: string | null;
  profileHref?: string;
  settingsHref: string;
  messagesHref?: string;
  onLogout: () => void;
  emailVerified?: boolean;
}) {
  const pathname = usePathname() || rootHref;
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();
  const [searchQuery, setSearchQuery] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationOut[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [resendingVerification, setResendingVerification] = useState(false);
  const { unreadByProject } = useProjectUnread();
  const projectsHref = role === "client" ? "/client/dashboard/projects" : role === "talent" ? "/talent/dashboard/active" : "";
  const projectUnreadTotal = Object.values(unreadByProject).reduce((a, b) => a + b, 0);

  const navBadgeCount = (item: DashboardNavItem) => {
    if (item.href === messagesHref) return unreadMessages;
    if (projectsHref && item.href === projectsHref) return projectUnreadTotal;
    return 0;
  };

  useEffect(() => {
    const loadUnread = () => {
      api.unreadNotificationCount().then((r) => setUnreadCount(r.count)).catch(() => {});
      api.unreadMessageCount().then((r) => setUnreadMessages(r.count)).catch(() => {});
    };
    loadUnread();
    const interval = setInterval(loadUnread, 30000);
    return () => clearInterval(interval);
  }, []);

  const openNotifications = () => {
    setNotifOpen((o) => {
      const next = !o;
      if (next) {
        api.notifications().then(setNotifications).catch(() => {});
      }
      return next;
    });
    setProfileMenuOpen(false);
  };

  const handleNotificationClick = async (n: NotificationOut) => {
    if (!n.read_at) {
      try {
        await api.markNotificationRead(n.id);
        setUnreadCount((c) => Math.max(0, c - 1));
      } catch {
      }
    }
    setNotifOpen(false);
  };

  const markAllRead = async () => {
    try {
      await api.markAllNotificationsRead();
      setNotifications((prev) => prev.map((n) => (n.read_at ? n : { ...n, read_at: new Date().toISOString() })));
      setUnreadCount(0);
    } catch {
      toast.error("Could not mark notifications as read");
    }
  };

  const clearAllNotifications = async () => {
    if (!confirm("Clear all notifications? This can't be undone.")) return;
    try {
      await api.clearNotifications();
      setNotifications([]);
      setUnreadCount(0);
    } catch {
      toast.error("Could not clear notifications");
    }
  };

  const dismissNotification = async (e: React.MouseEvent, n: NotificationOut) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await api.deleteNotification(n.id);
      setNotifications((prev) => prev.filter((x) => x.id !== n.id));
      if (!n.read_at) setUnreadCount((c) => Math.max(0, c - 1));
    } catch {
      toast.error("Could not remove notification");
    }
  };

  const resendVerification = async () => {
    setResendingVerification(true);
    try {
      await api.resendVerification();
      toast.success("Verification email sent, check your inbox.");
    } catch {
      toast.error("Could not send verification email. Please try again.");
    } finally {
      setResendingVerification(false);
    }
  };
  const accentClass =
    role === "client" ? "bg-primary text-primary-foreground" : role === "talent" ? "bg-emerald-600 text-white" : "bg-slate-800 text-white";
  const activeTextClass =
    role === "client" ? "text-primary bg-primary/10" : role === "talent" ? "text-emerald-700 bg-emerald-50" : "text-slate-800 bg-slate-100";
  const activeMobileText = role === "client" ? "text-primary" : role === "talent" ? "text-emerald-600" : "text-slate-800";
  const brandAccent = role === "client" ? "text-primary" : role === "talent" ? "text-emerald-600" : "text-slate-700";

  const bottomNavItems = navItems.filter((item) => item.mobile);

  return (
    <div className="min-h-screen flex bg-muted/20">
      {}
      <aside className={`hidden md:flex ${sidebarOpen ? "w-60" : "w-16"} transition-all duration-200 bg-background border-r flex-col shrink-0`}>
        <div className="h-16 flex items-center px-4 border-b gap-2">
          <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${accentClass}`}>
            <Zap className="h-4 w-4" />
          </div>
          {sidebarOpen && (
            <span className="font-bold text-base truncate">
              YH <span className={brandAccent}>Connect</span>
            </span>
          )}
        </div>

        <nav className="flex-1 py-4 space-y-1 px-2">
          {navItems.map((item) => {
            const active = isNavItemActive(pathname, item, rootHref);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 w-full rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  active ? activeTextClass : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {sidebarOpen && <span>{item.label}</span>}
                {navBadgeCount(item) > 0 && (
                  <span className="ml-auto text-[10px] font-semibold rounded-full bg-red-500 text-white px-1.5 py-0.5 min-w-[18px] text-center">
                    {navBadgeCount(item) > 99 ? "99+" : navBadgeCount(item)}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="border-t p-3">
          {sidebarOpen ? (
            <div className="flex items-center gap-2">
              <UserAvatar avatarUrl={avatarUrl} name={name} className="h-8 w-8" fallbackClassName={accentClass} />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold truncate">{name}</p>
                <p className="text-xs text-muted-foreground truncate">{email}</p>
              </div>
              <button onClick={onLogout} className="text-muted-foreground hover:text-foreground">
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <button onClick={onLogout} className="flex w-full items-center justify-center py-1 text-muted-foreground hover:text-foreground">
              <LogOut className="h-4 w-4" />
            </button>
          )}
        </div>
      </aside>

      {}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileMenuOpen(false)} />
          <div className="relative w-64 max-w-[80vw] bg-background h-full flex flex-col shadow-xl">
            <div className="h-16 flex items-center justify-between px-4 border-b">
              <span className="font-bold text-base">
                YH <span className={brandAccent}>Connect</span>
              </span>
              <button onClick={() => setMobileMenuOpen(false)} className="p-1 text-muted-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="flex-1 py-4 space-y-1 px-2 overflow-y-auto">
              {navItems.map((item) => {
                const active = isNavItemActive(pathname, item, rootHref);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-3 w-full rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                      active ? activeTextClass : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span>{item.label}</span>
                    {navBadgeCount(item) > 0 && (
                      <span className="ml-auto text-[10px] font-semibold rounded-full bg-red-500 text-white px-1.5 py-0.5 min-w-[18px] text-center">
                        {navBadgeCount(item) > 99 ? "99+" : navBadgeCount(item)}
                      </span>
                    )}
                  </Link>
                );
              })}
            </nav>
            <div className="border-t p-3 space-y-3">
              <button
                onClick={toggleTheme}
                className="flex items-center justify-between w-full rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              >
                <span>Dark mode</span>
                <span className={`relative h-5 w-9 rounded-full transition-colors ${theme === "dark" ? "bg-primary" : "bg-muted-foreground/30"}`}>
                  <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-background shadow transition-all ${theme === "dark" ? "left-[18px]" : "left-0.5"}`} />
                </span>
              </button>
              <div className="flex items-center gap-2">
                <UserAvatar avatarUrl={avatarUrl} name={name} className="h-8 w-8" fallbackClassName={accentClass} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold truncate">{name}</p>
                  <p className="text-xs text-muted-foreground truncate">{email}</p>
                </div>
                <button onClick={onLogout} className="text-muted-foreground hover:text-foreground">
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {}
      <div className="flex-1 flex flex-col min-w-0">
        {}
        <header className="h-14 md:h-16 border-b bg-background flex items-center justify-between px-4 md:px-6 gap-3 md:gap-4">
          <button onClick={() => setSidebarOpen((o) => !o)} className="hidden md:block text-muted-foreground hover:text-foreground">
            <ChevronRight className={`h-5 w-5 transition-transform ${sidebarOpen ? "rotate-180" : ""}`} />
          </button>
          <button onClick={() => setMobileMenuOpen(true)} className="md:hidden text-muted-foreground hover:text-foreground p-1">
            <Menu className="h-5 w-5" />
          </button>
          {role !== "admin" && (
            <div className="relative flex-1 max-w-sm hidden sm:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={role === "client" ? "Search professionals..." : "Search projects..."}
                className="pl-9 h-9 bg-muted/50"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key !== "Enter" || !searchQuery.trim()) return;
                  const target = role === "client" ? "/client/dashboard/find-talent" : "/talent/dashboard/find-work";
                  router.push(`${target}?q=${encodeURIComponent(searchQuery.trim())}`);
                }}
              />
            </div>
          )}
          <span className="font-bold text-sm sm:hidden">
            YH <span className={brandAccent}>Connect</span>
          </span>
          <div className="flex items-center gap-2 relative">
            <ThemeToggle />
            <div className="relative">
              <button
                onClick={openNotifications}
                className="relative p-2 text-muted-foreground hover:text-foreground"
              >
                <Bell className="h-5 w-5" />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-red-500" />
                )}
              </button>
              {notifOpen && (
                <div className="absolute right-0 top-full mt-1 w-72 rounded-lg border bg-popover shadow-lg py-2 z-50 max-h-96 overflow-y-auto">
                  {notifications.length > 0 && (
                    <div className="flex items-center justify-between px-3 pb-2 border-b">
                      <button onClick={markAllRead} className="text-xs font-medium text-primary hover:underline disabled:opacity-50" disabled={unreadCount === 0}>
                        Mark all as read
                      </button>
                      <button onClick={clearAllNotifications} className="text-xs text-muted-foreground hover:text-destructive">
                        Clear all
                      </button>
                    </div>
                  )}
                  {notifications.length === 0 && (
                    <p className="px-3 py-2 text-xs text-muted-foreground">You&apos;re all caught up, no notifications yet.</p>
                  )}
                  {notifications.map((n) => (
                    <Link
                      key={n.id}
                      href={n.link || "#"}
                      onClick={() => handleNotificationClick(n)}
                      className={`group flex items-start gap-2 px-3 py-2 text-sm hover:bg-muted/60 border-b last:border-b-0 ${!n.read_at ? "bg-primary/5" : ""}`}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-medium truncate">{n.title}</p>
                        {n.body && <p className="text-xs text-muted-foreground truncate mt-0.5">{n.body}</p>}
                      </div>
                      <button
                        onClick={(e) => dismissNotification(e, n)}
                        className="shrink-0 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive p-0.5"
                        aria-label="Dismiss notification"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </Link>
                  ))}
                  {messagesHref && (
                    <Link
                      href={messagesHref}
                      onClick={() => setNotifOpen(false)}
                      className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent border-t"
                    >
                      <MessageSquare className="h-3.5 w-3.5" /> View Messages
                    </Link>
                  )}
                </div>
              )}
            </div>
            <div className="relative">
              <button onClick={() => { setProfileMenuOpen((o) => !o); setNotifOpen(false); }}>
                <UserAvatar avatarUrl={avatarUrl} name={name} className="h-8 w-8 cursor-pointer" fallbackClassName={accentClass} />
              </button>
              {profileMenuOpen && (
                <div className="absolute right-0 top-full mt-1 w-52 rounded-lg border bg-popover shadow-lg py-1 z-50">
                  <div className="px-3 py-2 border-b">
                    <p className="text-xs font-semibold truncate">{name}</p>
                    <p className="text-xs text-muted-foreground truncate">{email}</p>
                  </div>
                  {profileHref && (
                    <Link
                      href={profileHref}
                      onClick={() => setProfileMenuOpen(false)}
                      className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent"
                    >
                      <User className="h-3.5 w-3.5" /> View Profile
                    </Link>
                  )}
                  <Link
                    href={settingsHref}
                    onClick={() => setProfileMenuOpen(false)}
                    className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent"
                  >
                    <Settings className="h-3.5 w-3.5" /> Settings
                  </Link>
                  {role !== "admin" && (
                    <div className="border-t">
                      <RoleSwitcher onSwitched={() => setProfileMenuOpen(false)} />
                    </div>
                  )}
                  <button
                    onClick={() => { setProfileMenuOpen(false); onLogout(); }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-accent text-left border-t"
                  >
                    <LogOut className="h-3.5 w-3.5" /> Log Out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {!emailVerified && (
          <div className="flex items-center justify-between gap-3 bg-amber-50 border-b border-amber-200 px-4 md:px-6 py-2 text-xs md:text-sm text-amber-800">
            <span className="flex items-center gap-2">
              <Mail className="h-4 w-4 shrink-0" /> Please verify your email address to secure your account.
            </span>
            <Button size="sm" variant="outline" className="h-7 text-xs shrink-0" onClick={resendVerification} disabled={resendingVerification}>
              {resendingVerification ? "Sending..." : "Resend email"}
            </Button>
          </div>
        )}

        <main className="flex-1 p-4 md:p-6 overflow-y-auto pb-20 md:pb-6">
          {children}
        </main>

        {}
        <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-background border-t flex items-stretch h-16 pb-[env(safe-area-inset-bottom)]">
          {bottomNavItems.map((item) => {
            const active = isNavItemActive(pathname, item, rootHref);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex-1 flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${
                  active ? activeMobileText : "text-muted-foreground"
                }`}
              >
                <span className="relative">
                  <Icon className="h-5 w-5" />
                  {navBadgeCount(item) > 0 && (
                    <span className="absolute -top-1.5 -right-2.5 text-[9px] font-semibold rounded-full bg-red-500 text-white px-1 min-w-[14px] text-center">
                      {navBadgeCount(item) > 9 ? "9+" : navBadgeCount(item)}
                    </span>
                  )}
                </span>
                <span className="truncate max-w-[64px]">{item.label}</span>
              </Link>
            );
          })}
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="flex-1 flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium text-muted-foreground"
          >
            <Menu className="h-5 w-5" />
            <span>More</span>
          </button>
        </nav>
      </div>
    </div>
  );
}
