"use client";

import { useEffect, useRef, useState } from "react";
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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMessageSocket } from "@/hooks/useMessageSocket";
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
  type MessageOut,
  type ProfessionalOut,
  type DisputeOut,
  type DisputeCategory,
  DISPUTE_CATEGORY_LABELS,
} from "@/lib/api";
import { MILESTONE_STATUS_COLORS, BID_STATUS_COLORS, PROJECT_STATUS_COLORS } from "@/lib/statusColors";
import { toast } from "sonner";
import Link from "next/link";

function fmtNaira(n: number) {
  return `₦${n.toLocaleString()}`;
}

// ─── Add milestone (client only) ────────────────────────────────────────────
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
      toast.success("Milestone added");
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

// ─── Single milestone card ───────────────────────────────────────────────────
function MilestoneCard({
  milestone,
  isClient,
  isProfessional,
  disputed,
  onChanged,
}: {
  milestone: MilestoneOut;
  isClient: boolean;
  isProfessional: boolean;
  disputed: boolean;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);

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
            <Badge className={`text-xs rounded-full ${MILESTONE_STATUS_COLORS[milestone.status]}`}>{milestone.status.replace("_", " ")}</Badge>
          </div>
          <p className="text-sm font-semibold mt-1">{fmtNaira(milestone.amount)}</p>
        </div>
      </div>

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
        {isProfessional && milestone.status !== "paid" && milestone.status !== "approved" && (
          <PostUpdateForm milestoneId={milestone.id} onPosted={onChanged} />
        )}
        {isProfessional && (milestone.status === "pending" || milestone.status === "in_progress") && (
          <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" disabled={busy} onClick={() => act(() => api.submitMilestone(milestone.id), "Submitted for approval")}>
            <Send className="h-3.5 w-3.5 mr-1" /> Submit for Approval
          </Button>
        )}
        {isClient && !disputed && (milestone.status === "pending" || milestone.status === "in_progress" || milestone.status === "submitted") && (
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => {
              if (!confirm(`Fund "${milestone.title}" for ${fmtNaira(milestone.amount)}? This moves the amount into escrow.`)) return;
              act(() => api.fundMilestone(milestone.id), "Milestone funded");
            }}
          >
            <Wallet className="h-3.5 w-3.5 mr-1" /> Fund Milestone
          </Button>
        )}
        {isClient && (milestone.status === "funded" || milestone.status === "submitted") && (
          <Button size="sm" variant="outline" disabled={busy} onClick={() => act(() => api.approveMilestone(milestone.id), "Milestone approved")}>
            <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Approve
          </Button>
        )}
        {isClient && !disputed && (milestone.status === "funded" || milestone.status === "approved") && (
          <Button
            size="sm"
            className="bg-primary"
            disabled={busy}
            onClick={() => {
              if (!confirm(`Release ${fmtNaira(milestone.amount)} to the professional for "${milestone.title}"? This can't be undone.`)) return;
              act(() => api.releaseMilestone(milestone.id), "Payout released");
            }}
          >
            <Wallet className="h-3.5 w-3.5 mr-1" /> Release Payment
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
  isClient,
  isProfessional,
}: {
  projectId: string;
  isClient: boolean;
  isProfessional: boolean;
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
      await api.updateChangeOrder(id, status);
      toast.success(`Change order ${status}`);
      load();
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
        {isProfessional && <ProposeChangeOrderForm projectId={projectId} onAdded={load} />}
      </div>
      {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {!loading && orders.length === 0 && (
        <div className="rounded-lg border border-dashed py-8 text-center">
          <FileEdit className="h-6 w-6 text-muted-foreground/50 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No change orders on this project.</p>
        </div>
      )}
      {orders.map((co) => (
        <div key={co.id} className="rounded-lg border bg-background p-3 flex items-start justify-between gap-3">
          <div>
            <p className="text-sm">{co.description}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{new Date(co.created_at).toLocaleDateString()}</p>
          </div>
          <div className="text-right shrink-0">
            <p className={`text-sm font-semibold ${co.amount_delta >= 0 ? "text-emerald-600" : "text-red-600"}`}>
              {co.amount_delta >= 0 ? "+" : ""}{fmtNaira(co.amount_delta)}
            </p>
            <Badge className="text-xs rounded-full mt-1 capitalize">{co.status}</Badge>
            {isClient && co.status === "proposed" && (
              <div className="flex gap-1.5 mt-2">
                <Button size="sm" variant="outline" disabled={busyId === co.id} onClick={() => respond(co.id, "rejected")}>Reject</Button>
                <Button size="sm" disabled={busyId === co.id} onClick={() => respond(co.id, "approved")}>Approve</Button>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Messaging (REST polling) ────────────────────────────────────────────────
function MessageThread({
  projectId,
  otherUserId,
  otherUserName,
  onClose,
}: {
  projectId: string;
  otherUserId: string;
  otherUserName: string;
  onClose: () => void;
}) {
  const [messages, setMessages] = useState<MessageOut[]>([]);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [attaching, setAttaching] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = () => {
    api.projectMessages(projectId, otherUserId).then(setMessages).catch(() => {});
  };

  useEffect(() => {
    load();
    api.markThreadRead(projectId, otherUserId).catch(() => {});
    // Long-interval fallback in case the WebSocket connection can't be
    // established (proxy without WS support, token refresh, etc).
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, [projectId, otherUserId]); // eslint-disable-line react-hooks/exhaustive-deps

  useMessageSocket(projectId, (m) => {
    setMessages((prev) => (prev.some((existing) => existing.id === m.id) ? prev : [...prev, m]));
    if (m.recipient_id === otherUserId) return; // our own echo, no need to mark read
    api.markThreadRead(projectId, otherUserId).catch(() => {});
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const send = async () => {
    if (!body.trim()) return;
    setSending(true);
    const text = body;
    setBody("");
    try {
      await api.sendProjectMessage(projectId, { recipient_id: otherUserId, body: text });
      load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not send message");
      setBody(text);
    } finally {
      setSending(false);
    }
  };

  const sendAttachment = async (file: File) => {
    setAttaching(true);
    try {
      const uploaded = await api.uploadFile(file);
      await api.sendProjectMessage(projectId, { recipient_id: otherUserId, body: "", attachment_url: uploaded.url });
      load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not send attachment");
    } finally {
      setAttaching(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const isImage = (url: string) => /\.(png|jpe?g|gif|webp)$/i.test(url);

  return (
    <div className="rounded-xl border bg-background overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 border-b bg-muted/30">
        <p className="text-sm font-medium">Chat with {otherUserName}</p>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="max-h-72 overflow-y-auto p-3 space-y-2">
        {messages.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">No messages yet, say hello.</p>}
        {messages.map((m) => {
          const mine = m.sender_name !== otherUserName;
          return (
            <div key={m.id} className={`max-w-[80%] rounded-lg px-3 py-1.5 text-xs space-y-1 ${mine ? "bg-primary text-primary-foreground ml-auto" : "bg-muted mr-auto"}`}>
              {m.body && <p>{m.body}</p>}
              {m.attachment_url && (
                isImage(m.attachment_url) ? (
                  <a href={m.attachment_url} target="_blank" rel="noopener noreferrer">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={m.attachment_url} alt="Attachment" className="rounded-md max-h-40 max-w-full object-cover" />
                  </a>
                ) : (
                  <a href={m.attachment_url} target="_blank" rel="noopener noreferrer" className={`flex items-center gap-1 underline ${mine ? "text-primary-foreground" : "text-primary"}`}>
                    <FileEdit className="h-3 w-3" /> View attachment
                  </a>
                )
              )}
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>
      <div className="flex items-center gap-2 p-2 border-t">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,application/pdf"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) sendAttachment(file);
          }}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={attaching}
          className="shrink-0 h-9 w-9 rounded-md border flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50 disabled:opacity-50"
          title="Attach a file"
        >
          <Camera className="h-4 w-4" />
        </button>
        <Input
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && send()}
          placeholder="Type a message..."
          className="h-9"
        />
        <Button size="sm" onClick={send} disabled={sending || !body.trim()}>
          <Send className="h-3.5 w-3.5" />
        </Button>
      </div>
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
  onMessage,
}: {
  bid: BidOut;
  onShortlist: () => void;
  onAccept: () => void;
  onMessage: () => void;
}) {
  return (
    <div className="rounded-xl border bg-background p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="font-medium text-sm">{bid.professional_name}</p>
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
      <div className="flex flex-wrap gap-2 pt-1 border-t">
        <Button size="sm" variant="outline" className="mt-2" onClick={onMessage}>
          <MessageSquare className="h-3.5 w-3.5 mr-1" /> Message
        </Button>
        {(bid.status === "pending" || bid.status === "shortlisted") && (
          <>
            {bid.status === "pending" && (
              <Button size="sm" variant="outline" className="mt-2" onClick={onShortlist}>Shortlist</Button>
            )}
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

// ─── Full project workspace (milestones + bids) ──────────────────────────────
export function ProjectWorkspace({
  project,
  onClose,
  backHref = "/",
}: {
  project: ProjectOut;
  onClose?: () => void;
  backHref?: string;
}) {
  const { user } = useAuth();
  const [milestones, setMilestones] = useState<MilestoneOut[]>([]);
  const [bids, setBids] = useState<BidOut[]>([]);
  const [disputes, setDisputes] = useState<DisputeOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [disputeDialogOpen, setDisputeDialogOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [activeThread, setActiveThread] = useState<{ id: string; name: string } | null>(null);

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
    }
    Promise.all(calls).catch(() => toast.error("Could not load project data")).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [project.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const shortlistBid = async (bidId: string) => {
    try {
      await api.updateBid(bidId, "shortlisted");
      toast.success("Shortlisted");
      load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not shortlist proposal");
    }
  };

  const acceptBid = async (bidId: string, professionalName?: string) => {
    if (!confirm(`Accept this proposal${professionalName ? ` from ${professionalName}` : ""}? This assigns them to the project and closes it to other bids.`)) return;
    try {
      await api.updateBid(bidId, "accepted");
      toast.success("Proposal accepted, set up milestones to get started");
      load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not accept proposal");
    }
  };

  const sortedBids = [...bids].sort((a, b) => b.amount === a.amount ? 0 : a.amount - b.amount);

  const paidTotal = milestones.filter((m) => m.status === "paid").reduce((s, m) => s + m.amount, 0);
  const inEscrowTotal = milestones.filter((m) => ["funded", "submitted", "approved"].includes(m.status)).reduce((s, m) => s + m.amount, 0);
  const upcomingTotal = milestones.filter((m) => ["pending", "in_progress"].includes(m.status)).reduce((s, m) => s + m.amount, 0);
  const projectTotal = paidTotal + inEscrowTotal + upcomingTotal;
  const paidCount = milestones.filter((m) => m.status === "paid").length;
  const progressPct = milestones.length > 0 ? Math.round((paidCount / milestones.length) * 100) : 0;

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
            {project.skills.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3">
                {project.skills.map((s) => <Badge key={s} variant="secondary" className="text-xs rounded-full">{s}</Badge>)}
              </div>
            )}
            <div className="flex items-center gap-2 mt-4 pt-4 border-t">
              <Wallet className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold text-primary">{fmtNaira(project.budget_min)} – {fmtNaira(project.budget_max)}</span>
              <span className="text-xs text-muted-foreground">project budget range</span>
            </div>
          </div>

          {/* Open project: compare bids, invite directly */}
          {isClient && project.status === "open" && (
            <div className="rounded-xl border bg-background p-4 md:p-5 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-semibold flex items-center gap-2"><Inbox className="h-4 w-4 text-muted-foreground" /> Proposals ({bids.length})</h2>
                <Button size="sm" variant="outline" onClick={() => setInviteOpen(true)}>
                  <UserPlus className="h-3.5 w-3.5 mr-1" /> Invite a Professional
                </Button>
              </div>
              {bids.length === 0 && (
                <div className="rounded-lg border border-dashed py-8 text-center">
                  <Inbox className="h-6 w-6 text-muted-foreground/50 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No proposals yet, or invite someone directly.</p>
                </div>
              )}
              {sortedBids.map((b) => (
                <BidCard
                  key={b.id}
                  bid={b}
                  onShortlist={() => shortlistBid(b.id)}
                  onAccept={() => acceptBid(b.id, b.professional_name || undefined)}
                  onMessage={() => setActiveThread({ id: b.professional_id, name: b.professional_name || "Professional" })}
                />
              ))}
              {activeThread && (
                <MessageThread
                  projectId={project.id}
                  otherUserId={activeThread.id}
                  otherUserName={activeThread.name}
                  onClose={() => setActiveThread(null)}
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
                  </Button>
                )}
              </div>
              {!activeThread && (
                <div className="rounded-lg border border-dashed py-6 text-center">
                  <p className="text-sm text-muted-foreground">Open the chat to message {isClient ? "your professional" : "the client"} about this project.</p>
                </div>
              )}
              {activeThread && (
                <MessageThread
                  projectId={project.id}
                  otherUserId={activeThread.id}
                  otherUserName={activeThread.name}
                  onClose={() => setActiveThread(null)}
                />
              )}
            </div>
          )}

          {/* Milestones */}
          {project.status !== "open" && (
            <div className="rounded-xl border bg-background p-4 md:p-5 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-semibold flex items-center gap-2"><ListChecks className="h-4 w-4 text-muted-foreground" /> Milestones</h2>
                {isClient && <AddMilestoneForm projectId={project.id} onAdded={load} />}
              </div>
              {milestones.length > 0 && (
                <div className="space-y-1.5">
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${progressPct}%` }} />
                  </div>
                  <p className="text-xs text-muted-foreground">{paidCount} of {milestones.length} milestone{milestones.length === 1 ? "" : "s"} paid · {progressPct}% complete</p>
                </div>
              )}
              {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
              {!loading && milestones.length === 0 && (
                <div className="rounded-lg border border-dashed py-8 text-center">
                  <ListChecks className="h-6 w-6 text-muted-foreground/50 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">
                    {isClient ? "No milestones yet, add one to define the payment schedule." : "The client hasn't set up milestones yet."}
                  </p>
                </div>
              )}
              {milestones.map((m) => (
                <MilestoneCard
                  key={m.id}
                  milestone={m}
                  isClient={isClient}
                  isProfessional={isProfessional}
                  disputed={hasProjectWideDispute || disputedMilestoneIds.has(m.id)}
                  onChanged={load}
                />
              ))}
            </div>
          )}

          {/* Change orders */}
          {project.status !== "open" && (isClient || isProfessional) && (
            <ChangeOrdersSection projectId={project.id} isClient={isClient} isProfessional={isProfessional} />
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
    </div>
  );
}
