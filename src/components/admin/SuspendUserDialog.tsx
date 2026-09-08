"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api, ApiError, type AdminUserOut } from "@/lib/api";
import { toast } from "sonner";

export function SuspendUserDialog({
  user,
  onClose,
  onDone,
}: {
  user: Pick<AdminUserOut, "id" | "first_name" | "last_name">;
  onClose: () => void;
  onDone: (u: AdminUserOut) => void;
}) {
  const [mode, setMode] = useState<"days" | "notice" | "forever">("days");
  const [days, setDays] = useState("7");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (mode === "forever" && !confirm(`This permanently deletes ${user.first_name} ${user.last_name}'s account — they can never log in again. This can't be undone. Continue?`)) return;
    setSubmitting(true);
    try {
      const payload =
        mode === "forever" ? { forever: true, reason: reason || undefined }
        : mode === "notice" ? { until_further_notice: true, reason: reason || undefined }
        : { duration_days: Math.max(1, parseInt(days) || 1), reason: reason || undefined };
      const updated = await api.suspendUser(user.id, payload);
      toast.success(mode === "forever" ? "Account deleted" : "User suspended");
      onDone(updated);
      onClose();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not suspend user");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-xl border bg-background p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold">Suspend {user.first_name} {user.last_name}</h2>
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm">
            <input type="radio" checked={mode === "days"} onChange={() => setMode("days")} />
            For a set number of days
          </label>
          {mode === "days" && (
            <Input type="number" min="1" value={days} onChange={(e) => setDays(e.target.value)} className="ml-6 w-28 h-8" />
          )}
          <label className="flex items-center gap-2 text-sm">
            <input type="radio" checked={mode === "notice"} onChange={() => setMode("notice")} />
            Until further notice (manual unsuspend)
          </label>
          <label className="flex items-center gap-2 text-sm text-red-600">
            <input type="radio" checked={mode === "forever"} onChange={() => setMode("forever")} />
            Forever — permanently delete the account
          </label>
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Reason (shown to the user)</label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none"
            rows={2}
          />
        </div>
        <div className="flex gap-2 pt-1">
          <Button variant="outline" className="flex-1" onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button className="flex-1" variant={mode === "forever" ? "destructive" : "default"} onClick={submit} disabled={submitting}>
            {submitting ? "Working..." : mode === "forever" ? "Delete Account" : "Suspend"}
          </Button>
        </div>
      </div>
    </div>
  );
}
