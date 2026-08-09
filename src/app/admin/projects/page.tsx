"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { api, ApiError, type AdminProjectOut } from "@/lib/api";
import { PROJECT_STATUS_COLORS as STATUS_COLORS } from "@/lib/statusColors";
import { toast } from "sonner";
import Link from "next/link";

function fmtNaira(n: number) {
  return `₦${n.toLocaleString()}`;
}

export default function AdminProjectsPage() {
  const [projects, setProjects] = useState<AdminProjectOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    api.adminProjects().then(setProjects).catch(() => toast.error("Could not load projects")).finally(() => setLoading(false));
  };

  useEffect(load, []);

  const cancel = async (id: string) => {
    if (!confirm("Force-cancel this project?")) return;
    setBusyId(id);
    try {
      await api.cancelAdminProject(id);
      toast.success("Project cancelled");
      load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not cancel project");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">Projects</h1>
      {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
      <div className="rounded-xl border bg-background divide-y">
        {!loading && projects.length === 0 && <p className="p-5 text-sm text-muted-foreground">No projects yet.</p>}
        {projects.map((p) => (
          <div key={p.id} className="flex items-center justify-between gap-3 p-4">
            <Link href={`/admin/projects/${p.id}`} className="min-w-0 hover:underline">
              <p className="font-medium text-sm truncate">{p.title}</p>
              <p className="text-xs text-muted-foreground">{fmtNaira(p.budget_min)} – {fmtNaira(p.budget_max)} · {new Date(p.created_at).toLocaleDateString()}</p>
            </Link>
            <div className="flex items-center gap-2 shrink-0">
              <Badge className={`text-xs rounded-full ${STATUS_COLORS[p.status]}`}>{p.status.replace("_", " ")}</Badge>
              {p.status !== "cancelled" && p.status !== "completed" && (
                <Button size="sm" variant="outline" disabled={busyId === p.id} onClick={() => cancel(p.id)}>
                  Cancel
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
