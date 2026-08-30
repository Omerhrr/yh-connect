"use client";

import { useEffect, useState } from "react";
import { RefreshCw, Users, Briefcase, DollarSign, AlertTriangle, BadgeCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { api, type AnalyticsOverview } from "@/lib/api";
import { toast } from "sonner";
import { formatNaira as fmtNaira } from "@/lib/utils";

function MiniBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
      <div className={`h-full rounded-full transition-all duration-500 ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

function StatCard({ label, value, icon: Icon, color, sub }: { label: string; value: string | number; icon: React.ElementType; color: string; sub?: string }) {
  return (
    <div className="rounded-xl border bg-background p-5 space-y-2">
      <div className="flex items-center gap-2">
        <div className={`p-2 rounded-lg ${color}`}><Icon className="h-4 w-4 text-white" /></div>
        <span className="text-sm text-muted-foreground">{label}</span>
      </div>
      <p className="text-2xl font-bold">{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

export default function AdminAnalyticsPage() {
  const [data, setData] = useState<AnalyticsOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadedAt, setLoadedAt] = useState<Date | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = () => {
    setLoading(true);
    api.adminAnalyticsOverview().then((d) => { setData(d); setLoadedAt(new Date()); }).catch(() => toast.error("Could not load analytics")).finally(() => setLoading(false));
  };

  useEffect(load, []);

  const refresh = () => {
    setRefreshing(true);
    load();
    setTimeout(() => setRefreshing(false), 700);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold">Analytics</h1>
        <Button variant="outline" size="sm" onClick={refresh} disabled={refreshing || loading}>
          <RefreshCw className={`h-3.5 w-3.5 mr-1 ${refreshing ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </div>
      {loadedAt && !loading && (
        <p className="text-xs text-muted-foreground -mt-4">As of {loadedAt.toLocaleString()}</p>
      )}
      {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {data && (
        <>
          {}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Total Users" value={data.total_users.toLocaleString()} icon={Users} color="bg-primary" sub={`${data.professional_count} professionals · ${data.client_count} clients`} />
            <StatCard label="Active Projects" value={data.active_projects.toLocaleString()} icon={Briefcase} color="bg-emerald-600" sub={`${data.completed_projects} completed · ${data.open_disputes} disputes`} />
            <StatCard label="GMV" value={fmtNaira(data.gmv)} icon={DollarSign} color="bg-amber-600" sub={`Revenue: ${fmtNaira(data.platform_revenue)}`} />
            <StatCard label="Pending Reviews" value={data.pending_verifications.toLocaleString()} icon={BadgeCheck} color="bg-violet-600" sub={`${data.open_disputes} open disputes`} />
          </div>

          {}
          <div className="grid md:grid-cols-2 gap-6">
            {}
            <div className="rounded-xl border bg-background p-6 space-y-4">
              <h2 className="font-semibold">Growth</h2>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Signups (7 days)</span>
                    <span className="font-semibold">{data.signups_this_week}</span>
                  </div>
                  <MiniBar value={data.signups_this_week} max={Math.max(data.signups_this_week, data.signups_this_month / 4, 1)} color="bg-primary" />
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Signups (30 days)</span>
                    <span className="font-semibold">{data.signups_this_month}</span>
                  </div>
                  <MiniBar value={data.signups_this_month} max={Math.max(data.signups_this_month, 1)} color="bg-primary/70" />
                </div>
                <div className="h-px bg-border my-2" />
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Clients</p>
                    <p className="text-lg font-bold">{data.client_count}</p>
                    <MiniBar value={data.client_count} max={data.total_users} color="bg-blue-500" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Professionals</p>
                    <p className="text-lg font-bold">{data.professional_count}</p>
                    <MiniBar value={data.professional_count} max={data.total_users} color="bg-emerald-500" />
                  </div>
                </div>
              </div>
            </div>

            {}
            <div className="rounded-xl border bg-background p-6 space-y-4">
              <h2 className="font-semibold">Projects</h2>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Completion rate</span>
                    <span className="font-semibold">
                      {data.total_projects > 0 ? Math.round((data.completed_projects / data.total_projects) * 100) : 0}%
                    </span>
                  </div>
                  <MiniBar value={data.completed_projects} max={Math.max(data.total_projects, 1)} color="bg-emerald-500" />
                </div>
                <div className="h-px bg-border my-2" />
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="rounded-lg bg-muted/50 p-3">
                    <p className="text-xl font-bold">{data.active_projects}</p>
                    <p className="text-xs text-muted-foreground">Active</p>
                  </div>
                  <div className="rounded-lg bg-muted/50 p-3">
                    <p className="text-xl font-bold">{data.completed_projects}</p>
                    <p className="text-xs text-muted-foreground">Completed</p>
                  </div>
                  <div className="rounded-lg bg-muted/50 p-3">
                    <p className="text-xl font-bold">{data.total_projects - data.active_projects - data.completed_projects}</p>
                    <p className="text-xs text-muted-foreground">Other</p>
                  </div>
                </div>
                <div className="h-px bg-border my-2" />
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground flex items-center gap-1.5">
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-500" /> Open disputes
                  </span>
                  <Badge className={`text-xs rounded-full ${data.open_disputes > 0 ? "bg-amber-100 text-amber-700" : "bg-green-100 text-green-700"}`}>
                    {data.open_disputes}
                  </Badge>
                </div>
              </div>
            </div>

            {}
            <div className="rounded-xl border bg-background p-6 space-y-4 md:col-span-2">
              <h2 className="font-semibold">Revenue</h2>
              <div className="grid sm:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Gross Merchandise Value</p>
                  <p className="text-2xl font-bold text-emerald-600">{fmtNaira(data.gmv)}</p>
                  <MiniBar value={data.gmv} max={Math.max(data.gmv, 1)} color="bg-emerald-500" />
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Platform Revenue (fees)</p>
                  <p className="text-2xl font-bold">{fmtNaira(data.platform_revenue)}</p>
                  <MiniBar value={data.platform_revenue} max={Math.max(data.gmv, 1)} color="bg-primary" />
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Fee rate</p>
                  <p className="text-2xl font-bold">
                    {data.gmv > 0 ? `${Math.round((data.platform_revenue / data.gmv) * 100)}%` : "0%"}
                  </p>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div className="h-full bg-primary/60 rounded-full" style={{ width: data.gmv > 0 ? `${Math.min((data.platform_revenue / data.gmv) * 100 * 10, 100)}%` : "0%" }} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
      <p className="text-xs text-muted-foreground">
        Figures reflect simulated Monnify transactions until live payment keys are activated.
      </p>
    </div>
  );
}
