"use client";

import { useEffect, useState } from "react";
import { FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api, ApiError, type PendingVerification } from "@/lib/api";
import { toast } from "sonner";

export default function AdminVerificationsPage() {
  const [items, setItems] = useState<PendingVerification[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    api.pendingVerifications().then(setItems).catch(() => toast.error("Could not load verifications")).finally(() => setLoading(false));
  };

  useEffect(load, []);

  const review = async (profileId: string, status: "verified" | "rejected") => {
    setBusyId(profileId);
    try {
      await api.reviewVerification(profileId, { status });
      toast.success(status === "verified" ? "Approved" : "Rejected");
      load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not update verification");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">Verifications</h1>
      <p className="text-sm text-muted-foreground">Professionals waiting on document review.</p>

      {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {!loading && items.length === 0 && <p className="text-sm text-muted-foreground">No pending verifications.</p>}

      <div className="rounded-xl border bg-background divide-y">
        {items.map((p) => (
          <div key={p.profile_id} className="p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-sm">{p.name}</p>
                <p className="text-xs text-muted-foreground">{p.title}</p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" disabled={busyId === p.profile_id} onClick={() => review(p.profile_id, "rejected")}>
                  Reject
                </Button>
                <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" disabled={busyId === p.profile_id} onClick={() => review(p.profile_id, "verified")}>
                  Approve
                </Button>
              </div>
            </div>
            <div className="flex flex-wrap gap-3 text-xs">
              {p.id_document_url && (
                <a href={p.id_document_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                  <FileText className="h-3.5 w-3.5" /> ID document
                </a>
              )}
              {p.license_document_url && (
                <a href={p.license_document_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                  <FileText className="h-3.5 w-3.5" /> License
                </a>
              )}
              {p.insurance_document_url && (
                <a href={p.insurance_document_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                  <FileText className="h-3.5 w-3.5" /> Insurance
                </a>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
