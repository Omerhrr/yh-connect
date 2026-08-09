"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { BackButton } from "@/components/site/BackButton";
import { api, type AdminUserDetailOut } from "@/lib/api";
import { PROJECT_STATUS_COLORS, BID_STATUS_COLORS } from "@/lib/statusColors";
import { toast } from "sonner";

function fmtNaira(n: number) {
  return `₦${n.toLocaleString()}`;
}

export default function AdminUserDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [data, setData] = useState<AdminUserDetailOut | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.adminUserDetail(id).then(setData).catch(() => toast.error("Could not load user")).finally(() => setLoading(false));
  }, [id]);

  if (loading) return <p className="p-6 text-sm text-muted-foreground">Loading…</p>;
  if (!data) return <p className="p-6 text-sm text-muted-foreground">User not found.</p>;

  return (
    <div className="space-y-5 max-w-3xl">
      <BackButton fallbackHref="/admin/users" />

      <div className="rounded-xl border bg-background p-6 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold">{data.first_name} {data.last_name}</h1>
            <p className="text-sm text-muted-foreground">{data.email}{data.phone ? ` · ${data.phone}` : ""}</p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <Badge variant="outline" className="text-xs rounded-full capitalize">{data.role}</Badge>
            {!data.is_active && <Badge className="text-xs rounded-full bg-red-100 text-red-600">Suspended</Badge>}
          </div>
        </div>
        {data.company_name && (
          <p className="text-xs text-muted-foreground">
            {data.company_name}{data.is_verified_business ? " (verified business)" : ""}
            {data.industry ? ` · ${data.industry}` : ""}
          </p>
        )}
        <p className="text-xs text-muted-foreground">Joined {new Date(data.created_at).toLocaleDateString()}</p>
      </div>

      {data.professional_profile && (
        <div className="rounded-xl border bg-background p-6 space-y-3">
          <h2 className="text-sm font-semibold">Professional Profile</h2>
          <p className="text-sm font-medium">{data.professional_profile.title}</p>
          {data.professional_profile.bio && <p className="text-sm text-muted-foreground">{data.professional_profile.bio}</p>}
          <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
            <span>Category: {data.professional_profile.category.label}</span>
            {data.professional_profile.location && <span>Location: {data.professional_profile.location}</span>}
            {data.professional_profile.hourly_rate && <span>Rate: ₦{data.professional_profile.hourly_rate}/hr</span>}
            <span>Verification: {data.professional_profile.verification_status}</span>
            <span>Rating: {data.professional_profile.rating || "New"} ({data.professional_profile.review_count})</span>
          </div>
          {data.professional_profile.skills.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {data.professional_profile.skills.map((sk) => <Badge key={sk} variant="secondary" className="text-xs rounded-full">{sk}</Badge>)}
            </div>
          )}
        </div>
      )}

      {data.role === "client" && (
        <div className="rounded-xl border bg-background p-6 space-y-3">
          <h2 className="text-sm font-semibold">Projects Posted ({data.projects.length})</h2>
          {data.projects.length === 0 && <p className="text-sm text-muted-foreground">No projects posted yet.</p>}
          {data.projects.map((p) => (
            <Link
              key={p.id}
              href={`/admin/projects/${p.id}`}
              className="border-t pt-3 first:border-t-0 first:pt-0 flex items-start justify-between gap-3 block hover:bg-muted/30 -mx-2 px-2 rounded-md"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{p.title}</p>
                <p className="text-xs text-muted-foreground">{fmtNaira(p.budget_min)} – {fmtNaira(p.budget_max)}</p>
              </div>
              <Badge className={`text-xs rounded-full shrink-0 ${PROJECT_STATUS_COLORS[p.status]}`}>{p.status.replace("_", " ")}</Badge>
            </Link>
          ))}
        </div>
      )}

      {data.role === "professional" && (
        <div className="rounded-xl border bg-background p-6 space-y-3">
          <h2 className="text-sm font-semibold">Bids Submitted ({data.bids.length})</h2>
          {data.bids.length === 0 && <p className="text-sm text-muted-foreground">No bids submitted yet.</p>}
          {data.bids.map((b) => (
            <Link
              key={b.id}
              href={`/admin/projects/${b.project_id}`}
              className="border-t pt-3 first:border-t-0 first:pt-0 flex items-start justify-between gap-3 block hover:bg-muted/30 -mx-2 px-2 rounded-md"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{b.project_title || "Untitled project"}</p>
                <p className="text-xs text-muted-foreground">{fmtNaira(b.amount)}</p>
              </div>
              <Badge className={`text-xs rounded-full shrink-0 ${BID_STATUS_COLORS[b.status]}`}>{b.status}</Badge>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
