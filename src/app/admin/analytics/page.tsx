"use client";

import { useEffect, useState } from "react";
import { api, type AnalyticsOverview } from "@/lib/api";
import { toast } from "sonner";

function fmtNaira(n: number) {
  return `₦${n.toLocaleString()}`;
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-3 border-b last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-semibold">{value}</span>
    </div>
  );
}

export default function AdminAnalyticsPage() {
  const [data, setData] = useState<AnalyticsOverview | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.adminAnalyticsOverview().then(setData).catch(() => toast.error("Could not load analytics")).finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-5 max-w-2xl">
      <h1 className="text-2xl font-bold">Analytics</h1>
      {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {data && (
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="rounded-xl border bg-background p-5">
            <h2 className="font-semibold mb-2">Growth</h2>
            <Row label="Signups (7 days)" value={String(data.signups_this_week)} />
            <Row label="Signups (30 days)" value={String(data.signups_this_month)} />
            <Row label="Total users" value={String(data.total_users)} />
          </div>
          <div className="rounded-xl border bg-background p-5">
            <h2 className="font-semibold mb-2">Projects</h2>
            <Row label="Active projects" value={String(data.active_projects)} />
            <Row label="Total projects" value={String(data.total_projects)} />
            <Row label="Open disputes" value={String(data.open_disputes)} />
          </div>
          <div className="rounded-xl border bg-background p-5 sm:col-span-2">
            <h2 className="font-semibold mb-2">Revenue</h2>
            <Row label="GMV (gross funded escrow)" value={fmtNaira(data.gmv)} />
            <Row label="Platform revenue (fees)" value={fmtNaira(data.platform_revenue)} />
            <Row label="Pending verifications" value={String(data.pending_verifications)} />
          </div>
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        Figures reflect simulated Monnify transactions until live payment keys are activated.
      </p>
    </div>
  );
}
