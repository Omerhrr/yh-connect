"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { api, ApiError, type AdminContractRow } from "@/lib/api";
import { toast } from "sonner";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, Circle, FileText } from "lucide-react";

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  sent_to_client: "Sent to client",
  sent_to_professional: "Sent to talent",
  approved: "Approved",
};

export default function AdminContractsPage() {
  const [rows, setRows] = useState<AdminContractRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "stalled" | "escalated" | "approved" | "pending">("all");
  const [nudging, setNudging] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    api.adminListContracts().then(setRows).catch(() => toast.error("Could not load contracts")).finally(() => setLoading(false));
  };
  useEffect(load, []);

  const stalledCount = rows.filter((r) => r.stalled).length;
  const escalatedCount = rows.filter((r) => r.escalated).length;

  const filtered = rows.filter((r) => {
    if (filter === "stalled") return r.stalled;
    if (filter === "escalated") return r.escalated;
    if (filter === "approved") return r.status === "approved";
    if (filter === "pending") return r.status !== "approved";
    return true;
  });

  const nudge = async (id: string) => {
    setNudging(id);
    try {
      const res = await api.adminNudgeContract(id);
      toast.success(`Reminder sent to ${res.notified} part${res.notified === 1 ? "y" : "ies"}`);
      load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not send reminder");
    } finally {
      setNudging(null);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold">Contracts</h1>
        <div className="flex items-center gap-2">
          {escalatedCount > 0 && <Badge className="text-xs rounded-full bg-red-100 text-red-700">{escalatedCount} escalated</Badge>}
          {stalledCount > 0 && <Badge className="text-xs rounded-full bg-amber-100 text-amber-700">{stalledCount} stalled</Badge>}
        </div>
      </div>
      <p className="text-sm text-muted-foreground">
        Every auto-generated contract between bid acceptance and job start, with approval and acceptance-fee status. A contract is flagged stalled if it's been sitting fully-sent, unapproved by at least one side, for more than a day — and escalated once we've auto-notified support that it's a genuine standoff.
      </p>

      <div className="flex items-center gap-1 border-b">
        {(["all", "escalated", "stalled", "pending", "approved"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors capitalize ${filter === f ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="rounded-xl border bg-background divide-y">
        {loading && <p className="p-4 text-sm text-muted-foreground">Loading...</p>}
        {!loading && filtered.length === 0 && <p className="p-4 text-sm text-muted-foreground">No contracts match this filter.</p>}
        {filtered.map((r) => (
          <div key={r.id} className="p-4 flex items-center justify-between gap-3 flex-wrap">
            <div className="min-w-0 space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <Link href={`/admin/projects/${r.project_id}`} className="text-sm font-medium hover:underline truncate">
                  {r.project_title || "Untitled project"}
                </Link>
                {r.escalated && (
                  <Badge className="text-xs rounded-full bg-red-100 text-red-700 flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" /> Escalated
                  </Badge>
                )}
                {!r.escalated && r.stalled && (
                  <Badge className="text-xs rounded-full bg-amber-100 text-amber-700 flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" /> Stalled
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Client: {r.client_name || "—"} · Talent: {r.professional_name || "—"} · v{r.version} · updated {new Date(r.updated_at).toLocaleDateString()}
              </p>
              <div className="flex items-center gap-3 text-xs">
                <span className={r.client_approved ? "text-emerald-700" : "text-muted-foreground"}>
                  {r.client_approved ? <CheckCircle2 className="h-3 w-3 inline mr-1" /> : <Circle className="h-3 w-3 inline mr-1" />}
                  Client approved
                </span>
                <span className={r.professional_approved ? "text-emerald-700" : "text-muted-foreground"}>
                  {r.professional_approved ? <CheckCircle2 className="h-3 w-3 inline mr-1" /> : <Circle className="h-3 w-3 inline mr-1" />}
                  Talent approved
                </span>
                <span className={r.acceptance_fee_paid ? "text-emerald-700" : "text-muted-foreground"}>
                  {r.acceptance_fee_paid ? <CheckCircle2 className="h-3 w-3 inline mr-1" /> : <Circle className="h-3 w-3 inline mr-1" />}
                  Acceptance fee paid
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Badge className={`text-xs rounded-full capitalize ${r.status === "approved" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-700"}`}>
                {STATUS_LABELS[r.status] || r.status}
              </Badge>
              {r.status !== "approved" && (
                <Button size="sm" variant="outline" disabled={nudging === r.id} onClick={() => nudge(r.id)}>
                  {nudging === r.id ? "Sending..." : "Nudge"}
                </Button>
              )}
              <Link href={`/admin/projects/${r.project_id}`}>
                <Button size="sm" variant="ghost"><FileText className="h-3.5 w-3.5" /></Button>
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
