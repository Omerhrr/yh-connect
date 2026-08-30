"use client";

import { use, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  api,
  ApiError,
  type DisputeDetailOut,
  type DisputeOutcome,
  DISPUTE_CATEGORY_LABELS,
  DISPUTE_OUTCOME_LABELS,
} from "@/lib/api";
import { DISPUTE_STATUS_COLORS as STATUS_COLORS, MILESTONE_STATUS_COLORS } from "@/lib/statusColors";
import { toast } from "sonner";
import Link from "next/link";
import { Landmark } from "lucide-react";

const STATUS_LABELS: Record<string, string> = {
  open: "Open",
  under_review: "Under review",
  escalated: "Escalated",
  resolved: "Resolved",
  withdrawn: "Withdrawn",
};

const OUTCOMES: DisputeOutcome[] = ["release_professional", "refund_client", "partial_split", "no_action"];

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [dispute, setDispute] = useState<DisputeDetailOut | null>(null);
  const [loading, setLoading] = useState(true);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [note, setNote] = useState("");
  const [outcome, setOutcome] = useState<DisputeOutcome>("release_professional");
  const [splitAmount, setSplitAmount] = useState("");
  const [busy, setBusy] = useState(false);

  const load = () => {
    api.adminDisputeDetail(id).then(setDispute).catch(() => toast.error("Could not load this dispute")).finally(() => setLoading(false));
  };
  useEffect(load, [id]);
  const isClosed = dispute?.status === "resolved" || dispute?.status === "withdrawn";

  const sendReply = async () => {
    if (!reply.trim() || !dispute) return;
    setSending(true);
    try {
      await api.addDisputeMessage(dispute.id, reply.trim());
      setReply("");
      load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not send message");
    } finally {
      setSending(false);
    }
  };

  const updateStatus = async (status: "under_review" | "escalated" | "resolved") => {
    if (!dispute) return;
    if (status === "resolved" && outcome === "partial_split" && !splitAmount) {
      return toast.error("Enter how much of the milestone amount goes to the professional");
    }
    if (status === "resolved" && !confirm(`Resolve this dispute with outcome "${DISPUTE_OUTCOME_LABELS[outcome]}"? This may trigger a real fund transfer.`)) return;
    setBusy(true);
    try {
      const updated = await api.resolveDispute(dispute.id, {
        status,
        outcome: status === "resolved" ? outcome : undefined,
        resolution_note: note || undefined,
        split_professional_amount: status === "resolved" && outcome === "partial_split" ? Number(splitAmount) : undefined,
      });
      setDispute(updated);
      setNote("");
      toast.success(status === "resolved" ? "Dispute resolved" : `Marked ${STATUS_LABELS[status].toLowerCase()}`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not update dispute");
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (!dispute) return <p className="text-sm text-muted-foreground">Dispute not found.</p>;

  return (
    <div className="space-y-5 max-w-2xl">
      <Link href="/admin/disputes" className="text-sm text-muted-foreground hover:text-foreground">← Back to Disputes</Link>

      <div className="rounded-xl border bg-background p-5 space-y-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold">
                <Link href={`/admin/projects/${dispute.project_id}`} className="hover:underline">{dispute.project_title || "Dispute"}</Link>
              </h1>
              <Badge variant="outline" className="text-xs rounded-full">{DISPUTE_CATEGORY_LABELS[dispute.category]}</Badge>
            </div>
            {dispute.milestone_title && (
              <p className="text-sm text-muted-foreground mt-1">
                Milestone: {dispute.milestone_title}{dispute.milestone_amount != null && ` (₦${dispute.milestone_amount.toLocaleString("en-NG")})`}
              </p>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              Filed by{" "}
              <Link href={`/admin/users/${dispute.raised_by}`} className="text-primary hover:underline">{dispute.raised_by_name || "Unknown"}</Link>
              {" against "}
              {dispute.other_party_id ? (
                <Link href={`/admin/users/${dispute.other_party_id}`} className="text-primary hover:underline">{dispute.other_party_name || "Unknown"}</Link>
              ) : (
                dispute.other_party_name || "Unknown"
              )}
              {" · "}{new Date(dispute.created_at).toLocaleDateString()}
            </p>
          </div>
          <Badge className={`text-xs rounded-full ${STATUS_COLORS[dispute.status]}`}>{STATUS_LABELS[dispute.status]}</Badge>
        </div>

        <p className="text-sm whitespace-pre-wrap">{dispute.reason}</p>

        {dispute.evidence_urls.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {dispute.evidence_urls.map((url) => (
              <a key={url} href={url} target="_blank" rel="noopener noreferrer" className="block">
                {}
                <img src={url} alt="Evidence" className="h-20 w-20 rounded-lg object-cover border hover:opacity-80 transition-opacity" />
              </a>
            ))}
          </div>
        )}

        {dispute.status === "resolved" && (
          <div className="rounded-lg bg-green-50 border border-green-200 p-3 text-sm">
            <p className="font-medium text-green-800">Resolved — {dispute.outcome && DISPUTE_OUTCOME_LABELS[dispute.outcome]}</p>
            {dispute.resolution_note && <p className="text-green-700 mt-1">{dispute.resolution_note}</p>}
            {dispute.resolved_by_name && <p className="text-xs text-green-700/70 mt-1">By {dispute.resolved_by_name}</p>}
          </div>
        )}
      </div>

      {dispute.milestone_id && (
        <div className="rounded-xl border bg-background p-5 space-y-2">
          <h2 className="font-semibold text-sm flex items-center gap-1.5"><Landmark className="h-4 w-4 text-muted-foreground" /> Escrow Context</h2>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{dispute.milestone_title || "Milestone"}</p>
              <p className="text-xs text-muted-foreground">
                {dispute.milestone_amount != null && <>Amount: ₦{dispute.milestone_amount.toLocaleString("en-NG")} · </>}
                Linked milestone on <Link href={`/admin/projects/${dispute.project_id}`} className="text-primary hover:underline">this project</Link>
              </p>
            </div>
            {dispute.milestone_status && (
              <Badge className={`text-xs rounded-full ${MILESTONE_STATUS_COLORS[dispute.milestone_status]}`}>
                {dispute.milestone_status.replace("_", " ")}
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {dispute.milestone_status === "funded" || dispute.milestone_status === "paid"
              ? "Funds are (or were) held in escrow for this milestone, so a release/refund outcome can be executed."
              : "This milestone is not currently holding escrow funds — releasing or refunding will have no money to move until it is funded."}
          </p>
        </div>
      )}

      {!isClosed && (
        <div className="rounded-xl border bg-background p-5 space-y-3">
          <h2 className="font-semibold text-sm">Take Action</h2>
          <textarea
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Resolution note (shown to both parties)..."
            className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none"
          />
          <div className="flex flex-wrap gap-2 items-center">
            <select
              value={outcome}
              onChange={(e) => setOutcome(e.target.value as DisputeOutcome)}
              className="flex h-9 rounded-md border border-input bg-background px-3 text-sm"
            >
              {OUTCOMES.map((o) => {
                const milestoneHasFundsAtStake = !!dispute.milestone_id && (dispute.milestone_status === "funded" || dispute.milestone_status === "approved");
                const disabled = (o === "no_action" && milestoneHasFundsAtStake) || (o === "partial_split" && !dispute.milestone_id);
                return (
                  <option key={o} value={o} disabled={disabled}>{DISPUTE_OUTCOME_LABELS[o]}{disabled ? " (unavailable)" : ""}</option>
                );
              })}
            </select>
            {outcome === "partial_split" && (
              <Input
                type="number"
                min="0"
                max={dispute.milestone_amount ?? undefined}
                value={splitAmount}
                onChange={(e) => setSplitAmount(e.target.value)}
                placeholder="₦ to professional"
                className="h-9 w-40"
              />
            )}
            <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" disabled={busy} onClick={() => updateStatus("resolved")}>
              Resolve
            </Button>
            {dispute.status !== "under_review" && (
              <Button size="sm" variant="outline" disabled={busy} onClick={() => updateStatus("under_review")}>Mark Under Review</Button>
            )}
            {dispute.status !== "escalated" && (
              <Button size="sm" variant="outline" disabled={busy} onClick={() => updateStatus("escalated")}>Escalate</Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            &quot;Release funds to professional&quot; and &quot;Refund the client&quot; trigger a real payout/refund on the milestone in escrow, if one is linked and funded.
          </p>
        </div>
      )}

      <div className="rounded-xl border bg-background">
        <div className="p-4 border-b font-semibold text-sm">Discussion</div>
        <div className="divide-y">
          {dispute.messages.length === 0 && <p className="p-4 text-sm text-muted-foreground">No messages yet.</p>}
          {dispute.messages.map((m) => (
            <div key={m.id} className="p-4">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium">{m.sender_name}</p>
                {m.is_admin && <Badge className="text-[10px] rounded-full bg-slate-800 text-white">Admin</Badge>}
                <span className="text-xs text-muted-foreground">{new Date(m.created_at).toLocaleString()}</span>
              </div>
              <p className="text-sm mt-1 whitespace-pre-wrap">{m.body}</p>
            </div>
          ))}
        </div>
        {!isClosed ? (
          <div className="p-4 border-t flex items-center gap-2">
            <Input value={reply} onChange={(e) => setReply(e.target.value)} onKeyDown={(e) => e.key === "Enter" && sendReply()} placeholder="Ask a clarifying question..." className="h-9" />
            <Button size="sm" onClick={sendReply} disabled={sending || !reply.trim()}>Send</Button>
          </div>
        ) : (
          <div className="p-4 border-t"><p className="text-xs text-muted-foreground">This dispute is closed.</p></div>
        )}
      </div>

      <div className="rounded-xl border bg-background">
        <div className="p-4 border-b font-semibold text-sm">Status History</div>
        <div className="divide-y">
          {dispute.events.map((e) => (
            <div key={e.id} className="p-3 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">{e.actor_name || "System"}</span>
              {" "}{e.from_status ? `moved this from ${STATUS_LABELS[e.from_status] || e.from_status} to` : "set this to"} {STATUS_LABELS[e.to_status] || e.to_status}
              {e.note && ` — ${e.note}`}
              {" "}· {new Date(e.created_at).toLocaleString()}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
