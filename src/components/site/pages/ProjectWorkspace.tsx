"use client";

import { useEffect, useState } from "react";
import {
  X,
  Plus,
  Camera,
  CheckCircle2,
  Wallet,
  Send,
  AlertTriangle,
  Star,
  BadgeCheck,
  MessageSquare,
  UserPlus,
  FileEdit,
  Search,
  ArrowLeft,
  ListChecks,
  Inbox,
  ShieldAlert,
  ChevronRight,
  Users,
  Clock,
  Milestone as MilestoneIcon,
  XCircle,
  MapPin,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/store/auth";
import {
  api,
  ApiError,
  type MilestoneOut,
  type ProjectOut,
  type BidOut,
  type ChangeOrderOut,
  type ProfessionalOut,
  type DisputeOut,
  type DisputeCategory,
  type InviteOut,
  type AccessRequestOut,
  DISPUTE_CATEGORY_LABELS,
} from "@/lib/api";
import { CATEGORIES } from "@/data/content";
import { MILESTONE_STATUS_COLORS, BID_STATUS_COLORS, PROJECT_STATUS_COLORS } from "@/lib/statusColors";
import { formatNaira as fmtNaira, formatBudgetRange } from "@/lib/utils";
import { ProjectChat } from "@/components/site/chat/ProjectChat";
import { useProjectUnread } from "@/hooks/useProjectUnread";

import { toast } from "sonner";
import Link from "next/link";

// ─── Add milestone (client only — funds it before the professional starts work) ─
function AddMilestoneForm({ projectId, onAdded }: { projectId: string; onAdded: () => void }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!title || !amount) return toast.error("Title and amount are required");
    setSubmitting(true);
    try {
      await api.createMilestone(projectId, { title, amount: Number(amount), due_date: dueDate || undefined });
      toast.success("Milestone added — fund it so the professional can start work");
      setTitle("");
      setAmount("");
      setDueDate("");
      setOpen(false);
      onAdded();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not add milestone");
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) {
    return (
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <Plus className="h-3.5 w-3.5 mr-1" /> Add Milestone
      </Button>
    );
  }

  return (
    <div className="rounded-lg border p-4 space-y-3 bg-muted/20">
      <Input placeholder="Milestone title" value={title} onChange={(e) => setTitle(e.target.value)} />
      <div className="grid grid-cols-2 gap-3">
        <Input type="number" placeholder="Amount (₦)" value={amount} onChange={(e) => setAmount(e.target.value)} />
        <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
      </div>
      <p className="text-xs text-muted-foreground">
        Fund this milestone before the professional starts work on it — that's what puts the money in escrow.
      </p>
      <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
        <Button size="sm" onClick={submit} disabled={submitting}>{submitting ? "Adding..." : "Add"}</Button>
      </div>
    </div>
  );
}

// ─── Post progress update (professional) ────────────────────────────────────
function PostUpdateForm({ milestoneId, onPosted }: { milestoneId: string; onPosted: () => void }) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    setSubmitting(true);
    try {
      const uploaded = await Promise.all(files.map((f) => api.uploadFile(f)));
      await api.postMilestoneUpdate(milestoneId, { note: note || undefined, photo_urls: uploaded.map((u) => u.url) });
      toast.success("Update posted");
      setNote("");
      setFiles([]);
      setOpen(false);
      onPosted();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not post update");
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) {
    return (
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <Camera className="h-3.5 w-3.5 mr-1" /> Post Update
      </Button>
    );
  }

  return (
    <div className="rounded-lg border p-3 space-y-2 bg-muted/20">
      <textarea
        rows={2}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="What's the progress? (e.g. Foundation excavation complete)"
        className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none"
      />
      <input
        type="file"
        accept="image/*"
        multiple
        onChange={(e) => setFiles(Array.from(e.target.files || []))}
        className="text-xs"
      />
      <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
        <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={submit} disabled={submitting}>
          {submitting ? "Posting..." : "Post"}
        </Button>
      </div>
    </div>
  );
}

// Named, action-oriented milestone states shown instead of raw enum values —
// tells each party what's true and what happens next in one line, the way
// Freelancer.com names milestone states explicitly rather than making people
// infer status from a generic badge.
function milestoneStatusCopy(m: MilestoneOut, isClient: boolean): { label: string; hint?: string } {
  const daysAgo = (iso: string) => Math.max(Math.floor((Date.now() - new Date(iso).getTime()) / 86400000), 0);
  switch (m.status) {
    case "pending":
    case "in_progress":
      return { label: "Not started", hint: isClient ? "Fund it so the professional can start work on it." : "Waiting on the client to fund this milestone before you can start work." };
    case "submitted":
      // Legacy state from before fund-before-work — the current flow keeps
      // funded milestones at "funded" through submission (see below).
      return { label: "Submitted, awaiting funding", hint: isClient ? "Fund it to review and approve." : "The client hasn't funded this milestone yet." };
    case "funded": {
      const d = m.submitted_at ? daysAgo(m.submitted_at) : null;
      const withholdNote = !isClient && m.withholding_percent > 0
        ? ` Heads up: ${m.withholding_percent}% of the payout will be held back for ${m.withholding_release_days} day${m.withholding_release_days === 1 ? "" : "s"} after release, as part of our payment protection policy.`
        : "";
      return {
        label: m.submitted_at ? "Submitted, awaiting review" : "Funded, in escrow",
        hint: m.submitted_at
          ? isClient
            ? `Delivered ${d === 0 ? "today" : `${d} day${d === 1 ? "" : "s"} ago`}. Approve to release payment instantly, or reject with a reason.`
            : "Submitted — waiting on the client's review."
          : isClient ? "Funded — the professional can start work now." : `Funded — start work, then submit it for review when it's done.${withholdNote}`,
      };
    }
    case "approved":
      return { label: "Approved", hint: `₦${m.net_to_professional.toLocaleString()} released to the professional.` };
    case "paid": {
      if (m.withheld_amount && m.withheld_amount > 0) {
        const releasedNow = m.net_to_professional - m.withheld_amount;
        const released = !!m.withheld_released_at;
        const dateStr = m.withheld_release_at ? new Date(m.withheld_release_at).toLocaleDateString() : "soon";
        return {
          label: "Paid out",
          hint: released
            ? `₦${m.net_to_professional.toLocaleString()} fully released, including the held-back portion.`
            : `₦${releasedNow.toLocaleString()} sent instantly. ₦${m.withheld_amount.toLocaleString()} is held back as payment protection and auto-releases on ${dateStr}.`,
        };
      }
      return { label: "Paid out", hint: `₦${m.net_to_professional.toLocaleString()} sent to the professional's wallet.` };
    }
    case "refunded":
      return {
        label: "Refunded to client",
        hint: isClient
          ? m.rejection_note ? `You rejected this: "${m.rejection_note}"` : "Escrowed funds were refunded to your wallet."
          : m.rejection_note ? `The client rejected this: "${m.rejection_note}"` : "The client rejected this milestone and was refunded.",
      };
    case "rejected":
      return {
        label: "Rejected",
        hint: isClient
          ? m.rejection_note ? `You rejected this: "${m.rejection_note}"` : "You rejected this milestone."
          : m.rejection_note ? `The client rejected this: "${m.rejection_note}"` : "The client rejected this milestone.",
      };
    default:
      return { label: m.status };
  }
}

// ─── Single milestone card ───────────────────────────────────────────────────
function MilestoneCard({
  milestone,
  isClient,
  isProfessional,
  assignedProfessionalId,
  disputed,
  walletBalance,
  onChanged,
}: {
  milestone: MilestoneOut;
  isClient: boolean;
  isProfessional: boolean;
  assignedProfessionalId?: string | null;
  disputed: boolean;
  walletBalance?: number;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const statusCopy = milestoneStatusCopy(milestone, isClient);

  const act = async (fn: () => Promise<unknown>, successMsg: string) => {
    setBusy(true);
    try {
      await fn();
      toast.success(successMsg);
      onChanged();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Action failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-xl border bg-background p-4 space-y-3 hover:shadow-sm transition-shadow">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className={`mt-0.5 h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${milestone.status === "paid" ? "bg-emerald-100 text-emerald-600" : "bg-muted text-muted-foreground"}`}>
            {milestone.status === "paid" ? <CheckCircle2 className="h-4 w-4" /> : <MilestoneIcon className="h-4 w-4" />}
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-sm">{milestone.title}</p>
            {milestone.created_by && assignedProfessionalId && milestone.created_by === assignedProfessionalId && (
              <p className="text-xs text-muted-foreground mt-0.5">
                Proposed by {milestone.created_by_name || "the professional"}{" "}
                {isClient && <span className="text-amber-600 font-medium">· fund to approve</span>}
              </p>
            )}
            {milestone.description && <p className="text-xs text-muted-foreground mt-0.5">{milestone.description}</p>}
            {milestone.due_date && (
              <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                <Clock className="h-3 w-3" /> Due {new Date(milestone.due_date).toLocaleDateString()}
              </p>
            )}
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="flex items-center gap-1.5 justify-end flex-wrap">
            {disputed && <Badge className="text-xs rounded-full bg-red-100 text-red-600">Disputed</Badge>}
            <Badge className={`text-xs rounded-full ${MILESTONE_STATUS_COLORS[milestone.status]}`}>{statusCopy.label}</Badge>
          </div>
          <p className="text-sm font-semibold mt-1">{fmtNaira(milestone.amount)}</p>
        </div>
      </div>

      {statusCopy.hint && !disputed && (
        <p className="text-xs text-muted-foreground">{statusCopy.hint}</p>
      )}

      {disputed && (
        <p className="text-xs bg-red-50 text-red-700 rounded-md p-2 flex items-center gap-1.5">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> This milestone has an open dispute. Funds are on hold until it's resolved.
        </p>
      )}

      {milestone.updates.length > 0 && (
        <div className="space-y-2 border-t pt-3">
          {milestone.updates.map((u) => (
            <div key={u.id} className="text-xs">
              <p className="font-medium">{u.author_name} <span className="text-muted-foreground font-normal">· {new Date(u.created_at).toLocaleDateString()}</span></p>
              {u.note && <p className="text-muted-foreground mt-0.5">{u.note}</p>}
              {u.photo_urls.length > 0 && (
                <div className="flex gap-1.5 mt-1.5 flex-wrap">
                  {u.photo_urls.map((url) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={url} src={url} alt="Progress photo" className="h-14 w-14 rounded object-cover border" />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-2 pt-1">
        {isProfessional && milestone.status === "funded" && (
          <PostUpdateForm milestoneId={milestone.id} onPosted={onChanged} />
        )}
        {isProfessional && milestone.status === "funded" && (
          <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" disabled={busy} onClick={() => act(() => api.submitMilestone(milestone.id), "Submitted for approval")}>
            <Send className="h-3.5 w-3.5 mr-1" /> {milestone.submitted_at ? "Resubmit" : "Submit for Approval"}
          </Button>
        )}
        {isClient && !disputed && (milestone.status === "pending" || milestone.status === "in_progress") && (
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => {
              if (
                !confirm(
                  `Fund "${milestone.title}" for ${fmtNaira(milestone.amount)}?\n\nThis moves the full amount into escrow now, and the professional can start work on it. Approving the finished work later releases ${fmtNaira(milestone.net_to_professional)} to them (after the ${milestone.platform_fee_percent}% platform fee).`
                )
              )
                return;
              act(() => api.fundMilestone(milestone.id), "Milestone funded — the professional can start work");
            }}
          >
            <Wallet className="h-3.5 w-3.5 mr-1" /> Fund Milestone
          </Button>
        )}
        {isClient && !disputed && (milestone.status === "pending" || milestone.status === "in_progress" || milestone.status === "funded") && (
          <Button
            size="sm"
            variant="outline"
            className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
            disabled={busy}
            onClick={() => {
              const funded = milestone.status === "funded";
              const note = prompt(
                funded
                  ? `Why are you rejecting "${milestone.title}"? ${fmtNaira(milestone.amount)} will be refunded to your wallet, and the professional will see this note.`
                  : `Why are you rejecting "${milestone.title}"? The professional will see this note.`
              );
              if (note === null) return;
              if (!note.trim()) return toast.error("A note is required to reject a milestone");
              act(() => api.rejectMilestone(milestone.id, note.trim()), funded ? "Milestone rejected — funds refunded to your wallet" : "Milestone rejected");
            }}
          >
            <XCircle className="h-3.5 w-3.5 mr-1" /> Reject
          </Button>
        )}
        {isClient &&
          walletBalance != null &&
          (milestone.status === "pending" || milestone.status === "in_progress") &&
          walletBalance < milestone.amount && (
            <p className="w-full text-xs text-amber-700 bg-amber-50 rounded-md px-2.5 py-1.5 flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              <span>Wallet balance {fmtNaira(walletBalance)}, need {fmtNaira(milestone.amount)}.</span>
              <Link href="/client/dashboard/payments" className="ml-auto underline font-medium shrink-0">Top up</Link>
            </p>
          )}
        {isClient && !disputed && milestone.status === "funded" && (
          <Button
            size="sm"
            className="bg-emerald-600 hover:bg-emerald-700"
            disabled={busy}
            onClick={() => {
              if (!confirm(`Approve "${milestone.title}"?\n\n${fmtNaira(milestone.net_to_professional)} is released to the professional instantly (after the ${milestone.platform_fee_percent}% platform fee). This can't be undone.`)) return;
              act(() => api.approveMilestone(milestone.id), "Approved — payment released");
            }}
          >
            <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Approve &amp; Release Payment
          </Button>
        )}
      </div>
    </div>
  );
}

// ─── Change orders section ───────────────────────────────────────────────────
function ProposeChangeOrderForm({ projectId, onAdded }: { projectId: string; onAdded: () => void }) {
  const [open, setOpen] = useState(false);
  const [description, setDescription] = useState("");
  const [amountDelta, setAmountDelta] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!description || !amountDelta) return toast.error("Description and amount are required");
    setSubmitting(true);
    try {
      await api.createChangeOrder(projectId, { description, amount_delta: Number(amountDelta) });
      toast.success("Change order proposed");
      setDescription("");
      setAmountDelta("");
      setOpen(false);
      onAdded();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not propose change order");
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) {
    return (
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <FileEdit className="h-3.5 w-3.5 mr-1" /> Propose Change Order
      </Button>
    );
  }

  return (
    <div className="rounded-lg border p-3 space-y-2 bg-muted/20">
      <textarea
        rows={2}
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="What's changing in the scope?"
        className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none"
      />
      <Input type="number" placeholder="Amount change (₦, use negative for a reduction)" value={amountDelta} onChange={(e) => setAmountDelta(e.target.value)} />
      <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
        <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={submit} disabled={submitting}>{submitting ? "Sending..." : "Send"}</Button>
      </div>
    </div>
  );
}

function ChangeOrdersSection({
  projectId,
  currentUserId,
  isClient,
  isProfessional,
  active,
  onMilestoneCreated,
}: {
  projectId: string;
  currentUserId?: string;
  isClient: boolean;
  isProfessional: boolean;
  /** Whether the project is still in a state where change orders can be
   * proposed/acted on (i.e. not completed or cancelled). Once closed, this
   * section becomes a read-only record of what happened. */
  active: boolean;
  /** Called after an approval that created a milestone, so the parent can
   * refresh its milestone list without the user having to reload the page. */
  onMilestoneCreated?: () => void;
}) {
  const [orders, setOrders] = useState<ChangeOrderOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    api.changeOrders(projectId).then(setOrders).catch(() => toast.error("Could not load change orders")).finally(() => setLoading(false));
  };

  useEffect(load, [projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  const respond = async (id: string, status: "approved" | "rejected") => {
    setBusyId(id);
    try {
      const updated = await api.updateChangeOrder(id, status);
      toast.success(`Change order ${status}`);
      load();
      if (updated.resulting_milestone_id) onMilestoneCreated?.();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not update change order");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="rounded-xl border bg-background p-4 md:p-5 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-semibold flex items-center gap-2"><FileEdit className="h-4 w-4 text-muted-foreground" /> Change Orders</h2>
        {(isClient || isProfessional) && active && <ProposeChangeOrderForm projectId={projectId} onAdded={load} />}
      </div>
      {!active && (
        <p className="text-xs text-muted-foreground">This project is closed — change orders are read-only now.</p>
      )}
      {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {!loading && orders.length === 0 && (
        <div className="rounded-lg border border-dashed py-8 text-center">
          <FileEdit className="h-6 w-6 text-muted-foreground/50 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No change orders on this project.</p>
        </div>
      )}
      {orders.map((co) => {
        const proposedByMe = co.proposed_by === currentUserId;
        // Whoever didn't propose it approves it — mirrors the backend rule.
        const canRespond = !proposedByMe && (isClient || isProfessional);
        return (
        <div key={co.id} className="rounded-lg border bg-background p-3 flex items-start justify-between gap-3">
          <div>
            <p className="text-sm">{co.description}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {new Date(co.created_at).toLocaleDateString()} · {proposedByMe ? "Proposed by you" : "Proposed by the other party"}
            </p>
          </div>
          <div className="text-right shrink-0">
            <p className={`text-sm font-semibold ${co.amount_delta >= 0 ? "text-emerald-600" : "text-red-600"}`}>
              {co.amount_delta >= 0 ? "+" : ""}{fmtNaira(co.amount_delta)}
            </p>
            <Badge className="text-xs rounded-full mt-1 capitalize">{co.status}</Badge>
            {co.status === "approved" && (
              <p className="text-xs text-muted-foreground mt-1">
                {co.resulting_milestone_id ? "Milestone created — fund it below to get started." : "No cost, no milestone needed."}
              </p>
            )}
            {co.status === "proposed" && proposedByMe && (
              <p className="text-xs text-muted-foreground mt-1">Waiting on the other party to respond.</p>
            )}
            {canRespond && active && co.status === "proposed" && (
              <div className="flex gap-1.5 mt-2">
                <Button size="sm" variant="outline" disabled={busyId === co.id} onClick={() => respond(co.id, "rejected")}>Reject</Button>
                <Button size="sm" disabled={busyId === co.id} onClick={() => respond(co.id, "approved")}>Approve</Button>
              </div>
            )}
          </div>
        </div>
        );
      })}
    </div>
  );
}

// ─── Invite a professional directly ──────────────────────────────────────────
function InviteDialog({ projectId, onClose, onInvited }: { projectId: string; onClose: () => void; onInvited: () => void }) {
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<ProfessionalOut[]>([]);
  const [selected, setSelected] = useState<ProfessionalOut | null>(null);
  const [amount, setAmount] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api.professionals(search ? { q: search } : undefined).then(setResults).catch(() => {});
  }, [search]);

  const submit = async () => {
    if (!selected) return toast.error("Pick a professional to invite");
    setSubmitting(true);
    try {
      await api.createInvite(projectId, {
        professional_id: selected.user_id,
        proposed_amount: amount ? Number(amount) : undefined,
        message: message || undefined,
      });
      toast.success("Invite sent");
      onInvited();
      onClose();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not send invite");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4">
      <div className="w-full sm:max-w-md max-h-[90vh] overflow-y-auto bg-background rounded-t-2xl sm:rounded-2xl border shadow-lg p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">Invite a Professional</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
        </div>

        {!selected ? (
          <>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search professionals..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {results.map((p) => (
                <button key={p.id} onClick={() => setSelected(p)} className="flex w-full items-center gap-3 rounded-lg border p-3 text-left hover:bg-muted/30">
                  <div className="h-9 w-9 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-sm shrink-0">
                    {p.first_name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{p.first_name} {p.last_name}</p>
                    <p className="text-xs text-muted-foreground">{p.title}</p>
                  </div>
                  {p.verification_status === "verified" && <BadgeCheck className="h-4 w-4 text-emerald-600 shrink-0" />}
                </button>
              ))}
              {results.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No professionals found.</p>}
            </div>
          </>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-3 rounded-lg border p-3">
              <div className="h-9 w-9 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-sm shrink-0">
                {selected.first_name.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{selected.first_name} {selected.last_name}</p>
                <p className="text-xs text-muted-foreground">{selected.title}</p>
              </div>
              <button onClick={() => setSelected(null)} className="text-xs text-muted-foreground hover:text-foreground">Change</button>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Proposed Amount (₦)</label>
              <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="e.g. 850000" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Message</label>
              <textarea
                rows={3}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Tell them why you'd like to work with them..."
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none"
              />
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
              <Button className="flex-1" onClick={submit} disabled={submitting}>{submitting ? "Sending..." : "Send Invite"}</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Bid comparison card ──────────────────────────────────────────────────────
function BidCard({
  bid,
  onShortlist,
  onAccept,
  onOffer,
  onMessage,
  unread = 0,
}: {
  bid: BidOut;
  onShortlist: () => void;
  onAccept: () => void;
  onOffer: () => void;
  onMessage: () => void;
  /** Unread messages in this bidder's thread on the project. */
  unread?: number;
}) {
  return (
    <div className="rounded-xl border bg-background p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            {bid.professional_profile_id ? (
              <Link
                href={`/client/dashboard/find-talent/${bid.professional_profile_id}`}
                className="font-medium text-sm hover:text-primary hover:underline"
              >
                {bid.professional_name}
              </Link>
            ) : (
              <p className="font-medium text-sm">{bid.professional_name}</p>
            )}
            {bid.professional_verification_status === "verified" && <BadgeCheck className="h-3.5 w-3.5 text-emerald-600" />}
          </div>
          <div className="flex items-center gap-1 mt-0.5">
            <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
            <span className="text-xs text-muted-foreground">
              {bid.professional_rating || "New"} ({bid.professional_review_count || 0}) · {bid.professional_portfolio_count || 0} portfolio item{(bid.professional_portfolio_count || 0) === 1 ? "" : "s"}
            </span>
          </div>
          {bid.cover_letter && <p className="text-xs text-muted-foreground mt-2 line-clamp-3">{bid.cover_letter}</p>}
          {bid.estimated_days && <p className="text-xs text-muted-foreground mt-1">Est. {bid.estimated_days} days</p>}
        </div>
        <div className="text-right shrink-0">
          <p className="font-semibold text-sm">{fmtNaira(bid.amount)}</p>
          <Badge className={`text-xs rounded-full mt-1 capitalize ${BID_STATUS_COLORS[bid.status]}`}>{bid.status}</Badge>
        </div>
      </div>

      {bid.status === "offered" && (
        <p className="text-xs bg-purple-50 text-purple-700 rounded-md p-2">
          You offered {fmtNaira(bid.offered_amount || 0)} — waiting on their confirmation.
        </p>
      )}

      <div className="flex flex-wrap gap-2 pt-1 border-t">
        <Button size="sm" variant="outline" className="mt-2" onClick={onMessage}>
          <MessageSquare className="h-3.5 w-3.5 mr-1" /> Message
          {unread > 0 && (
            <span className="ml-1 h-4 min-w-4 px-1 rounded-full bg-primary text-primary-foreground text-[10px] flex items-center justify-center">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
        {(bid.status === "pending" || bid.status === "shortlisted") && (
          <>
            {bid.status === "pending" && (
              <Button size="sm" variant="outline" className="mt-2" onClick={onShortlist}>Shortlist</Button>
            )}
            <Button size="sm" variant="outline" className="mt-2" onClick={onOffer}>Offer Different Amount</Button>
            <Button size="sm" className="mt-2" onClick={onAccept}>Accept</Button>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Leave a review on completion ────────────────────────────────────────────
function ReviewForm({ projectId, revieweeId, revieweeName }: { projectId: string; revieweeId: string; revieweeName: string }) {
  const { user } = useAuth();
  const [alreadyReviewed, setAlreadyReviewed] = useState(false);
  const [checked, setChecked] = useState(false);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    api.reviewsForUser(revieweeId)
      .then((reviews) => setAlreadyReviewed(reviews.some((r) => r.reviewer_id === user?.id && r.project_id === projectId)))
      .catch(() => {})
      .finally(() => setChecked(true));
  }, [revieweeId, projectId, user?.id]);

  const submit = async () => {
    setSubmitting(true);
    try {
      await api.createReview({ project_id: projectId, reviewee_id: revieweeId, rating, comment: comment || undefined });
      toast.success("Review submitted, thank you!");
      setSubmitted(true);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not submit review");
    } finally {
      setSubmitting(false);
    }
  };

  if (!checked) return null;
  if (alreadyReviewed || submitted) {
    return (
      <div className="rounded-xl border bg-background p-4">
        <p className="text-sm text-muted-foreground">You've already reviewed {revieweeName} for this project. Thanks!</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-background p-4 space-y-3">
      <h2 className="font-semibold">Leave a Review for {revieweeName}</h2>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} onClick={() => setRating(n)}>
            <Star className={`h-6 w-6 ${n <= rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground"}`} />
          </button>
        ))}
      </div>
      <textarea
        rows={3}
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="How was the experience working with them?"
        className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none"
      />
      <Button onClick={submit} disabled={submitting}>{submitting ? "Submitting..." : "Submit Review"}</Button>
    </div>
  );
}

// ─── Raise a dispute ──────────────────────────────────────────────────────
const DISPUTE_CATEGORIES: DisputeCategory[] = ["quality", "non_delivery", "payment", "scope_disagreement", "unresponsive", "other"];

function RaiseDisputeDialog({
  projectId,
  milestones,
  rolePath,
  onClose,
  onCreated,
}: {
  projectId: string;
  milestones: MilestoneOut[];
  rolePath: "client" | "talent";
  onClose: () => void;
  onCreated: (d: DisputeOut) => void;
}) {
  const eligibleMilestones = milestones.filter((m) => m.status !== "paid" && m.status !== "refunded");
  const [milestoneId, setMilestoneId] = useState<string>("");
  const [category, setCategory] = useState<DisputeCategory>("quality");
  const [reason, setReason] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!reason.trim()) return toast.error("Please describe the issue");
    setSubmitting(true);
    try {
      const uploaded = files.length > 0 ? await Promise.all(files.map((f) => api.uploadFile(f))) : [];
      const dispute = await api.createDispute({
        project_id: projectId,
        milestone_id: milestoneId || undefined,
        category,
        reason: reason.trim(),
        evidence_urls: uploaded.map((u) => u.url),
      });
      toast.success("Dispute filed, our team will review it");
      onCreated(dispute);
      onClose();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not raise dispute");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4">
      <div className="w-full sm:max-w-md max-h-[90vh] overflow-y-auto bg-background rounded-t-2xl sm:rounded-2xl border shadow-lg p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold flex items-center gap-1.5"><AlertTriangle className="h-4.5 w-4.5 text-red-600" /> Raise a Dispute</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
        </div>
        <p className="text-xs text-muted-foreground bg-muted/50 rounded-md p-2.5">
          Filing a dispute pauses fund release on the affected milestone (or the whole project, if not tied to one) until our team resolves it. The other party will be notified and can respond.
        </p>

        {eligibleMilestones.length > 0 && (
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Related milestone (optional)</label>
            <select
              value={milestoneId}
              onChange={(e) => setMilestoneId(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">Not tied to a specific milestone</option>
              {eligibleMilestones.map((m) => (
                <option key={m.id} value={m.id}>{m.title} ({fmtNaira(m.amount)})</option>
              ))}
            </select>
          </div>
        )}

        <div className="space-y-1.5">
          <label className="text-sm font-medium">Category</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as DisputeCategory)}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            {DISPUTE_CATEGORIES.map((c) => (
              <option key={c} value={c}>{DISPUTE_CATEGORY_LABELS[c]}</option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium">What happened?</label>
          <textarea
            rows={4}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Describe the issue in detail..."
            className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium">Evidence (screenshots, photos)</label>
          <input type="file" accept="image/*,application/pdf" multiple onChange={(e) => setFiles(Array.from(e.target.files || []))} className="text-xs" />
        </div>

        <div className="flex gap-3 pt-1">
          <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button variant="destructive" className="flex-1" onClick={submit} disabled={submitting}>
            {submitting ? "Filing..." : "File Dispute"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Edit project (client, open projects only) ───────────────────────────────
function EditProjectDialog({
  project,
  onClose,
  onSaved,
}: {
  project: ProjectOut;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState(project.title);
  const [description, setDescription] = useState(project.description);
  const [location, setLocation] = useState(project.location || "");
  const [categoryId, setCategoryId] = useState(project.category.id);
  const [budgetMin, setBudgetMin] = useState(String(project.budget_min));
  const [budgetMax, setBudgetMax] = useState(String(project.budget_max));
  const [budgetType, setBudgetType] = useState<"fixed" | "hourly">(project.budget_type);
  const [skills, setSkills] = useState(project.skills.join(", "));
  const [timeline, setTimeline] = useState(project.timeline || "");
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    const min = Number(budgetMin);
    const max = Number(budgetMax);
    if (!title.trim() || !description.trim() || !categoryId) {
      return toast.error("Title, description and category are required");
    }
    if (!min || !max || min <= 0 || max <= 0 || min > max) {
      return toast.error("Enter a valid budget range (min must be greater than zero and no larger than max)");
    }
    setSubmitting(true);
    try {
      await api.updateProject(project.id, {
        title: title.trim(),
        description: description.trim(),
        location: location.trim() || undefined,
        category_id: categoryId,
        budget_min: min,
        budget_max: max,
        budget_type: budgetType,
        skills: skills.split(",").map((s) => s.trim()).filter(Boolean),
        timeline: timeline.trim() || undefined,
      });
      toast.success("Project updated");
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not update project");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4">
      <div className="w-full sm:max-w-lg max-h-[90vh] overflow-y-auto bg-background rounded-t-2xl sm:rounded-2xl border shadow-lg p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold flex items-center gap-1.5"><FileEdit className="h-4.5 w-4.5" /> Edit Project</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Project Title *</label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Description *</label>
          <textarea
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Category *</label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Location</label>
            <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Lekki, Lagos" />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Budget Min (₦) *</label>
            <Input type="number" value={budgetMin} onChange={(e) => setBudgetMin(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Budget Max (₦) *</label>
            <Input type="number" value={budgetMax} onChange={(e) => setBudgetMax(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Budget Type</label>
            <select
              value={budgetType}
              onChange={(e) => setBudgetType(e.target.value as "fixed" | "hourly")}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="fixed">Fixed</option>
              <option value="hourly">Hourly</option>
            </select>
          </div>
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Skills</label>
          <Input value={skills} onChange={(e) => setSkills(e.target.value)} placeholder="Comma separated, e.g. structural analysis, autocad" />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Timeline</label>
          <Input value={timeline} onChange={(e) => setTimeline(e.target.value)} placeholder="e.g. 2-3 weeks, or by end of March" />
        </div>
        <div className="flex gap-3 pt-1">
          <Button variant="outline" className="flex-1" onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button className="flex-1" onClick={submit} disabled={submitting}>{submitting ? "Saving..." : "Save Changes"}</Button>
        </div>
      </div>
    </div>
  );
}

// ─── Final-review sign-off (project status: review) ─────────────────────────
function FinalReviewSection({
  project,
  isClient,
  isProfessional,
  onChanged,
}: {
  project: ProjectOut;
  isClient: boolean;
  isProfessional: boolean;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState(project.closing_note || "");
  const [saved, setSaved] = useState(true);

  const act = async (fn: () => Promise<unknown>, successMsg: string) => {
    setBusy(true);
    try {
      await fn();
      toast.success(successMsg);
      onChanged();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Action failed");
    } finally {
      setBusy(false);
    }
  };

  const confirmComplete = () => {
    if (!window.confirm("Confirm this project as complete? This unlocks reviews for both parties and can't be undone.")) return;
    act(() => api.confirmProject(project.id), "Project confirmed complete");
  };

  const reopenProject = () => {
    if (!window.confirm("Reopen this project for more work? You'll be able to add and fund more milestones.")) return;
    act(() => api.reopenProject(project.id), "Project reopened");
  };

  const saveNote = async () => {
    setBusy(true);
    try {
      await api.closingNote(project.id, note.trim());
      setSaved(true);
      toast.success("Closing note saved");
      onChanged();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not save note");
    } finally {
      setBusy(false);
    }
  };

  if (isClient) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4 md:p-5 space-y-3">
        <h2 className="font-semibold flex items-center gap-2 text-amber-900">
          <CheckCircle2 className="h-4 w-4" /> Final review
        </h2>
        <p className="text-sm text-amber-900/80">
          All milestones are closed out. Do a final check, then confirm completion to unlock reviews.
        </p>
        {project.closing_note ? (
          <div className="rounded-lg bg-background border p-3 text-sm">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Closing note from the professional</p>
            <p className="whitespace-pre-wrap">{project.closing_note}</p>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">No closing note from the professional yet.</p>
        )}
        <div className="flex flex-wrap gap-2 pt-1">
          <Button size="sm" className="bg-primary" disabled={busy} onClick={confirmComplete}>
            <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Confirm Completion
          </Button>
          <Button size="sm" variant="outline" disabled={busy} onClick={reopenProject}>
            <ArrowLeft className="h-3.5 w-3.5 mr-1" /> Reopen Project
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4 md:p-5 space-y-3">
      <h2 className="font-semibold flex items-center gap-2 text-amber-900">
        <Clock className="h-4 w-4" /> Under final review
      </h2>
      <p className="text-sm text-amber-900/80">
        The client has moved this project to final review. Leave a closing note (or flag any remaining issues) before they sign off.
      </p>
      <textarea
        rows={3}
        value={note}
        onChange={(e) => {
          setNote(e.target.value);
          setSaved(false);
        }}
        placeholder="Summary of what was delivered, or any remaining issues the client should know about..."
        className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none"
      />
      <div className="flex gap-2">
        <Button size="sm" variant="outline" disabled={busy || saved} onClick={saveNote}>
          {busy ? "Saving..." : saved ? "Note saved" : "Save closing note"}
        </Button>
        <Button size="sm" variant="ghost" disabled={busy || !project.closing_note} onClick={() => { setNote(""); setSaved(false); }}>
          Clear
        </Button>
      </div>
    </div>
  );
}

function ApproveInspectionDialog({
  request, onClose, onApprove, submitting,
}: { request: AccessRequestOut; onClose: () => void; onApprove: (address: string, phone?: string, details?: string) => void; submitting: boolean }) {
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [details, setDetails] = useState("");
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4">
      <div className="w-full sm:max-w-md bg-background rounded-t-2xl sm:rounded-2xl border shadow-lg p-6 space-y-4">
        <div>
          <h2 className="text-lg font-bold">Approve Inspection Visit</h2>
          <p className="text-xs text-muted-foreground mt-1">
            Share where {request.professional_name} can find the site. This opens a chat with them, and the address will show as a map preview there.
          </p>
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Site Address *</label>
          <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="e.g. 12 Admiralty Way, Lekki Phase 1, Lagos" />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Phone (optional)</label>
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="A number they can reach you on for the visit" />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Other details (optional)</label>
          <textarea
            rows={2}
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            placeholder="Best time to visit, gate code, landmark, etc."
            className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none"
          />
        </div>
        <div className="flex gap-3">
          <Button variant="outline" className="flex-1" onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button
            className="flex-1 bg-emerald-600 hover:bg-emerald-700"
            disabled={submitting || !address.trim()}
            onClick={() => onApprove(address.trim(), phone.trim() || undefined, details.trim() || undefined)}
          >
            {submitting ? "Approving..." : "Approve & Open Chat"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Full project workspace (milestones + bids) ──────────────────────────────
export function ProjectWorkspace({
  project: initialProject,
  onClose,
  backHref = "/",
}: {
  project: ProjectOut;
  onClose?: () => void;
  backHref?: string;
}) {
  const { user } = useAuth();
  // Mirror the fetched project into local state so status-affecting actions
  // (accept bid, move to review, confirm, reopen, closing note) can
  // refresh it in place instead of leaving the UI stuck on a stale status.
  const [project, setProject] = useState(initialProject);
  useEffect(() => { setProject(initialProject); }, [initialProject]);
  const [milestones, setMilestones] = useState<MilestoneOut[]>([]);
  const [bids, setBids] = useState<BidOut[]>([]);
  const [invites, setInvites] = useState<InviteOut[]>([]);
  const [accessRequests, setAccessRequests] = useState<AccessRequestOut[]>([]);
  const [respondingRequestId, setRespondingRequestId] = useState<string | null>(null);
  const [inspectionApproveFor, setInspectionApproveFor] = useState<AccessRequestOut | null>(null);
  const [disputes, setDisputes] = useState<DisputeOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [disputeDialogOpen, setDisputeDialogOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [bidsTab, setBidsTab] = useState<"all" | "shortlisted">("all");
  const [editOpen, setEditOpen] = useState(false);
  const [activeThread, setActiveThread] = useState<{ id: string; name: string } | null>(null);
  // Live unread counts for this project's threads (from the shared hook that
  // polls /messages/threads, same source as the Messages app).
  const { threads, loadUnread } = useProjectUnread();
  const projectThreads = threads.filter((t) => t.project_id === project.id);
  // other_user_id -> unread, for per-bidder badges on open projects.
  const threadUnread: Record<string, number> = {};
  for (const t of projectThreads) {
    if (t.unread_count > 0) {
      threadUnread[t.other_user_id] = (threadUnread[t.other_user_id] || 0) + t.unread_count;
    }
  }
  const projectUnread = Object.values(threadUnread).reduce((a, b) => a + b, 0);

  // If the active thread's counterpart has an approved inspection request
  // with an address on file, surface it as a map preview inside the chat.
  const activeInspection = activeThread
    ? accessRequests.find((r) => r.professional_id === activeThread.id && r.request_type === "inspection" && r.status === "approved" && r.address)
    : undefined;

  const isClient = user?.id === project.client_id;
  const isProfessional = user?.id === project.assigned_professional_id;
  const rolePath: "client" | "talent" = isProfessional ? "talent" : "client";

  const ACTIVE_DISPUTE_STATUSES = new Set(["open", "under_review", "escalated"]);
  const projectDisputes = disputes.filter((d) => d.project_id === project.id);
  const activeDisputes = projectDisputes.filter((d) => ACTIVE_DISPUTE_STATUSES.has(d.status));
  const disputedMilestoneIds = new Set(activeDisputes.filter((d) => d.milestone_id).map((d) => d.milestone_id));
  const hasProjectWideDispute = activeDisputes.some((d) => !d.milestone_id);

  const load = () => {
    setLoading(true);
    const calls: Promise<unknown>[] = [
      api.milestones(project.id).then(setMilestones),
      api.myDisputes().then(setDisputes).catch(() => {}),
    ];
    if (isClient && project.status === "open") {
      calls.push(api.projectBids(project.id).then(setBids));
      calls.push(api.projectInvites(project.id).then(setInvites).catch(() => {}));
    }
    if (isClient) {
      calls.push(api.projectAccessRequests(project.id).then(setAccessRequests).catch(() => {}));
    }
    Promise.all(calls).catch(() => toast.error("Could not load project data")).finally(() => setLoading(false));
  };

  const respondToRequest = async (id: string, status: "approved" | "rejected", extra?: { address?: string; phone?: string; details?: string }) => {
    setRespondingRequestId(id);
    try {
      await api.respondToAccessRequest(id, { status, ...extra });
      toast.success(status === "approved" ? "Request approved" : "Request declined");
      setInspectionApproveFor(null);
      api.projectAccessRequests(project.id).then(setAccessRequests).catch(() => {});
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not respond to request");
    } finally {
      setRespondingRequestId(null);
    }
  };

  const refreshProject = () => {
    api.project(project.id).then(setProject).catch(() => {});
  };

  useEffect(() => { load(); }, [project.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const closeProject = async () => {
    if (!confirm("Close this project? It will stop accepting bids and be marked as closed.")) return;
    try {
      await api.closeProject(project.id);
      toast.success("Project closed");
      load();
      refreshProject();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not close project");
    }
  };

  const completeProject = async () => {
    if (!confirm("Move this project to final review? The professional will be able to leave a closing note before you confirm completion. Make sure all escrow funds have been released or refunded first.")) return;
    try {
      await api.completeProject(project.id);
      toast.success("Project moved to final review");
      load();
      refreshProject();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not move project to review");
    }
  };

  const shortlistBid = async (bidId: string) => {
    try {
      await api.updateBid(bidId, "shortlisted");
      toast.success("Shortlisted");
      load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not shortlist bid");
    }
  };

  const acceptBid = async (bidId: string, professionalName?: string) => {
    if (!confirm(`Accept this bid${professionalName ? ` from ${professionalName}` : ""}? This assigns them to the project and closes it to other bids.`)) return;
    try {
      await api.updateBid(bidId, "accepted");
      toast.success("Bid accepted. Define the milestone plan to start");
      load();
      refreshProject();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not accept bid");
    }
  };

  const offerBid = async (bidId: string, currentAmount: number, professionalName?: string) => {
    const input = prompt(`Send ${professionalName || "the professional"} an offer at a different final amount (₦). They'll need to confirm it before the project locks in.`, String(currentAmount));
    if (input === null) return;
    const amount = Number(input);
    if (!amount || amount <= 0) return toast.error("Enter a valid amount");
    try {
      await api.updateBid(bidId, "accepted", { offered_amount: amount });
      toast.success("Offer sent — waiting on their confirmation");
      load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not send offer");
    }
  };

  const sortedBids = [...bids].sort((a, b) => b.amount === a.amount ? 0 : a.amount - b.amount);
  const shortlistedBids = sortedBids.filter((b) => b.status === "shortlisted");
  const visibleBids = bidsTab === "shortlisted" ? shortlistedBids : sortedBids;

  const paidTotal = milestones.filter((m) => m.status === "paid").reduce((s, m) => s + m.amount, 0);
  const inEscrowTotal = milestones.filter((m) => ["funded", "submitted", "approved"].includes(m.status)).reduce((s, m) => s + m.amount, 0);
  const upcomingTotal = milestones.filter((m) => ["pending", "in_progress"].includes(m.status)).reduce((s, m) => s + m.amount, 0);
  const projectTotal = paidTotal + inEscrowTotal + upcomingTotal;
  // Terminal states (paid or refunded via dispute) count as closed, so a
  // completed project can actually reach 100%.
  const closedCount = milestones.filter((m) => m.status === "paid" || m.status === "refunded").length;
  const progressPct = milestones.length > 0 ? Math.round((closedCount / milestones.length) * 100) : 0;

  const openChatWith = () =>
    setActiveThread(
      isClient
        ? { id: project.assigned_professional_id || "", name: "Professional" }
        : { id: project.client_id, name: "Client" }
    );

  return (
    <div className="-mx-4 -mt-4 md:-mx-6 md:-mt-6 min-h-full bg-muted/30">
      {/* Sticky header — sticks within the dashboard's own scroll container,
          not a full-viewport overlay, so the mobile bottom nav stays usable. */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b">
        <div className="max-w-6xl mx-auto px-4 md:px-6 h-16 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {onClose ? (
              <button onClick={onClose} className="shrink-0 h-9 w-9 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                <ArrowLeft className="h-4.5 w-4.5" />
              </button>
            ) : (
              <Link href={backHref} className="shrink-0 h-9 w-9 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                <ArrowLeft className="h-4.5 w-4.5" />
              </Link>
            )}
            <div className="min-w-0">
              <p className="font-semibold text-sm truncate">{project.title}</p>
              <p className="text-xs text-muted-foreground">{project.category.label}</p>
            </div>
          </div>
          <Badge className={`text-xs rounded-full shrink-0 capitalize ${PROJECT_STATUS_COLORS[project.status] || ""}`}>{project.status.replace("_", " ")}</Badge>
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-4 md:p-6 grid lg:grid-cols-3 gap-6 pb-4">
        {/* Main column */}
        <div className="lg:col-span-2 space-y-6 min-w-0">
          {/* Overview card */}
          <div className="rounded-xl border bg-background p-4 md:p-5">
            <p className="text-sm text-muted-foreground leading-relaxed">{project.description}</p>
            {(project.image_urls?.length > 0 || project.video_url) && (
              <div className="mt-3">
                {project.image_urls?.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-2">
                    {project.image_urls.map((url) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <a key={url} href={url} target="_blank" rel="noopener noreferrer" className="block h-20 w-20 rounded-lg overflow-hidden border">
                        <img src={url} alt="Project" className="h-full w-full object-cover" />
                      </a>
                    ))}
                  </div>
                )}
                {project.video_url && (
                  /\.(mp4|mov|webm)$/i.test(project.video_url) ? (
                    <video src={project.video_url} controls className="w-full max-w-md rounded-lg border" />
                  ) : (
                    <a href={project.video_url} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline">
                      View project video ↗
                    </a>
                  )
                )}
              </div>
            )}
            {project.skills.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3">
                {project.skills.map((s) => <Badge key={s} variant="secondary" className="text-xs rounded-full">{s}</Badge>)}
              </div>
            )}
            {project.timeline && (
              <div className="flex items-center gap-1.5 mt-3 text-sm text-muted-foreground">
                <Clock className="h-3.5 w-3.5" /> Timeline: <span className="text-foreground font-medium">{project.timeline}</span>
              </div>
            )}
            <div className="flex items-center gap-2 mt-4 pt-4 border-t">
              <Wallet className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold text-primary">
                {formatBudgetRange(project.budget_min, project.budget_max, project.budget_type === "hourly")}
              </span>
              <span className="text-xs text-muted-foreground">
                {project.contract_amount != null
                  ? "originally posted budget"
                  : project.budget_min === project.budget_max ? "estimated budget" : "project budget range"}
              </span>
            </div>
            {/* Once someone is hired, the accepted bid — not the posted range
                above — is the number milestones should sum toward. Surfacing
                it explicitly avoids ambiguity about which figure governs. */}
            {project.contract_amount != null && (
              <div className="flex items-center gap-2 mt-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                <span className="text-sm font-semibold text-emerald-700">{fmtNaira(project.contract_amount)}</span>
                <span className="text-xs text-muted-foreground">agreed contract amount — milestones should total toward this</span>
              </div>
            )}
            {/* The system's own answer to "is there money still expected
                later that hasn't become a milestone yet" — a positive number
                here isn't missing money, it's the part of the contract not
                yet broken into a fundable milestone. */}
            {project.remaining_unallocated != null && Math.abs(project.remaining_unallocated) > 0.01 && (
              <div className={`flex items-center gap-2 mt-2 rounded-md px-2.5 py-1.5 ${project.remaining_unallocated > 0 ? "bg-amber-50" : "bg-red-50"}`}>
                <AlertTriangle className={`h-4 w-4 shrink-0 ${project.remaining_unallocated > 0 ? "text-amber-600" : "text-red-600"}`} />
                <span className={`text-xs ${project.remaining_unallocated > 0 ? "text-amber-700" : "text-red-700"}`}>
                  {project.remaining_unallocated > 0
                    ? `${fmtNaira(project.remaining_unallocated)} of the contract hasn't been milestoned yet — expect more milestones later for the remaining work.`
                    : `Milestones total ${fmtNaira(Math.abs(project.remaining_unallocated))} more than the agreed contract amount.`}
                </span>
              </div>
            )}
          </div>

          {/* Site inspection / start-chat requests from interested professionals,
              awaiting the client's approval or rejection. */}
          {isClient && accessRequests.length > 0 && (
            <div className="rounded-xl border bg-background p-4 md:p-5 space-y-3">
              <h2 className="font-semibold flex items-center gap-2"><MapPin className="h-4 w-4 text-muted-foreground" /> Requests ({accessRequests.length})</h2>
              <div className="space-y-2">
                {accessRequests.map((req) => (
                  <div key={req.id} className="rounded-lg border bg-muted/20 p-3 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">
                        {req.professional_name} — {req.request_type === "inspection" ? "Site inspection" : "Start chat"}
                      </p>
                      {req.note && <p className="text-xs text-muted-foreground mt-0.5">{req.note}</p>}
                      {req.status === "approved" && req.request_type === "inspection" && req.address && (
                        <p className="text-xs text-emerald-700 mt-1">Shared: {req.address}{req.phone ? ` · ${req.phone}` : ""}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {req.status === "pending" ? (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={respondingRequestId === req.id}
                            onClick={() => respondToRequest(req.id, "rejected")}
                          >
                            Reject
                          </Button>
                          <Button
                            size="sm"
                            className="bg-emerald-600 hover:bg-emerald-700"
                            disabled={respondingRequestId === req.id}
                            onClick={() =>
                              req.request_type === "inspection"
                                ? setInspectionApproveFor(req)
                                : respondToRequest(req.id, "approved")
                            }
                          >
                            Approve
                          </Button>
                        </>
                      ) : req.status === "approved" ? (
                        <Button size="sm" variant="outline" onClick={() => setActiveThread({ id: req.professional_id, name: req.professional_name || "Professional" })}>
                          <MessageSquare className="h-3.5 w-3.5 mr-1" /> Message
                        </Button>
                      ) : (
                        <Badge className="text-xs rounded-full bg-red-100 text-red-600">Declined</Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {inspectionApproveFor && (
            <ApproveInspectionDialog
              request={inspectionApproveFor}
              submitting={respondingRequestId === inspectionApproveFor.id}
              onClose={() => setInspectionApproveFor(null)}
              onApprove={(address, phone, details) => respondToRequest(inspectionApproveFor.id, "approved", { address, phone, details })}
            />
          )}

          {/* Final review: professional closing note + client sign-off */}
          {project.status === "review" && (isClient || isProfessional) && (
            <FinalReviewSection
              project={project}
              isClient={isClient}
              isProfessional={isProfessional}
              onChanged={() => { load(); refreshProject(); }}
            />
          )}

          {/* Open project: compare bids, invite directly */}
          {isClient && project.status === "open" && (
            <div className="rounded-xl border bg-background p-4 md:p-5 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-semibold flex items-center gap-2"><Inbox className="h-4 w-4 text-muted-foreground" /> Bids ({bids.length})</h2>
                <Button size="sm" variant="outline" onClick={() => setInviteOpen(true)}>
                  <UserPlus className="h-3.5 w-3.5 mr-1" /> Invite a Professional
                </Button>
              </div>
              {bids.length > 0 && (
                <div className="flex items-center gap-1 border-b">
                  <button
                    onClick={() => setBidsTab("all")}
                    className={`px-3 py-1.5 text-xs font-medium border-b-2 -mb-px transition-colors ${bidsTab === "all" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
                  >
                    All ({sortedBids.length})
                  </button>
                  <button
                    onClick={() => setBidsTab("shortlisted")}
                    className={`px-3 py-1.5 text-xs font-medium border-b-2 -mb-px transition-colors ${bidsTab === "shortlisted" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
                  >
                    Shortlisted ({shortlistedBids.length})
                  </button>
                </div>
              )}
              {bids.length === 0 && (
                <div className="rounded-lg border border-dashed py-8 text-center">
                  <Inbox className="h-6 w-6 text-muted-foreground/50 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No bids yet, or invite someone directly.</p>
                </div>
              )}
              {bids.length > 0 && bidsTab === "shortlisted" && shortlistedBids.length === 0 && (
                <div className="rounded-lg border border-dashed py-8 text-center">
                  <p className="text-sm text-muted-foreground">No shortlisted bids yet — shortlist one to keep it handy for reference.</p>
                </div>
              )}
              {visibleBids.map((b) => (
                <BidCard
                  key={b.id}
                  bid={b}
                  onShortlist={() => shortlistBid(b.id)}
                  onAccept={() => acceptBid(b.id, b.professional_name || undefined)}
                  onOffer={() => offerBid(b.id, b.amount, b.professional_name || undefined)}
                  onMessage={() => setActiveThread({ id: b.professional_id, name: b.professional_name || "Professional" })}
                  unread={threadUnread[b.professional_id] || 0}
                />
              ))}
              {invites.length > 0 && (
                <div className="border-t pt-4">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                    Direct Invites ({invites.length})
                  </h3>
                  <div className="space-y-2">
                    {invites.map((inv) => (
                      <div key={inv.id} className="rounded-lg border bg-muted/20 p-3 flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-medium">{inv.professional_name}</p>
                          {inv.message && <p className="text-xs text-muted-foreground mt-0.5 truncate">{inv.message}</p>}
                          {inv.proposed_amount != null && (
                            <p className="text-xs font-semibold mt-1">{fmtNaira(inv.proposed_amount)}</p>
                          )}
                        </div>
                        <Badge
                          className={`text-xs rounded-full capitalize ${
                            inv.status === "accepted"
                              ? "bg-green-100 text-green-700"
                              : inv.status === "declined"
                              ? "bg-red-100 text-red-600"
                              : "bg-amber-100 text-amber-700"
                          }`}
                        >
                          {inv.status === "accepted"
                            ? "Accepted, review their bid"
                            : inv.status === "declined"
                            ? "Declined"
                            : "Awaiting response"}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {activeThread && (
                <ProjectChat
                  projectId={project.id}
                  otherUserId={activeThread.id}
                  otherUserName={activeThread.name}
                  subtitle={project.title}
                  messagesHref={`/${rolePath}/dashboard/messages?project=${project.id}&user=${activeThread.id}&name=${encodeURIComponent(activeThread.name)}&title=${encodeURIComponent(project.title)}`}
                  mapAddress={activeInspection?.address}
                  mapDetails={activeInspection ? { phone: activeInspection.phone, details: activeInspection.details } : undefined}
                  onActivity={loadUnread}
                  onClose={() => {
                    setActiveThread(null);
                    loadUnread();
                  }}
                  className="h-[26rem]"
                />
              )}
            </div>
          )}

          {/* Messaging with the assigned professional / client */}
          {project.status !== "open" && (isClient || isProfessional) && (
            <div className="rounded-xl border bg-background p-4 md:p-5 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-semibold flex items-center gap-2"><MessageSquare className="h-4 w-4 text-muted-foreground" /> Messages</h2>
                {!activeThread && (
                  <Button size="sm" variant="outline" onClick={openChatWith}>
                    <MessageSquare className="h-3.5 w-3.5 mr-1" /> Open Chat
                    {projectUnread > 0 && (
                      <span className="ml-1.5 h-4 min-w-4 px-1 rounded-full bg-primary text-primary-foreground text-[10px] flex items-center justify-center">
                        {projectUnread > 9 ? "9+" : projectUnread}
                      </span>
                    )}
                  </Button>
                )}
              </div>
              {!activeThread && (
                <div className="rounded-lg border border-dashed py-6 text-center">
                  <p className="text-sm text-muted-foreground">Open the chat to message {isClient ? "your professional" : "the client"} about this project.</p>
                </div>
              )}
              {activeThread && (
                <ProjectChat
                  projectId={project.id}
                  otherUserId={activeThread.id}
                  otherUserName={activeThread.name}
                  subtitle={project.title}
                  messagesHref={`/${rolePath}/dashboard/messages?project=${project.id}&user=${activeThread.id}&name=${encodeURIComponent(activeThread.name)}&title=${encodeURIComponent(project.title)}`}
                  mapAddress={activeInspection?.address}
                  mapDetails={activeInspection ? { phone: activeInspection.phone, details: activeInspection.details } : undefined}
                  onActivity={loadUnread}
                  onClose={() => {
                    setActiveThread(null);
                    loadUnread();
                  }}
                  className="h-[26rem]"
                />
              )}
            </div>
          )}

          {/* Milestones */}
          {project.status !== "open" && (
            <div className="rounded-xl border bg-background p-4 md:p-5 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-semibold flex items-center gap-2"><ListChecks className="h-4 w-4 text-muted-foreground" /> Milestones</h2>
                {project.status === "in_progress" && isClient && (
                  <AddMilestoneForm projectId={project.id} onAdded={load} />
                )}
              </div>
              {milestones.length > 0 && (
                <div className="space-y-1.5">
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${progressPct}%` }} />
                  </div>
                  <p className="text-xs text-muted-foreground">{closedCount} of {milestones.length} milestone{milestones.length === 1 ? "" : "s"} closed · {progressPct}% complete</p>
                </div>
              )}
              {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
              {!loading && milestones.length === 0 && (
                <div className="rounded-lg border border-dashed py-8 text-center">
                  <ListChecks className="h-6 w-6 text-muted-foreground/50 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">
                    {isClient
                      ? "No milestones yet. Add one to define the payment schedule, or approve your professional's bid by funding it."
                      : "No milestones yet. Propose one to set up the payment schedule (the client funds it to approve)."}
                  </p>
                </div>
              )}
              {milestones.map((m) => (
                <MilestoneCard
                  key={m.id}
                  milestone={m}
                  isClient={isClient}
                  isProfessional={isProfessional}
                  assignedProfessionalId={project.assigned_professional_id}
                  disputed={hasProjectWideDispute || disputedMilestoneIds.has(m.id)}
                  walletBalance={user?.wallet_balance}
                  onChanged={load}
                />
              ))}
            </div>
          )}

          {/* Change orders */}
          {project.status !== "open" && (isClient || isProfessional) && (
            <ChangeOrdersSection
              projectId={project.id}
              currentUserId={user?.id}
              isClient={isClient}
              isProfessional={isProfessional}
              active={project.status !== "completed" && project.status !== "cancelled"}
              onMilestoneCreated={load}
            />
          )}

          {/* Review prompt on completion */}
          {project.status === "completed" && isClient && project.assigned_professional_id && (
            <ReviewForm projectId={project.id} revieweeId={project.assigned_professional_id} revieweeName="your professional" />
          )}
          {project.status === "completed" && isProfessional && (
            <ReviewForm projectId={project.id} revieweeId={project.client_id} revieweeName="the client" />
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6 lg:sticky lg:top-24 self-start">
          {project.status !== "open" && milestones.length > 0 && (
            <div className="rounded-xl border bg-background p-4 md:p-5 space-y-3">
              <h2 className="text-sm font-semibold flex items-center gap-2"><Wallet className="h-4 w-4 text-muted-foreground" /> Payment Summary</h2>
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Released</span>
                  <span className="font-medium text-emerald-600">{fmtNaira(paidTotal)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">In escrow</span>
                  <span className="font-medium text-amber-600">{fmtNaira(inEscrowTotal)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Upcoming</span>
                  <span className="font-medium">{fmtNaira(upcomingTotal)}</span>
                </div>
                <div className="flex items-center justify-between pt-2 border-t">
                  <span className="font-medium">Total</span>
                  <span className="font-semibold">{fmtNaira(projectTotal)}</span>
                </div>
              </div>
            </div>
          )}

          {(isClient || isProfessional) && (
            <div className="rounded-xl border bg-background p-4 md:p-5 space-y-2.5">
              <h2 className="text-sm font-semibold flex items-center gap-2"><Users className="h-4 w-4 text-muted-foreground" /> Quick Actions</h2>
              {isClient && project.status === "open" && (
                <>
                  <Button variant="outline" size="sm" className="w-full justify-start" onClick={() => setEditOpen(true)}>
                    <FileEdit className="h-3.5 w-3.5 mr-2" /> Edit Project
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full justify-start text-red-600 hover:text-red-700 border-red-200 hover:bg-red-50"
                    onClick={closeProject}
                  >
                    <X className="h-3.5 w-3.5 mr-2" /> Close Project
                  </Button>
                </>
              )}
              {isClient && project.status === "in_progress" && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start text-emerald-700 hover:text-emerald-800 border-emerald-200 hover:bg-emerald-50"
                  onClick={completeProject}
                >
                  <CheckCircle2 className="h-3.5 w-3.5 mr-2" /> Start Final Review
                </Button>
              )}
              {project.status !== "open" && !activeThread && (
                <Button variant="outline" size="sm" className="w-full justify-start" onClick={openChatWith}>
                  <MessageSquare className="h-3.5 w-3.5 mr-2" /> Message {isClient ? "professional" : "client"}
                </Button>
              )}
              {project.status !== "open" && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start text-red-600 hover:text-red-700 border-red-200 hover:bg-red-50"
                  onClick={() => setDisputeDialogOpen(true)}
                >
                  <ShieldAlert className="h-3.5 w-3.5 mr-2" /> Raise a dispute
                </Button>
              )}
              {projectDisputes.length > 0 && (
                <Link
                  href={`/${rolePath}/dashboard/disputes`}
                  className="flex items-center justify-between text-xs text-primary hover:underline pt-1"
                >
                  <span>View {projectDisputes.length} dispute{projectDisputes.length === 1 ? "" : "s"} on this project</span>
                  <ChevronRight className="h-3.5 w-3.5" />
                </Link>
              )}
            </div>
          )}
        </div>
      </div>

      {inviteOpen && (
        <InviteDialog projectId={project.id} onClose={() => setInviteOpen(false)} onInvited={load} />
      )}

      {disputeDialogOpen && (
        <RaiseDisputeDialog
          projectId={project.id}
          milestones={milestones}
          rolePath={rolePath}
          onClose={() => setDisputeDialogOpen(false)}
          onCreated={() => load()}
        />
      )}

      {editOpen && (
        <EditProjectDialog project={project} onClose={() => setEditOpen(false)} onSaved={load} />
      )}
    </div>
  );
}
