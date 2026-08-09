"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { api, type DisputeOut, type DisputeStatus, DISPUTE_CATEGORY_LABELS } from "@/lib/api";
import { DISPUTE_STATUS_COLORS as STATUS_COLORS } from "@/lib/statusColors";
import { toast } from "sonner";
import Link from "next/link";

const STATUS_LABELS: Record<string, string> = {
  open: "Open",
  under_review: "Under review",
  escalated: "Escalated",
  resolved: "Resolved",
  withdrawn: "Withdrawn",
};

export default function AdminDisputesPage() {
  const [disputes, setDisputes] = useState<DisputeOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<DisputeStatus | "">("");
  const [q, setQ] = useState("");

  const load = () => {
    setLoading(true);
    api
      .adminDisputes({ status_filter: statusFilter || undefined, q: q || undefined })
      .then(setDisputes)
      .catch(() => toast.error("Could not load disputes"))
      .finally(() => setLoading(false));
  };

  useEffect(load, []); // eslint-disable-line react-hooks/exhaustive-deps

  const openCount = disputes.filter((d) => d.status === "open" || d.status === "under_review" || d.status === "escalated").length;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold">Disputes</h1>
        {openCount > 0 && <Badge className="text-xs rounded-full bg-amber-100 text-amber-700">{openCount} need attention</Badge>}
      </div>

      <div className="grid sm:grid-cols-3 gap-3">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as DisputeStatus | "")}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="">All statuses</option>
          <option value="open">Open</option>
          <option value="under_review">Under review</option>
          <option value="escalated">Escalated</option>
          <option value="resolved">Resolved</option>
          <option value="withdrawn">Withdrawn</option>
        </select>
        <Input placeholder="Search project, name, reason..." value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && load()} className="sm:col-span-2" onBlur={load} />
      </div>

      {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {!loading && disputes.length === 0 && <p className="text-sm text-muted-foreground">No disputes match your filters.</p>}

      <div className="rounded-xl border bg-background divide-y">
        {disputes.map((d) => (
          <Link key={d.id} href={`/admin/disputes/${d.id}`} className="block p-5 space-y-1.5 hover:bg-muted/30 transition-colors">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-medium">{d.reason}</p>
                  <Badge variant="outline" className="text-[10px] rounded-full">{DISPUTE_CATEGORY_LABELS[d.category]}</Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {d.project_title || "Unknown project"}{d.milestone_title && ` · ${d.milestone_title}`}
                  {d.raised_by_name && <> · Raised by {d.raised_by_name}</>} · {new Date(d.created_at).toLocaleDateString()}
                </p>
              </div>
              <Badge className={`text-xs rounded-full shrink-0 ${STATUS_COLORS[d.status]}`}>{STATUS_LABELS[d.status]}</Badge>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
