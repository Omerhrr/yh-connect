import {
  BadgeCheck,
  BarChart3,
  Briefcase,
  FileText,
  FolderKanban,
  Gauge,
  Heart,
  LayoutDashboard,
  MessageSquare,
  Newspaper,
  Package,
  Search,
  Settings,
  ShieldAlert,
  User,
  Users,
  Wallet,
} from "lucide-react";

export type DashboardNavItem = {
  href: string;
  label: string;
  icon: React.ElementType;
};

export const CLIENT_NAV: DashboardNavItem[] = [
  { href: "/client/dashboard", label: "Overview", icon: BarChart3 },
  { href: "/client/dashboard/projects", label: "My Projects", icon: Briefcase },
  { href: "/client/dashboard/find-talent", label: "Find Professionals", icon: Users },
  { href: "/client/dashboard/saved", label: "Saved", icon: Heart },
  { href: "/client/dashboard/messages", label: "Messages", icon: MessageSquare },
  { href: "/client/dashboard/payments", label: "Payments", icon: Wallet },
  { href: "/client/dashboard/disputes", label: "Disputes", icon: ShieldAlert },
  { href: "/client/dashboard/profile", label: "My Profile", icon: User },
  { href: "/client/dashboard/settings", label: "Settings", icon: Settings },
];

export const TALENT_NAV: DashboardNavItem[] = [
  { href: "/talent/dashboard", label: "Overview", icon: BarChart3 },
  { href: "/talent/dashboard/find-work", label: "Find Projects", icon: Search },
  { href: "/talent/dashboard/saved", label: "Saved", icon: Heart },
  { href: "/talent/dashboard/proposals", label: "My Proposals", icon: FileText },
  { href: "/talent/dashboard/active", label: "Active Jobs", icon: Package },
  { href: "/talent/dashboard/messages", label: "Messages", icon: MessageSquare },
  { href: "/talent/dashboard/earnings", label: "Earnings", icon: Wallet },
  { href: "/talent/dashboard/disputes", label: "Disputes", icon: ShieldAlert },
  { href: "/talent/dashboard/profile", label: "My Profile", icon: User },
  { href: "/talent/dashboard/settings", label: "Settings", icon: Settings },
];

export const ADMIN_NAV: DashboardNavItem[] = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard },
  { href: "/admin/verifications", label: "Verifications", icon: BadgeCheck },
  { href: "/admin/disputes", label: "Disputes", icon: ShieldAlert },
  { href: "/admin/payments", label: "Payments", icon: Wallet },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/projects", label: "Projects", icon: FolderKanban },
  { href: "/admin/content", label: "Content", icon: Newspaper },
  { href: "/admin/settings", label: "Settings", icon: Settings },
  { href: "/admin/analytics", label: "Analytics", icon: Gauge },
];
