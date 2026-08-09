"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BadgeCheck, DollarSign, FolderKanban, ShieldAlert, TrendingUp, Users } from "lucide-react";
import { api, type AnalyticsOverview } from "@/lib/api";
import { toast } from "sonner";

function fmtNaira(n: number) {
  return `₦${n.toLocaleString()}`;
}

function StatCard({ label, value, icon: Icon, href }: { label: string; value: string; icon: React.ElementType; href?: string }) {
  const content = (
    <div className="rounded-xl border bg-background p-5 hover:shadow-sm transition-shadow">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="text-2xl font-bold mt-1">{value}</p>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
  return href ? <Link href={href}>{content}</Link> : content;
}

export default function AdminOverviewPage() {
  const [data, setData] = useState<AnalyticsOverview | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .adminAnalyticsOverview()
      .then(setData)
      .catch(() => toast.error("Could not load overview data"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Admin Overview</h1>
        <p className="text-muted-foreground text-sm mt-1">Platform health at a glance.</p>
      </div>

      {loading && <p className="text-sm text-muted-foreground">Loading…</p>}

      {data && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Pending Verifications" value={String(data.pending_verifications)} icon={BadgeCheck} href="/admin/verifications" />
          <StatCard label="Open Disputes" value={String(data.open_disputes)} icon={ShieldAlert} href="/admin/disputes" />
          <StatCard label="Active Projects" value={String(data.active_projects)} icon={FolderKanban} href="/admin/projects" />
          <StatCard label="Total Users" value={String(data.total_users)} icon={Users} href="/admin/users" />
          <StatCard label="Signups (7d)" value={String(data.signups_this_week)} icon={TrendingUp} />
          <StatCard label="Signups (30d)" value={String(data.signups_this_month)} icon={TrendingUp} />
          <StatCard label="GMV" value={fmtNaira(data.gmv)} icon={DollarSign} href="/admin/analytics" />
          <StatCard label="Platform Revenue" value={fmtNaira(data.platform_revenue)} icon={DollarSign} href="/admin/analytics" />
        </div>
      )}
    </div>
  );
}
