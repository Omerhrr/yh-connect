"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { api, type DisputeOut, type DisputeStatus, DISPUTE_CATEGORY_LABELS, DISPUTE_OUTCOME_LABELS } from "@/lib/api";
import { DISPUTE_STATUS_COLORS as STATUS_COLORS } from "@/lib/statusColors";
import { toast } from "sonner";
import Link from "next/link";
import { Search } from "lucide-react";

const STATUS_LABELS: Record<string, string> = {
  open: "Open",
  under_review: "Under review",
  escalated: "Escalated",
  resolved: "Resolved",
  withdrawn: "Withdrawn",
};

const PAGE_SIZE = 25;

export default function AdminDisputesPage() {
  const [disputes, setDisputes] = useState<DisputeOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<DisputeStatus | "">("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [q, setQ] = useState("");
  const [hasMore, setHasMore] = useState(false);

  const load = (append = false, overrides?: { status?: string; category?: string; query?: string }) => {
    const status = overrides?.status !== undefined ? overrides.status : statusFilter;
    const category = overrides?.category !== undefined ? overrides.category : categoryFilter;
    const query = overrides?.query !== undefined ? overrides.query : q;
    const offset = append ? disputes.length : 0;
    setLoading(true);
    api
      .adminDisputes({
        status_filter: status || undefined,
        category_filter: category || undefined,
        q: query || undefined,
      })
      .then((all) => {
        // The admin endpoint returns everything; page client-side so we can
        // keep this page simple without new backend pagination. Active cases
        // (open / under review / escalated) float to the top so the queue is
        // always work-first, newest first within each group.
        const rank = (s: string) => (s === "open" || s === "under_review" || s === "escalated" ? 0 : 1);
        const sorted = [...all].sort((a, b) =>
          rank(a.status) - rank(b.status) || new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
        const page = sorted.slice(offset, offset + PAGE_SIZE);
        setDisputes((prev) => (append ? [...prev, ...page] : page));
        setHasMore(all.length > offset + PAGE_SIZE);
      })
      .catch(() => toast.error("Could not load disputes"))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const openCount = disputes.filter((d) => d.status === "open" || d.status === "under_review" || d.status === "escalated").length;

  const statusSelect = (v: string) => {
    setStatusFilter(v as DisputeStatus | "");
    setDisputes([]);
    load(false, { status: v });
  };
  const categorySelect = (v: string) => {
    setCategoryFilter(v);
    setDisputes([]);
    load(false, { category: v });
  };
  const search = () => {
    setDisputes([]);
    load(false, { query: q });
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold">Disputes</h1>
        {openCount > 0 && <Badge className="text-xs rounded-full bg-amber-100 text-amber-700">{openCount} need attention</Badge>}
      </div>

      <div className="grid sm:grid-cols-4 gap-3">
        <select
          value={statusFilter}
          onChange={(e) => statusSelect(e.target.value)}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="">All statuses</option>
          <option value="open">Open</option>
          <option value="under_review">Under review</option>
          <option value="escalated">Escalated</option>
          <option value="resolved">Resolved</option>
          <option value="withdrawn">Withdrawn</option>
        </select>
        <select
          value={categoryFilter}
          onChange={(e) => categorySelect(e.target.value)}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="">All categories</option>
          {Object.entries(DISPUTE_CATEGORY_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
        <div className="relative sm:col-span-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search project, name, reason... (Enter to search)" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && search()} className="pl-9" />
        </div>
      </div>

      {loading && disputes.length === 0 && <p className="text-sm text-muted-foreground">Loading…</p>}
      {!loading && disputes.length === 0 && <p className="text-sm text-muted-foreground">No disputes match your filters.</p>}

      <div className="rounded-xl border bg-background divide-y">
        {disputes.map((d) => (
          <Link key={d.id} href={`/admin/disputes/${d.id}`} className="block p-5 space-y-1.5 hover:bg-muted/30 transition-colors">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-medium">{d.reason}</p>
                  <Badge variant="outline" className="text-[10px] rounded-full">{DISPUTE_CATEGORY_LABELS[d.category]}</Badge>
                  {d.milestone_amount != null && (
                    <span className="text-xs font-semibold text-muted-foreground">₦{d.milestone_amount.toLocaleString("en-NG")}</span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {d.project_title || "Unknown project"}{d.milestone_title && <> · <span className="font-medium">{d.milestone_title}</span></>}
                  {d.raised_by_name && <> · Raised by {d.raised_by_name}</>}
                  {d.other_party_name && <> · Against {d.other_party_name}</>}
                </p>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <span className="text-[11px] text-muted-foreground">
                    {new Date(d.created_at).toLocaleDateString()}
                    {(() => {
                      const days = Math.floor((Date.now() - new Date(d.created_at).getTime()) / 86400000);
                      if (days > 0) return <> · {days}d ago</>;
                      return null;
                    })()}
                  </span>
                  {d.message_count > 0 && <span className="text-[11px] text-muted-foreground">· {d.message_count} messages</span>}
                </div>
                {d.status === "resolved" && d.outcome && (
                  <div className="mt-2 rounded-lg bg-green-50 border border-green-200 px-3 py-2">
                    <p className="text-xs font-medium text-green-800">Resolved: {DISPUTE_OUTCOME_LABELS[d.outcome]}</p>
                    {d.resolution_note && <p className="text-xs text-green-700 mt-0.5">{d.resolution_note}</p>}
                    {d.resolved_by_name && <p className="text-[11px] text-green-600 mt-0.5">by {d.resolved_by_name}{d.resolved_at ? ` · ${new Date(d.resolved_at).toLocaleDateString()}` : ""}</p>}
                  </div>
                )}
              </div>
              <Badge className={`text-xs rounded-full shrink-0 ${STATUS_COLORS[d.status]}`}>{STATUS_LABELS[d.status]}</Badge>
            </div>
          </Link>
        ))}
      </div>

      {hasMore && (
        <div className="flex justify-center">
          <Button variant="outline" onClick={() => load(true)} disabled={loading}>
            {loading ? "Loading..." : "Load more disputes"}
          </Button>
        </div>
      )}
    </div>
  );
}
