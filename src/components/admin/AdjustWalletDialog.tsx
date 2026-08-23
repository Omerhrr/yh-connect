"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Wallet } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { toast } from "sonner";
import { formatNaira as fmtNaira } from "@/lib/utils";

export function AdjustWalletDialog({
  userId,
  userName,
  balance,
  onClose,
  onDone,
}: {
  userId: string;
  userName: string;
  balance: number;
  onClose: () => void;
  onDone: () => void;
}) {
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const SANITY_CAP = 1_000_000;

  const submit = async () => {
    const n = Number(amount);
    if (!amount || isNaN(n) || n === 0) return toast.error("Enter a non-zero amount (negative to debit)");
    const verb = n > 0 ? "credit" : "debit";
    if (Math.abs(n) > SANITY_CAP && !confirm(`This will ${verb} ${fmtNaira(Math.abs(n))}, well above the usual range. Are you sure?`)) {
      return;
    }
    if (!confirm(`${n > 0 ? "Credit" : "Debit"} ${fmtNaira(Math.abs(n))} ${n > 0 ? "to" : "from"} ${userName}'s wallet? This moves real balance immediately.`)) {
      return;
    }
    setSubmitting(true);
    try {
      await api.adjustWallet(userId, { amount: n, note: note.trim() || undefined });
      toast.success(n > 0 ? `₦${n.toLocaleString()} credited` : `₦${Math.abs(n).toLocaleString()} debited`);
      onDone();
      onClose();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not adjust wallet");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-xl border bg-background p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold flex items-center gap-2"><Wallet className="h-4 w-4" /> Adjust Wallet</h2>
        <p className="text-sm">
          {userName} · balance <span className="font-semibold">{fmtNaira(balance)}</span>
        </p>
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Amount (₦)</label>
          <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Positive credits, negative debits" autoFocus />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Reason (visible to user)</label>
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Refund for cancelled milestone" />
        </div>
        <div className="flex gap-2 pt-1">
          <Button variant="outline" className="flex-1" onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button className="flex-1" onClick={submit} disabled={submitting}>{submitting ? "Saving..." : "Apply"}</Button>
        </div>
      </div>
    </div>
  );
}
