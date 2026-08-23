"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api, ApiError, type AdminProjectOut } from "@/lib/api";
import { PROJECT_STATUS_COLORS as STATUS_COLORS } from "@/lib/statusColors";
import { formatBudgetRange } from "@/lib/utils";
import { toast } from "sonner";
import Link from "next/link";
import { AlertTriangle, Search, X } from "lucide-react";

const STATUS_TABS: { value: string; label: string }[] = [
  { value: "", label: "All" },
  { value: "open", label: "Open" },
  { value: "in_progress", label: "In Progress" },
  { value: "review", label: "Review" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

const PAGE_SIZE = 25;

export default function AdminProjectsPage() {
  const [projects, setProjects] = useState<AdminProjectOut[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [disputeOnly, setDisputeOnly] = useState(false);
  const [q, setQ] = useState("");
  const [qDraft, setQDraft] = useState("");

  const load = useCallback((append = false) => {
    const offset = append ? projects.length : 0;
    setLoading(true);
    const filters = { status_filter: status || undefined, q: q || undefined, has_dispute: disputeOnly ? "true" : undefined };
    Promise.all([
      api.adminProjects({ ...filters, limit: PAGE_SIZE, offset }),
      api.adminProjectsCount(filters),
    ])
      .then(([page, c]) => {
        setProjects((prev) => (append ? [...prev, ...page] : page));
        setTotal(c.total);
      })
      .catch(() => toast.error("Could not load projects"))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, q, disputeOnly]);

  useEffect(() => { load(false); }, [status, q, disputeOnly]); // eslint-disable-line react-hooks/exhaustive-deps

  const applySearch = () => setQ(qDraft);
  const clearSearch = () => { setQDraft(""); setQ(""); };

  const cancel = async (id: string) => {
    if (!confirm("Force-cancel this project? Any escrowed milestone funds are refunded to the client automatically.")) return;
    setBusyId(id);
    try {
      await api.cancelAdminProject(id);
      toast.success("Project cancelled and any escrowed funds refunded");
      setProjects((prev) => prev.map((p) => (p.id === id ? { ...p, status: "cancelled" as const } : p)));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not cancel project");
    } finally {
      setBusyId(null);
    }
  };

  const filtersActive = !!(status || q || disputeOnly);
  const hasMore = total !== null && projects.length < total;

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">Projects</h1>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search title, description, client, professional..."
            value={qDraft}
            onChange={(e) => setQDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && applySearch()}
            className="pl-9"
          />
        </div>
        <Button onClick={applySearch} size="sm">Search</Button>
        <button
          onClick={() => setDisputeOnly((v) => !v)}
          className={`flex items-center gap-1.5 text-xs font-medium rounded-full px-3 py-1.5 border transition-colors ${
            disputeOnly ? "bg-amber-100 text-amber-800 border-amber-300" : "bg-background text-muted-foreground border-input hover:bg-muted"
          }`}
        >
          <AlertTriangle className="h-3 w-3" /> Open disputes only
        </button>
        {filtersActive && (
          <button onClick={() => { setStatus(""); setDisputeOnly(false); clearSearch(); }} className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1">
            <X className="h-3 w-3" /> Clear filters
          </button>
        )}
      </div>

      <div className="flex gap-2 flex-wrap">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setStatus(tab.value)}
            className={`text-xs font-medium rounded-full px-3 py-1.5 border transition-colors ${
              status === tab.value
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-background text-muted-foreground border-input hover:bg-muted"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <p className="text-xs text-muted-foreground">
        {total !== null ? <>{projects.length} of {total} project{total === 1 ? "" : "s"}</> : "Loading…"}
      </p>

      {loading && projects.length === 0 && <p className="text-sm text-muted-foreground">Loading…</p>}
      {!loading && projects.length === 0 && (
        <div className="rounded-xl border bg-background p-10 text-center">
          <p className="text-sm text-muted-foreground">No projects match your filters.</p>
          {filtersActive && (
            <button onClick={() => { setStatus(""); setDisputeOnly(false); clearSearch(); }} className="text-xs text-primary hover:underline mt-2">Clear filters</button>
          )}
        </div>
      )}

      <div className="rounded-xl border bg-background divide-y">
        {projects.map((p) => (
          <div key={p.id} className="flex items-center justify-between gap-3 p-4 flex-wrap">
            <Link href={`/admin/projects/${p.id}`} className="min-w-0 flex-1 hover:opacity-80 transition-opacity">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-medium text-sm truncate">{p.title}</p>
                <Badge className={`text-xs rounded-full ${STATUS_COLORS[p.status]}`}>{p.status.replace("_", " ")}</Badge>
                {p.has_open_dispute && (
                  <Badge className="text-xs rounded-full bg-amber-100 text-amber-800">
                    <AlertTriangle className="h-3 w-3 mr-1" /> Disputed
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {p.client_name ? `Client: ${p.client_name}` : "Client: —"}
                {p.assigned_professional_name ? ` · Pro: ${p.assigned_professional_name}` : ""}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {formatBudgetRange(p.budget_min, p.budget_max)} · {p.bid_count} proposal{p.bid_count === 1 ? "" : "s"} · {p.progress}% · {new Date(p.created_at).toLocaleDateString()}
              </p>
            </Link>
            <div className="flex items-center gap-2 shrink-0">
              {p.status !== "cancelled" && p.status !== "completed" && (
                <Button size="sm" variant="outline" disabled={busyId === p.id} onClick={() => cancel(p.id)}>
                  {busyId === p.id ? "Cancelling..." : "Cancel"}
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>

      {hasMore && (
        <div className="flex justify-center">
          <Button variant="outline" onClick={() => load(true)} disabled={loading}>
            {loading ? "Loading..." : `Load more (${(total ?? 0) - projects.length} remaining)`}
          </Button>
        </div>
      )}
    </div>
  );
}
