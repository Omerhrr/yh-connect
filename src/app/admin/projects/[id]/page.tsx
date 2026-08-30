"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { AlertTriangle, Mail, Phone, ShieldCheck, UserX } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BackButton } from "@/components/site/BackButton";
import { api, ApiError, type AdminProjectDetailOut, type AdminProjectParty } from "@/lib/api";
import { PROJECT_STATUS_COLORS, BID_STATUS_COLORS, MILESTONE_STATUS_COLORS, DISPUTE_STATUS_COLORS, WALLET_TX_TYPE_COLORS, WALLET_TX_STATUS_COLORS } from "@/lib/statusColors";
import { formatNaira as fmtNaira, formatBudgetRange } from "@/lib/utils";
import Link from "next/link";
import { toast } from "sonner";

function PartyCard({ label, party, roleHref }: { label: string; party?: AdminProjectParty | null; roleHref?: string }) {
  if (!party) {
    return (
      <div className="rounded-xl border bg-background p-4">
        <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">{label}</p>
        <p className="text-sm text-muted-foreground mt-1">Not assigned yet</p>
      </div>
    );
  }
  return (
    <div className="rounded-xl border bg-background p-4 space-y-1.5">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">{label}</p>
        {!party.is_active && (
          <Badge className="text-[10px] rounded-full bg-red-100 text-red-600">
            <UserX className="h-2.5 w-2.5 mr-1" /> Suspended
          </Badge>
        )}
      </div>
      {roleHref ? (
        <Link href={roleHref} className="text-sm font-semibold hover:underline">{party.name}</Link>
      ) : (
        <p className="text-sm font-semibold">{party.name}</p>
      )}
      <p className="text-xs text-muted-foreground flex items-center gap-1.5"><Mail className="h-3 w-3" /> {party.email}</p>
      {party.phone && <p className="text-xs text-muted-foreground flex items-center gap-1.5"><Phone className="h-3 w-3" /> {party.phone}</p>}
      <Link href={`/admin/payments?user=${party.id}`} className="text-xs text-primary hover:underline inline-block pt-1">View transactions</Link>
    </div>
  );
}

function FinStat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-lg border bg-muted/20 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-sm font-bold mt-0.5 ${tone || ""}`}>{value}</p>
    </div>
  );
}

export default function AdminProjectDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [data, setData] = useState<AdminProjectDetailOut | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);

  const load = () => {
    setLoading(true);
    api.adminProjectDetail(id).then(setData).catch(() => toast.error("Could not load project")).finally(() => setLoading(false));
  };

  useEffect(load, [id]);
  const cancelProject = async () => {
    if (!confirm("Force-cancel this project? Any escrowed milestone funds are refunded to the client automatically.")) return;
    setCancelling(true);
    try {
      await api.cancelAdminProject(id);
      toast.success("Project cancelled and any escrowed funds refunded");
      load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not cancel project");
    } finally {
      setCancelling(false);
    }
  };

  if (loading) return <p className="p-6 text-sm text-muted-foreground">Loading…</p>;
  if (!data) return <p className="p-6 text-sm text-muted-foreground">Project not found.</p>;

  const { project, client, professional, bids, milestones, disputes, financials, wallet_transactions } = data;
  const openDisputes = disputes.filter((d) => d.status === "open" || d.status === "under_review" || d.status === "escalated");

  return (
    <div className="space-y-5 max-w-4xl">
      <div className="flex items-center justify-between">
        <BackButton fallbackHref="/admin/projects" />
        {project.status !== "cancelled" && project.status !== "completed" && (
          <Button size="sm" variant="outline" disabled={cancelling} onClick={cancelProject}>
            {cancelling ? "Cancelling..." : "Force Cancel Project"}
          </Button>
        )}
      </div>

      {openDisputes.length > 0 && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <p>
            {openDisputes.length} open dispute{openDisputes.length === 1 ? "" : "s"} on this project.{" "}
            <Link href={`/admin/disputes/${openDisputes[0].id}`} className="underline font-medium">Review now</Link>
          </p>
        </div>
      )}

      <div className="rounded-xl border bg-background p-6 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <Badge variant="outline" className="text-xs rounded-full mb-2">{project.category.label}</Badge>
            <h1 className="text-xl font-bold">{project.title}</h1>
          </div>
          <Badge className={`text-xs rounded-full shrink-0 ${PROJECT_STATUS_COLORS[project.status]}`}>{project.status.replace("_", " ")}</Badge>
        </div>
        <p className="text-sm text-muted-foreground whitespace-pre-wrap">{project.description}</p>
        <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
          <span>Budget: {formatBudgetRange(project.budget_min, project.budget_max, project.budget_type === "hourly")} ({project.budget_type})</span>
          {project.location && <span>Location: {project.location}</span>}
          <span>Posted: {new Date(project.created_at).toLocaleDateString()}</span>
          <span>Progress: {project.progress}%</span>
        </div>
        {project.client_company_name && (
          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
            {project.client_is_verified_business && <ShieldCheck className="h-3 w-3 text-emerald-600" />}
            Client company: {project.client_company_name}{project.client_is_verified_business ? " (verified business)" : ""}
          </p>
        )}
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <PartyCard label="Client" party={client} />
        <PartyCard label="Assigned Professional" party={professional} />
      </div>

      <div className="rounded-xl border bg-background p-6 space-y-3">
        <h2 className="text-sm font-semibold">Escrow &amp; Financials</h2>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <FinStat label="Funded" value={fmtNaira(financials.total_funded)} />
          <FinStat label="Released" value={fmtNaira(financials.total_released)} />
          <FinStat label="Refunded" value={fmtNaira(financials.total_refunded)} />
          <FinStat label="In Escrow" value={fmtNaira(financials.in_escrow)} tone="text-emerald-600" />
          <FinStat label="Platform Fees" value={fmtNaira(financials.platform_fees)} tone="text-emerald-600" />
        </div>
        {wallet_transactions.length > 0 && (
          <div className="divide-y border-t pt-2 mt-1">
            {wallet_transactions.map((t) => (
              <div key={t.id} className="flex items-center justify-between py-2 text-xs">
                <div className="flex items-center gap-2">
                  <Badge className={`rounded-full ${WALLET_TX_TYPE_COLORS[t.type]}`}>{t.type}</Badge>
                  <Badge className={`rounded-full ${WALLET_TX_STATUS_COLORS[t.status]}`}>{t.status}</Badge>
                  <span className="text-muted-foreground">{new Date(t.created_at).toLocaleDateString()}</span>
                </div>
                <span className="font-medium">{fmtNaira(t.amount)}</span>
              </div>
            ))}
          </div>
        )}
        {wallet_transactions.length === 0 && (
          <p className="text-xs text-muted-foreground">No wallet activity on this project yet.</p>
        )}
      </div>

      <div className="rounded-xl border bg-background p-6 space-y-3">
        <h2 className="text-sm font-semibold">Bids ({bids.length})</h2>
        {bids.length === 0 && <p className="text-sm text-muted-foreground">No bids yet.</p>}
        {bids.map((b) => (
          <div key={b.id} className="border-t pt-3 first:border-t-0 first:pt-0 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium">{b.professional_name || "Unknown"}</p>
              <p className="text-xs text-muted-foreground">{fmtNaira(b.amount)}{b.estimated_days ? ` · ${b.estimated_days} days` : ""}</p>
            </div>
            <Badge className={`text-xs rounded-full shrink-0 ${BID_STATUS_COLORS[b.status]}`}>{b.status}</Badge>
          </div>
        ))}
      </div>

      <div className="rounded-xl border bg-background p-6 space-y-3">
        <h2 className="text-sm font-semibold">Milestones ({milestones.length})</h2>
        {milestones.length === 0 && <p className="text-sm text-muted-foreground">No milestones yet.</p>}
        {milestones.map((m) => (
          <div key={m.id} className="border-t pt-3 first:border-t-0 first:pt-0 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium">{m.title}</p>
              <p className="text-xs text-muted-foreground">{fmtNaira(m.amount)}</p>
            </div>
            <Badge className={`text-xs rounded-full shrink-0 ${MILESTONE_STATUS_COLORS[m.status]}`}>{m.status.replace("_", " ")}</Badge>
          </div>
        ))}
      </div>

      {disputes.length > 0 && (
        <div className="rounded-xl border bg-background p-6 space-y-3">
          <h2 className="text-sm font-semibold">Disputes ({disputes.length})</h2>
          {disputes.map((d) => (
            <Link key={d.id} href={`/admin/disputes/${d.id}`} className="block border-t pt-3 first:border-t-0 first:pt-0 hover:bg-muted/30 -mx-2 px-2 rounded-md">
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-medium">{d.reason}</p>
                <Badge className={`text-xs rounded-full shrink-0 ${DISPUTE_STATUS_COLORS[d.status]}`}>{d.status.replace("_", " ")}</Badge>
              </div>
              {d.resolution_note && <p className="text-xs text-muted-foreground mt-1">Resolution: {d.resolution_note}</p>}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
