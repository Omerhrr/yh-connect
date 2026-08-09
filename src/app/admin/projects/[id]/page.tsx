"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { BackButton } from "@/components/site/BackButton";
import { api, type AdminProjectDetailOut } from "@/lib/api";
import { PROJECT_STATUS_COLORS, BID_STATUS_COLORS, MILESTONE_STATUS_COLORS, DISPUTE_STATUS_COLORS } from "@/lib/statusColors";
import Link from "next/link";
import { toast } from "sonner";

function fmtNaira(n: number) {
  return `₦${n.toLocaleString()}`;
}

export default function AdminProjectDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [data, setData] = useState<AdminProjectDetailOut | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.adminProjectDetail(id).then(setData).catch(() => toast.error("Could not load project")).finally(() => setLoading(false));
  }, [id]);

  if (loading) return <p className="p-6 text-sm text-muted-foreground">Loading…</p>;
  if (!data) return <p className="p-6 text-sm text-muted-foreground">Project not found.</p>;

  const { project, bids, milestones, disputes } = data;

  return (
    <div className="space-y-5 max-w-3xl">
      <BackButton fallbackHref="/admin/projects" />

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
          <span>Budget: {fmtNaira(project.budget_min)} – {fmtNaira(project.budget_max)} ({project.budget_type})</span>
          {project.location && <span>Location: {project.location}</span>}
          <span>Posted: {new Date(project.created_at).toLocaleDateString()}</span>
        </div>
        {project.client_company_name && (
          <p className="text-xs text-muted-foreground">
            Client: {project.client_company_name}{project.client_is_verified_business ? " (verified)" : ""}
          </p>
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
