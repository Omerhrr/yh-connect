
"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  BarChart3,
  Bell,
  Briefcase,
  CheckCircle2,
  ChevronRight,
  Clock,
  DollarSign,
  FileText,
  LogOut,
  MessageSquare,
  Plus,
  Search,
  Settings,
  Star,
  TrendingUp,
  User,
  Users,
  Zap,
  ArrowUpRight,
  Package,
  Wallet,
  Menu,
  X,
  BadgeCheck,
  Send,
  Building2,
  UserPlus,
  Camera,
  Heart,
  Download,
  GraduationCap,
  Award,
  Languages as LanguagesIcon,
  Trash2,
  Upload,
  ShieldCheck,
  ShieldAlert,
  FileCheck2,
  Calendar,
  Mail,
  MapPin,
  Globe,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { UserAvatar } from "@/components/site/UserAvatar";
import { useAuth } from "@/store/auth";
import {
  api,
  ApiError,
  NIGERIAN_BANKS,
  type ProjectOut,
  type ProfessionalOut,
  type BidOut,
  type BidStatus,
  type WalletTransactionOut,
  type InviteOut,
  type MessageOut,
  type ThreadOut,
  type DisputeOut,
  type DisputeDetailOut,
  type ReviewOut,
  type FavoriteTargetType,
  type EmploymentHistoryOut,
  type EducationOut,
  type CertificationOut,
  type LanguageEntry,
  type ClientPublicOut,
  DISPUTE_CATEGORY_LABELS,
  DISPUTE_OUTCOME_LABELS,
} from "@/lib/api";
import { CATEGORIES } from "@/data/content";
import { PROJECT_STATUS_COLORS, BID_STATUS_COLORS, DISPUTE_STATUS_COLORS } from "@/lib/statusColors";
import { toast } from "sonner";
import Link from "next/link";
import { useMessageSocket } from "@/hooks/useMessageSocket";
import { Skeleton } from "@/components/ui/skeleton";
import { Inbox } from "lucide-react";
import { ReviewCard } from "@/components/site/shared/ReviewCard";
import { ProfessionalProfileView } from "@/components/site/pages/ProfessionalProfileView";

// ─── Loading skeleton for card/list panels ────────────────────────────────────
export function ListSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="rounded-xl border bg-background p-4 flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-full shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-2/5" />
            <Skeleton className="h-3 w-3/5" />
          </div>
          <Skeleton className="h-6 w-16 rounded-full shrink-0" />
        </div>
      ))}
    </div>
  );
}

// ─── Empty state with icon + optional CTA ──────────────────────────────────────
export function EmptyState({
  icon: Icon = Inbox,
  title,
  message,
  action,
}: {
  icon?: React.ElementType;
  title: string;
  message?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border bg-background p-10 text-center flex flex-col items-center gap-2">
      <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-1">
        <Icon className="h-5 w-5 text-muted-foreground" />
      </div>
      <p className="text-sm font-medium">{title}</p>
      {message && <p className="text-sm text-muted-foreground max-w-sm">{message}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

// ─── Favorite (save) toggle button ────────────────────────────────────────────
export function FavoriteButton({
  targetType,
  targetId,
  saved,
  onToggle,
  className = "",
}: {
  targetType: FavoriteTargetType;
  targetId: string;
  saved: boolean;
  onToggle: (nextSaved: boolean) => void;
  className?: string;
}) {
  const [busy, setBusy] = useState(false);

  const toggle = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (busy) return;
    setBusy(true);
    const next = !saved;
    try {
      if (next) {
        await api.addFavorite(targetType, targetId);
      } else {
        await api.removeFavorite(targetType, targetId);
      }
      onToggle(next);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not update saved items");
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      aria-pressed={saved}
      aria-label={saved ? "Remove from saved" : "Save"}
      className={`inline-flex items-center justify-center h-8 w-8 rounded-full border bg-background hover:bg-muted transition-colors disabled:opacity-60 ${className}`}
    >
      <Heart className={`h-4 w-4 ${saved ? "fill-rose-500 text-rose-500" : "text-muted-foreground"}`} />
    </button>
  );
}

// ─── Wallet transaction receipt download ──────────────────────────────────────
function ReceiptDownloadButton({ transactionId }: { transactionId: string }) {
  const [downloading, setDownloading] = useState(false);

  const download = async () => {
    setDownloading(true);
    try {
      await api.downloadReceipt(transactionId);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not download receipt");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={download}
      disabled={downloading}
      aria-label="Download receipt"
      title="Download receipt"
      className="inline-flex items-center justify-center h-8 w-8 rounded-full border bg-background hover:bg-muted transition-colors disabled:opacity-60 shrink-0"
    >
      <Download className="h-3.5 w-3.5 text-muted-foreground" />
    </button>
  );
}

// ─── Stat card ───────────────────────────────────────────────────────────────
function StatCard({ label, value, icon: Icon, change, color = "primary" }: {
  label: string;
  value: string;
  icon: React.ElementType;
  change?: string;
  color?: "primary" | "emerald" | "amber" | "blue";
}) {
  const colorMap = {
    primary: "bg-primary/10 text-primary",
    emerald: "bg-emerald-100 text-emerald-700",
    amber: "bg-amber-100 text-amber-700",
    blue: "bg-blue-100 text-blue-700",
  };
  return (
    <div className="rounded-xl border bg-background p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="text-2xl font-bold mt-1">{value}</p>
          {change && (
            <p className="text-xs text-emerald-600 flex items-center gap-1 mt-1">
              <ArrowUpRight className="h-3 w-3" /> {change}
            </p>
          )}
        </div>
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${colorMap[color]}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

// ─── Shared messaging panel (thread list + chat, REST polling) ──────────────
function MessagesPanel() {
  const { user } = useAuth();
  const [threads, setThreads] = useState<ThreadOut[]>([]);
  const [loadingThreads, setLoadingThreads] = useState(true);
  const [active, setActive] = useState<ThreadOut | null>(null);
  const [messages, setMessages] = useState<MessageOut[]>([]);
  const [body, setBody] = useState("");
  const [attaching, setAttaching] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadThreads = () => {
    api.messageThreads().then(setThreads).catch(() => {}).finally(() => setLoadingThreads(false));
  };

  useEffect(() => {
    loadThreads();
    const interval = setInterval(loadThreads, 20000);
    return () => clearInterval(interval);
  }, []);

  const loadMessages = (thread: ThreadOut) => {
    api.projectMessages(thread.project_id, thread.other_user_id).then(setMessages).catch(() => {});
  };

  useEffect(() => {
    if (!active) return;
    loadMessages(active);
    api.markThreadRead(active.project_id, active.other_user_id).then(loadThreads).catch(() => {});
    // Long-interval fallback in case the WebSocket connection can't be established.
    const interval = setInterval(() => loadMessages(active), 30000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active?.project_id, active?.other_user_id]);

  useMessageSocket(active?.project_id ?? null, (m) => {
    if (!active) return;
    if (m.sender_id !== active.other_user_id && m.recipient_id !== active.other_user_id) return;
    setMessages((prev) => (prev.some((existing) => existing.id === m.id) ? prev : [...prev, m]));
    if (m.sender_id === active.other_user_id) {
      api.markThreadRead(active.project_id, active.other_user_id).then(loadThreads).catch(() => {});
    }
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const send = async () => {
    if (!active || !body.trim()) return;
    const text = body;
    setBody("");
    try {
      await api.sendProjectMessage(active.project_id, { recipient_id: active.other_user_id, body: text });
      loadMessages(active);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not send message");
      setBody(text);
    }
  };

  const sendAttachment = async (file: File) => {
    if (!active) return;
    setAttaching(true);
    try {
      const uploaded = await api.uploadFile(file);
      await api.sendProjectMessage(active.project_id, { recipient_id: active.other_user_id, body: "", attachment_url: uploaded.url });
      loadMessages(active);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not send attachment");
    } finally {
      setAttaching(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const isImage = (url: string) => /\.(png|jpe?g|gif|webp)$/i.test(url);

  return (
    <div className="grid md:grid-cols-[280px_1fr] gap-4 h-[calc(100vh-220px)] min-h-[420px]">
      <div className="rounded-xl border bg-background overflow-y-auto divide-y">
        {loadingThreads && <ListSkeleton />}
        {!loadingThreads && threads.length === 0 && (
          <div className="p-2">
            <EmptyState icon={MessageSquare} title="No conversations yet" message="Messages with clients or professionals on your projects will show up here." />
          </div>
        )}
        {threads.map((t) => (
          <button
            key={`${t.project_id}-${t.other_user_id}`}
            onClick={() => setActive(t)}
            className={`flex w-full items-start gap-3 p-3 text-left hover:bg-muted/30 ${
              active?.project_id === t.project_id && active?.other_user_id === t.other_user_id ? "bg-muted/40" : ""
            }`}
          >
            <div className="h-9 w-9 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-sm shrink-0">
              {t.other_user_name.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium truncate">{t.other_user_name}</p>
                {t.unread_count > 0 && <span className="h-2 w-2 rounded-full bg-primary shrink-0" />}
              </div>
              <p className="text-xs text-muted-foreground truncate">{t.project_title}</p>
              <p className="text-xs text-muted-foreground truncate mt-0.5">{t.last_message}</p>
            </div>
          </button>
        ))}
      </div>
      <div className="rounded-xl border bg-background flex flex-col overflow-hidden">
        {!active ? (
          <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">Select a conversation</div>
        ) : (
          <>
            <div className="border-b p-3">
              <p className="text-sm font-semibold">{active.other_user_name}</p>
              <p className="text-xs text-muted-foreground">{active.project_title}</p>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {messages.map((m) => {
                const mine = m.sender_id === user?.id;
                return (
                  <div
                    key={m.id}
                    className={`max-w-[70%] rounded-lg px-3 py-1.5 text-sm space-y-1 ${
                      mine ? "bg-primary text-primary-foreground ml-auto" : "bg-muted mr-auto"
                    }`}
                  >
                    {m.body && <p>{m.body}</p>}
                    {m.attachment_url && (
                      isImage(m.attachment_url) ? (
                        <a href={m.attachment_url} target="_blank" rel="noopener noreferrer">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={m.attachment_url} alt="Attachment" className="rounded-md max-h-48 max-w-full object-cover" />
                        </a>
                      ) : (
                        <a href={m.attachment_url} target="_blank" rel="noopener noreferrer" className={`flex items-center gap-1 text-xs underline ${mine ? "text-primary-foreground" : "text-primary"}`}>
                          View attachment
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
                onKeyDown={(e) => e.key === "Enter" && send()}
                placeholder="Type a message..."
                className="h-9"
              />
              <Button size="sm" onClick={send} disabled={!body.trim()}>
                <Send className="h-3.5 w-3.5" />
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Shared bid-status display (used wherever a talent can Apply) ──────────
const BID_STATUS_LABELS: Record<BidStatus, string> = {
  pending: "Applied",
  shortlisted: "Shortlisted",
  accepted: "Accepted",
  rejected: "Not selected",
  withdrawn: "Withdrawn",
};

// ─── Shared "My Disputes" panel (both parties; admin resolves) ──────────────
export const DISPUTE_STATUS_LABELS: Record<string, string> = {
  open: "Open",
  under_review: "Under review",
  escalated: "Escalated",
  resolved: "Resolved",
  withdrawn: "Withdrawn",
};

export function MyDisputesPanel() {
  const { user } = useAuth();
  const [disputes, setDisputes] = useState<DisputeOut[]>([]);
  const [loading, setLoading] = useState(true);
  const rolePath = user?.role === "professional" ? "talent" : "client";

  useEffect(() => {
    api.myDisputes().then(setDisputes).catch(() => toast.error("Could not load disputes")).finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">Disputes</h1>
      <p className="text-sm text-muted-foreground">Track any disputes on your projects. You and the other party can both post updates here; our team reviews and resolves them.</p>
      {loading && <ListSkeleton />}
      {!loading && disputes.length === 0 && (
        <div className="rounded-xl border bg-background p-10 text-center">
          <p className="text-sm text-muted-foreground">No disputes raised. If something goes wrong on a project, you can open a case from that project&apos;s workspace.</p>
        </div>
      )}
      <div className="rounded-xl border bg-background divide-y">
        {disputes.map((d) => (
          <Link key={d.id} href={`/${rolePath}/dashboard/disputes/${d.id}`} className="block p-5 space-y-2 hover:bg-muted/30 transition-colors">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-medium">{d.reason}</p>
                  <Badge variant="outline" className="text-[10px] rounded-full">{DISPUTE_CATEGORY_LABELS[d.category]}</Badge>
                </div>
                {d.project_title && <p className="text-xs text-muted-foreground mt-0.5">{d.project_title}{d.milestone_title && ` · ${d.milestone_title}`}</p>}
              </div>
              <Badge className={`text-xs rounded-full shrink-0 ${DISPUTE_STATUS_COLORS[d.status]}`}>{DISPUTE_STATUS_LABELS[d.status]}</Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Raised {new Date(d.created_at).toLocaleDateString()}
              {d.message_count > 0 && ` · ${d.message_count} message${d.message_count === 1 ? "" : "s"}`}
            </p>
            {d.resolution_note && (
              <p className="text-xs text-muted-foreground bg-muted/50 rounded-md p-2 mt-1">
                <span className="font-medium">Resolution:</span> {d.resolution_note}
              </p>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}

// ─── Dispute case detail (shared by client + talent) ─────────────────────────
export function DisputeCaseView({ disputeId, backHref }: { disputeId: string; backHref: string }) {
  const { user } = useAuth();
  const [dispute, setDispute] = useState<DisputeDetailOut | null>(null);
  const [loading, setLoading] = useState(true);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);

  const load = () => {
    api.disputeDetail(disputeId).then(setDispute).catch(() => toast.error("Could not load this dispute")).finally(() => setLoading(false));
  };
  useEffect(load, [disputeId]); // eslint-disable-line react-hooks/exhaustive-deps

  const isRaiser = dispute?.raised_by === user?.id;
  const isClosed = dispute?.status === "resolved" || dispute?.status === "withdrawn";
  const canWithdraw = isRaiser && (dispute?.status === "open" || dispute?.status === "under_review");

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

  const withdraw = async () => {
    if (!dispute || !confirm("Withdraw this dispute? Fund release will no longer be blocked.")) return;
    setWithdrawing(true);
    try {
      await api.withdrawDispute(dispute.id);
      toast.success("Dispute withdrawn");
      load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not withdraw dispute");
    } finally {
      setWithdrawing(false);
    }
  };

  if (loading) return <ListSkeleton />;
  if (!dispute) return <p className="text-sm text-muted-foreground">Dispute not found.</p>;

  return (
    <div className="space-y-5 max-w-2xl">
      <Link href={backHref} className="text-sm text-muted-foreground hover:text-foreground">← Back to Disputes</Link>

      <div className="rounded-xl border bg-background p-5 space-y-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold">{dispute.project_title || "Dispute"}</h1>
              <Badge variant="outline" className="text-xs rounded-full">{DISPUTE_CATEGORY_LABELS[dispute.category]}</Badge>
            </div>
            {dispute.milestone_title && (
              <p className="text-sm text-muted-foreground mt-1">Milestone: {dispute.milestone_title}{dispute.milestone_amount != null && ` (₦${dispute.milestone_amount.toLocaleString("en-NG")})`}</p>
            )}
          </div>
          <Badge className={`text-xs rounded-full ${DISPUTE_STATUS_COLORS[dispute.status]}`}>{DISPUTE_STATUS_LABELS[dispute.status]}</Badge>
        </div>

        <div className="text-sm">
          <p className="text-xs text-muted-foreground">Filed by {dispute.raised_by_name} · {new Date(dispute.created_at).toLocaleDateString()}</p>
          <p className="mt-2 whitespace-pre-wrap">{dispute.reason}</p>
        </div>

        {dispute.evidence_urls.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {dispute.evidence_urls.map((url) => (
              <a key={url} href={url} target="_blank" rel="noopener noreferrer" className="block">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="Evidence" className="h-16 w-16 rounded-lg object-cover border hover:opacity-80 transition-opacity" />
              </a>
            ))}
          </div>
        )}

        {dispute.status === "resolved" && (
          <div className="rounded-lg bg-green-50 border border-green-200 p-3 text-sm">
            <p className="font-medium text-green-800">
              Resolved{dispute.outcome && ` — ${DISPUTE_OUTCOME_LABELS[dispute.outcome]}`}
            </p>
            {dispute.resolution_note && <p className="text-green-700 mt-1">{dispute.resolution_note}</p>}
            {dispute.resolved_by_name && <p className="text-xs text-green-700/70 mt-1">By {dispute.resolved_by_name}{dispute.resolved_at && ` on ${new Date(dispute.resolved_at).toLocaleDateString()}`}</p>}
          </div>
        )}

        {canWithdraw && (
          <Button size="sm" variant="outline" onClick={withdraw} disabled={withdrawing}>
            {withdrawing ? "Withdrawing..." : "Withdraw Dispute"}
          </Button>
        )}
      </div>

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
            <Input value={reply} onChange={(e) => setReply(e.target.value)} onKeyDown={(e) => e.key === "Enter" && sendReply()} placeholder="Add a reply..." className="h-9" />
            <Button size="sm" onClick={sendReply} disabled={sending || !reply.trim()}>Send</Button>
          </div>
        ) : (
          <div className="p-4 border-t">
            <p className="text-xs text-muted-foreground">This dispute is closed.</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// CLIENT DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════════
const STATUS_COLORS = PROJECT_STATUS_COLORS;

function fmtNaira(n: number) {
  return `₦${n.toLocaleString()}`;
}

export function PostProjectDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [location, setLocation] = useState("");
  const [budgetMin, setBudgetMin] = useState("");
  const [budgetMax, setBudgetMax] = useState("");
  const [budgetType, setBudgetType] = useState<"fixed" | "hourly">("fixed");
  const [skills, setSkills] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !description || !categoryId || !budgetMin || !budgetMax) {
      toast.error("Please fill in all required fields");
      return;
    }
    setSubmitting(true);
    try {
      await api.createProject({
        title,
        description,
        category_id: categoryId,
        location: location || undefined,
        budget_min: Number(budgetMin),
        budget_max: Number(budgetMax),
        budget_type: budgetType,
        skills: skills.split(",").map((s) => s.trim()).filter(Boolean),
      });
      toast.success("Project posted!");
      onCreated();
      onClose();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not post project");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4">
      <div className="w-full sm:max-w-lg max-h-[90vh] overflow-y-auto bg-background rounded-t-2xl sm:rounded-2xl border shadow-lg p-6">
        <h2 className="text-lg font-bold mb-4">Post a New Project</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Project Title *</label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Structural design for 2-storey duplex" />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Category *</label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">Select category…</option>
              {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Description *</label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none"
              placeholder="Describe the scope of work, site location, timeline..."
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Site Location</label>
            <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Lekki, Lagos" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Budget Min (₦) *</label>
              <Input type="number" value={budgetMin} onChange={(e) => setBudgetMin(e.target.value)} placeholder="500000" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Budget Max (₦) *</label>
              <Input type="number" value={budgetMax} onChange={(e) => setBudgetMax(e.target.value)} placeholder="1200000" />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Budget Type</label>
            <div className="flex gap-2">
              {(["fixed", "hourly"] as const).map((bt) => (
                <button
                  type="button"
                  key={bt}
                  onClick={() => setBudgetType(bt)}
                  className={`flex-1 rounded-lg border py-2 text-xs capitalize ${budgetType === bt ? "bg-primary text-primary-foreground border-primary" : "hover:border-primary"}`}
                >
                  {bt}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Required Skills (comma-separated)</label>
            <Input value={skills} onChange={(e) => setSkills(e.target.value)} placeholder="AutoCAD, Structural Design" />
          </div>
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
            <Button type="submit" className="flex-1" disabled={submitting}>{submitting ? "Posting..." : "Post Project"}</Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function ClientOverview({ onPostProject }: { onPostProject: () => void }) {
  const { user } = useAuth();
  const [projects, setProjects] = useState<ProjectOut[]>([]);
  const [professionals, setProfessionals] = useState<ProfessionalOut[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.myProjects(), api.professionals()])
      .then(([p, pros]) => {
        setProjects(p);
        setProfessionals(pros.slice(0, 4));
      })
      .catch(() => toast.error("Could not load dashboard data"))
      .finally(() => setLoading(false));
  }, []);

  const activeCount = projects.filter((p) => p.status === "in_progress").length;
  const totalBudget = projects.reduce((sum, p) => sum + (p.status !== "open" ? p.budget_max : 0), 0);
  const totalProposals = projects.reduce((sum, p) => sum + p.bid_count, 0);

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border bg-gradient-to-br from-primary to-primary/80 text-primary-foreground p-6 md:p-7 flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">Welcome back{user ? `, ${user.first_name}` : ""} <span className="inline-block">👋</span></h1>
          <p className="text-primary-foreground/80 text-sm mt-1">Here&apos;s what&apos;s happening with your projects.</p>
        </div>
        <Button size="sm" className="bg-background text-foreground hover:bg-background/90 shrink-0" onClick={onPostProject}>
          <Plus className="h-3.5 w-3.5 mr-1" /> Post Project
        </Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Active Projects" value={String(activeCount)} icon={Briefcase} />
        <StatCard label="Committed Budget" value={fmtNaira(totalBudget)} icon={DollarSign} color="emerald" />
        <StatCard label="Proposals Received" value={String(totalProposals)} icon={FileText} color="blue" />
        <StatCard label="Total Projects" value={String(projects.length)} icon={Star} color="amber" />
      </div>

      <div className="rounded-xl border bg-background">
        <div className="flex items-center justify-between p-5 border-b">
          <h2 className="font-semibold">Recent Projects</h2>
          {projects.length > 0 && (
            <Link href="/client/dashboard/projects" className="text-xs text-primary hover:underline flex items-center gap-0.5">
              View all <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          )}
        </div>
        <div className="divide-y">
          {loading && <ListSkeleton />}
          {!loading && projects.length === 0 && (
            <div className="p-2">
              <EmptyState
                icon={Briefcase}
                title="No projects yet"
                message="Post your first project to start getting proposals from professionals."
                action={<Button size="sm" onClick={onPostProject}><Plus className="h-3.5 w-3.5 mr-1" /> Post Project</Button>}
              />
            </div>
          )}
          {projects.slice(0, 5).map((proj) => (
            <Link
              key={proj.id}
              href={`/client/dashboard/projects/${proj.id}`}
              className="flex items-center gap-4 p-4 hover:bg-muted/40 transition-colors group"
            >
              <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <Briefcase className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate group-hover:text-primary transition-colors">{proj.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {proj.category.label} · {proj.bid_count} proposal{proj.bid_count === 1 ? "" : "s"}
                </p>
              </div>
              <div className="flex flex-col items-end gap-2 shrink-0">
                <Badge className={`text-xs rounded-full ${STATUS_COLORS[proj.status]}`}>{proj.status.replace("_", " ")}</Badge>
                <span className="text-xs font-medium">{fmtNaira(proj.budget_min)} – {fmtNaira(proj.budget_max)}</span>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 hidden sm:block" />
            </Link>
          ))}
        </div>
      </div>

      <div className="rounded-xl border bg-background">
        <div className="flex items-center justify-between p-5 border-b">
          <h2 className="font-semibold">Recommended Professionals</h2>
          <Link href="/client/dashboard/find-talent" className="text-xs text-primary hover:underline flex items-center gap-0.5">
            Browse all <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        {!loading && professionals.length === 0 && (
          <div className="p-2">
            <EmptyState icon={Users} title="No recommendations yet" message="Check back soon, or browse professionals directly." />
          </div>
        )}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 p-4">
          {professionals.map((t) => (
            <Link
              key={t.id}
              href={`/client/dashboard/find-talent/${t.id}`}
              className="rounded-lg border p-4 text-center hover:shadow-md hover:border-primary/40 transition-all"
            >
              <div className="mx-auto mb-3 h-12 w-12 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">
                {t.first_name.charAt(0)}
              </div>
              <div className="flex items-center justify-center gap-1">
                <p className="font-medium text-xs">{t.first_name} {t.last_name}</p>
                {t.verification_status === "verified" && <BadgeCheck className="h-3 w-3 text-emerald-600 shrink-0" />}
              </div>
              <p className="text-xs text-muted-foreground truncate">{t.title}</p>
              <div className="flex items-center justify-center gap-1 mt-1">
                <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                <span className="text-xs">{t.rating || "New"}</span>
              </div>
              {t.hourly_rate && <p className="text-xs font-semibold text-primary mt-1">₦{t.hourly_rate}/hr</p>}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

export function ClientProjects({ onPostProject, refreshKey }: { onPostProject: () => void; refreshKey: number }) {
  const [projects, setProjects] = useState<ProjectOut[]>([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    api.myProjects().then(setProjects).catch(() => toast.error("Could not load projects")).finally(() => setLoading(false));
  };

  useEffect(load, [refreshKey]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">My Projects</h1>
        <Button onClick={onPostProject}><Plus className="h-4 w-4 mr-1" /> Post New Project</Button>
      </div>
      <div className="rounded-xl border bg-background divide-y">
        {loading && <ListSkeleton />}
        {!loading && projects.length === 0 && (
          <p className="p-5 text-sm text-muted-foreground">No projects yet, post your first one.</p>
        )}
        {projects.map((proj) => (
          <Link key={proj.id} href={`/client/dashboard/projects/${proj.id}`} className="flex w-full items-center gap-4 p-5 text-left hover:bg-muted/30">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 shrink-0">
              <Briefcase className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm">{proj.title}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {proj.category.label} · {proj.bid_count} proposal{proj.bid_count === 1 ? "" : "s"}
              </p>
              {proj.progress > 0 && (
                <div className="mt-2 flex items-center gap-2">
                  <div className="w-32 h-1.5 rounded-full bg-muted">
                    <div className="h-1.5 rounded-full bg-primary" style={{ width: `${proj.progress}%` }} />
                  </div>
                  <span className="text-xs text-muted-foreground">{proj.progress}%</span>
                </div>
              )}
            </div>
            <div className="flex flex-col items-end gap-2">
              <Badge className={`text-xs rounded-full ${STATUS_COLORS[proj.status]}`}>{proj.status.replace("_", " ")}</Badge>
              <span className="text-sm font-semibold">{fmtNaira(proj.budget_min)} – {fmtNaira(proj.budget_max)}</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

export function InviteToProjectDialog({ professional, onClose }: { professional: ProfessionalOut; onClose: () => void }) {
  const [projects, setProjects] = useState<ProjectOut[]>([]);
  const [projectId, setProjectId] = useState("");
  const [amount, setAmount] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api.myProjects().then((ps) => setProjects(ps.filter((p) => p.status === "open"))).catch(() => {});
  }, []);

  const submit = async () => {
    if (!projectId) return toast.error("Pick a project to invite them to");
    setSubmitting(true);
    try {
      await api.createInvite(projectId, {
        professional_id: professional.user_id,
        proposed_amount: amount ? Number(amount) : undefined,
        message: message || undefined,
      });
      toast.success("Invite sent");
      onClose();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not send invite");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4">
      <div className="w-full sm:max-w-md max-h-[90vh] overflow-y-auto bg-background rounded-t-2xl sm:rounded-2xl border shadow-lg p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">Invite {professional.first_name}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Project *</label>
          <select value={projectId} onChange={(e) => setProjectId(e.target.value)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
            <option value="">Select an open project…</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
          </select>
          {projects.length === 0 && <p className="text-xs text-muted-foreground">You don&apos;t have any open projects to invite them to, post a project first.</p>}
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
            className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none"
            placeholder="Tell them why you'd like to work with them..."
          />
        </div>
        <div className="flex gap-3">
          <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button className="flex-1" onClick={submit} disabled={submitting || !projectId}>{submitting ? "Sending..." : "Send Invite"}</Button>
        </div>
      </div>
    </div>
  );
}

export function ClientFindProfessionals() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const [professionals, setProfessionals] = useState<ProfessionalOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteTarget, setInviteTarget] = useState<ProfessionalOut | null>(null);
  const [search, setSearch] = useState(searchParams?.get("q") || "");
  const [categoryId, setCategoryId] = useState("");
  const [location, setLocation] = useState("");
  const [minRating, setMinRating] = useState("");
  const [sortBy, setSortBy] = useState("");
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());

  const load = () => {
    setLoading(true);
    api
      .professionals({
        q: search || undefined,
        category_id: categoryId || undefined,
        location: location || undefined,
        min_rating: minRating ? Number(minRating) : undefined,
        sort_by: sortBy || undefined,
      })
      .then(setProfessionals)
      .catch(() => toast.error("Could not load professionals"))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    api.favorites().then((favs) => setSavedIds(new Set(favs.filter((f) => f.target_type === "professional").map((f) => f.target_id)))).catch(() => {});
  }, []);

  const toggleSaved = (id: string, next: boolean) => {
    setSavedIds((prev) => {
      const copy = new Set(prev);
      if (next) copy.add(id); else copy.delete(id);
      return copy;
    });
  };

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">Find Professionals</h1>
      <div className="grid sm:grid-cols-4 gap-3">
        <div className="relative sm:col-span-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder='Try "my pipes are leaking, I need a plumber"...'
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && load()}
          />
        </div>
        <select
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="">All categories</option>
          {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
        </select>
        <Input
          placeholder="Location..."
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && load()}
        />
      </div>
      <div className="grid sm:grid-cols-4 gap-3">
        <select
          value={minRating}
          onChange={(e) => setMinRating(e.target.value)}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="">Any rating</option>
          <option value="4.5">4.5+ stars</option>
          <option value="4">4+ stars</option>
          <option value="3">3+ stars</option>
        </select>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="">Sort: Relevance</option>
          <option value="rating">Highest rated</option>
          <option value="reviews">Most reviewed</option>
          <option value="price_asc">Rate: Low to High</option>
          <option value="price_desc">Rate: High to Low</option>
          <option value="newest">Newest</option>
        </select>
      </div>
      <Button onClick={load} size="sm">Apply Filters</Button>
      {loading && <ListSkeleton />}
      {!loading && professionals.length === 0 && <p className="text-sm text-muted-foreground">No professionals match your filters.</p>}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {professionals.map((t) => (
          <div key={t.id} className="relative rounded-xl border bg-background p-5 text-center hover:shadow-md transition-shadow">
            <FavoriteButton
              targetType="professional"
              targetId={t.id}
              saved={savedIds.has(t.id)}
              onToggle={(next) => toggleSaved(t.id, next)}
              className="absolute top-3 right-3"
            />
            <Link href={`/client/dashboard/find-talent/${t.id}`} className="block">
              <div className="mx-auto mb-3 h-14 w-14 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-xl">
                {t.first_name.charAt(0)}
              </div>
              <div className="flex items-center justify-center gap-1.5">
                <p className="font-semibold text-sm">{t.first_name} {t.last_name}</p>
                {t.verification_status === "verified" && <BadgeCheck className="h-3.5 w-3.5 text-emerald-600" />}
              </div>
              <p className="text-xs text-muted-foreground">{t.title}</p>
              <p className="text-xs text-muted-foreground">{t.location}</p>
              <div className="flex items-center justify-center gap-1 mt-1">
                <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                <span className="text-xs">{t.rating || "New"} ({t.review_count})</span>
              </div>
              {t.hourly_rate && <p className="text-sm font-bold text-primary mt-1">₦{t.hourly_rate}/hr</p>}
              <div className="mt-3 flex flex-wrap justify-center gap-1">
                {t.skills.slice(0, 2).map((sk) => <Badge key={sk} variant="secondary" className="text-xs rounded-full">{sk}</Badge>)}
              </div>
              {t.portfolio_items.length > 0 && (
                <p className="text-xs text-muted-foreground mt-2">{t.portfolio_items.length} portfolio item{t.portfolio_items.length === 1 ? "" : "s"}</p>
              )}
            </Link>
            <Button
              size="sm"
              variant="outline"
              className="mt-3 w-full"
              onClick={() => {
                if (user?.kyc_status !== "verified") {
                  toast.error("Please verify your identity before contacting professionals.", {
                    description: "Head to Settings to submit your NIN, it only takes a moment.",
                  });
                  return;
                }
                setInviteTarget(t);
              }}
            >
              <UserPlus className="h-3.5 w-3.5 mr-1" /> Invite
            </Button>
          </div>
        ))}
      </div>
      {inviteTarget && (
        <InviteToProjectDialog professional={inviteTarget} onClose={() => setInviteTarget(null)} />
      )}
    </div>
  );
}

export function ClientSavedProfessionals() {
  const [professionals, setProfessionals] = useState<ProfessionalOut[]>([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    api.favoriteProfessionals().then(setProfessionals).catch(() => toast.error("Could not load saved professionals")).finally(() => setLoading(false));
  };

  useEffect(load, []);

  const unsave = async (id: string) => {
    try {
      await api.removeFavorite("professional", id);
      setProfessionals((prev) => prev.filter((p) => p.id !== id));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not remove from saved");
    }
  };

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">Saved Professionals</h1>
      {loading && <ListSkeleton />}
      {!loading && professionals.length === 0 && (
        <EmptyState icon={Heart} title="No saved professionals yet" message="Tap the heart icon on a professional's card to save them here for later." />
      )}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {professionals.map((t) => (
          <div key={t.id} className="relative rounded-xl border bg-background p-5 text-center hover:shadow-md transition-shadow">
            <FavoriteButton targetType="professional" targetId={t.id} saved onToggle={() => unsave(t.id)} className="absolute top-3 right-3" />
            <Link href={`/client/dashboard/find-talent/${t.id}`} className="block">
              <div className="mx-auto mb-3 h-14 w-14 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-xl">
                {t.first_name.charAt(0)}
              </div>
              <div className="flex items-center justify-center gap-1.5">
                <p className="font-semibold text-sm">{t.first_name} {t.last_name}</p>
                {t.verification_status === "verified" && <BadgeCheck className="h-3.5 w-3.5 text-emerald-600" />}
              </div>
              <p className="text-xs text-muted-foreground">{t.title}</p>
              <p className="text-xs text-muted-foreground">{t.location}</p>
              <div className="flex items-center justify-center gap-1 mt-1">
                <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                <span className="text-xs">{t.rating || "New"} ({t.review_count})</span>
              </div>
              {t.hourly_rate && <p className="text-sm font-bold text-primary mt-1">₦{t.hourly_rate}/hr</p>}
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Full public-style profile view for a single professional, bio, skills,
 * portfolio, and their full reviews list, reached by clicking a card in
 * Find Professionals. Lets a client evaluate someone before inviting.
 */
export function ProfessionalPreview({ profileId }: { profileId: string; backHref?: string }) {
  const [pro, setPro] = useState<ProfessionalOut | null>(null);
  const [reviews, setReviews] = useState<ReviewOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);

  useEffect(() => {
    api
      .professional(profileId)
      .then((p) => {
        setPro(p);
        return api.reviewsForUser(p.user_id).then(setReviews).catch(() => {});
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [profileId]);

  if (loading) return <ListSkeleton />;
  if (!pro) return <p className="p-6 text-sm text-muted-foreground">Professional not found.</p>;

  return (
    <div className="max-w-2xl">
      <ProfessionalProfileView
        pro={pro}
        reviews={reviews}
        hireAction={
          <Button className="w-full" onClick={() => setInviteOpen(true)}>
            <UserPlus className="h-3.5 w-3.5 mr-1" /> Invite to a Project
          </Button>
        }
      />
      {inviteOpen && (
        <InviteToProjectDialog professional={pro} onClose={() => setInviteOpen(false)} />
      )}
    </div>
  );
}

export function ClientMessages() {
  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">Messages</h1>
      <MessagesPanel />
    </div>
  );
}

const TXN_TYPE_LABELS: Record<string, { label: string; sign: "+" | "-"; className: string }> = {
  topup: { label: "Wallet top-up", sign: "+", className: "text-emerald-600" },
  funding: { label: "Milestone funded", sign: "-", className: "text-foreground" },
  release: { label: "Payout released", sign: "-", className: "text-foreground" },
  refund: { label: "Refunded to wallet", sign: "+", className: "text-emerald-600" },
  withdrawal: { label: "Withdrawn to bank", sign: "-", className: "text-foreground" },
};

// ─── Fund Wallet dialog ────────────────────────────────────────────────────
function FundWalletDialog({ onClose, onFunded }: { onClose: () => void; onFunded: () => void }) {
  const [amount, setAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const quickAmounts = [50000, 100000, 250000, 500000];

  const submit = async () => {
    const n = Number(amount);
    if (!n || n <= 0) return toast.error("Enter an amount greater than zero");
    setSubmitting(true);
    try {
      await api.topupWallet(n);
      toast.success(`₦${n.toLocaleString()} added to your wallet`);
      onFunded();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not fund your wallet");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-xl border bg-background p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold flex items-center gap-2"><Wallet className="h-4 w-4" /> Fund Your Wallet</h2>
        <p className="text-sm text-muted-foreground">Top up your escrow wallet, then fund project milestones instantly from your balance, no separate checkout each time.</p>
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Amount (₦)</label>
          <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="100000" />
        </div>
        <div className="flex flex-wrap gap-2">
          {quickAmounts.map((a) => (
            <button
              key={a}
              type="button"
              onClick={() => setAmount(String(a))}
              className="text-xs rounded-full border px-2.5 py-1 hover:bg-muted transition-colors"
            >
              ₦{a.toLocaleString()}
            </button>
          ))}
        </div>
        <div className="flex gap-2 pt-1">
          <Button variant="outline" className="flex-1" onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button className="flex-1 bg-emerald-600 hover:bg-emerald-700" onClick={submit} disabled={submitting}>{submitting ? "Processing..." : "Fund Wallet"}</Button>
        </div>
      </div>
    </div>
  );
}

export function ClientPayments() {
  const { user, refreshMe } = useAuth();
  const [txs, setTxs] = useState<WalletTransactionOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [fundOpen, setFundOpen] = useState(false);

  const load = () => {
    setLoading(true);
    api.walletTransactions().then(setTxs).catch(() => toast.error("Could not load payments")).finally(() => setLoading(false));
  };
  useEffect(load, []);

  const released = txs.filter((t) => t.type === "release" && t.status === "successful").reduce((s, t) => s + t.amount, 0);
  const inEscrow = txs.filter((t) => t.type === "funding" && t.status === "successful").reduce((s, t) => s + t.amount, 0)
    - txs.filter((t) => t.type === "refund" && t.status === "successful").reduce((s, t) => s + t.amount, 0);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Payments</h1>
        <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={() => setFundOpen(true)}>
          <Wallet className="h-4 w-4 mr-1.5" /> Fund Wallet
        </Button>
      </div>

      <div className="rounded-xl border bg-gradient-to-br from-emerald-600 to-emerald-700 text-white p-6">
        <p className="text-xs text-emerald-100 uppercase tracking-wide font-medium">Wallet Balance</p>
        <p className="text-3xl font-bold mt-1">{fmtNaira(user?.wallet_balance || 0)}</p>
        <p className="text-xs text-emerald-100 mt-2">Available to fund project milestones instantly.</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <StatCard label="In Escrow" value={fmtNaira(Math.max(inEscrow, 0))} icon={Wallet} color="amber" />
        <StatCard label="Released to Professionals" value={fmtNaira(released)} icon={CheckCircle2} color="emerald" />
      </div>

      <div className="rounded-xl border bg-background">
        <div className="p-5 border-b font-semibold">Transaction History</div>
        <div className="divide-y">
          {loading && <ListSkeleton />}
          {!loading && txs.length === 0 && (
            <div className="p-6 text-center space-y-2">
              <p className="text-sm text-muted-foreground">No transactions yet.</p>
              <Button size="sm" variant="outline" onClick={() => setFundOpen(true)}>Fund your wallet to get started</Button>
            </div>
          )}
          {txs.map((t) => {
            const meta = TXN_TYPE_LABELS[t.type] || { label: t.type, sign: "+" as const, className: "text-foreground" };
            return (
              <div key={t.id} className="flex items-center justify-between p-4">
                <div>
                  <p className="text-sm font-medium">{t.note || meta.label || t.project_title}</p>
                  <p className="text-xs text-muted-foreground">{new Date(t.created_at).toLocaleDateString()} · {t.status}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`font-semibold text-sm ${meta.className}`}>
                    {meta.sign}{fmtNaira(t.amount)}
                  </span>
                  {t.status === "successful" && <ReceiptDownloadButton transactionId={t.id} />}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {fundOpen && (
        <FundWalletDialog
          onClose={() => setFundOpen(false)}
          onFunded={() => {
            setFundOpen(false);
            refreshMe();
            load();
          }}
        />
      )}
    </div>
  );
}

const KYC_STATUS_COPY: Record<string, { label: string; color: string; blurb: string }> = {
  unverified: {
    label: "Not verified",
    color: "bg-gray-100 text-gray-600",
    blurb: "Verify your identity with your NIN before you can invite, message, or hire professionals. This protects professionals from unverified contacts.",
  },
  pending: {
    label: "Pending",
    color: "bg-amber-100 text-amber-700",
    blurb: "Your verification is being processed.",
  },
  verified: {
    label: "Verified",
    color: "bg-emerald-100 text-emerald-700",
    blurb: "Your identity is verified. You can invite, message, and hire professionals.",
  },
  rejected: {
    label: "Verification failed",
    color: "bg-red-100 text-red-600",
    blurb: "We couldn't verify that NIN. Double-check the number and try again.",
  },
};

function ClientKycCard() {
  const { user, refreshMe } = useAuth();
  const [nin, setNin] = useState("");
  const [dob, setDob] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const status = user?.kyc_status || "unverified";

  useEffect(() => {
    api.myKyc().then((k) => setNote(k.kyc_note || null)).catch(() => {});
  }, []);

  const submit = async () => {
    if (nin.length !== 11 || !/^\d+$/.test(nin)) {
      toast.error("NIN must be exactly 11 digits");
      return;
    }
    if (!dob) {
      toast.error("Please enter your date of birth");
      return;
    }
    setSubmitting(true);
    try {
      const result = await api.submitKyc({ nin, dob });
      setNote(result.kyc_note || null);
      await refreshMe();
      if (result.kyc_status === "verified") {
        toast.success("Identity verified! You can now invite and message professionals.");
      } else {
        toast.error("Verification failed", { description: result.kyc_note || undefined });
      }
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not submit verification");
    } finally {
      setSubmitting(false);
    }
  };

  const copy = KYC_STATUS_COPY[status] || KYC_STATUS_COPY.unverified;

  return (
    <div className="rounded-xl border bg-background p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Identity Verification (KYC)</h2>
        <Badge className={`text-xs rounded-full ${copy.color}`}>{copy.label}</Badge>
      </div>
      <p className="text-xs text-muted-foreground">{copy.blurb}</p>
      {status === "rejected" && note && (
        <p className="text-xs text-red-600 bg-red-50 rounded-md p-2">{note}</p>
      )}
      {status !== "verified" && (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-sm">National Identification Number (NIN)</label>
            <Input
              value={nin}
              onChange={(e) => setNin(e.target.value.replace(/\D/g, "").slice(0, 11))}
              placeholder="11-digit NIN"
              maxLength={11}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm">Date of Birth</label>
            <Input type="date" value={dob} onChange={(e) => setDob(e.target.value)} />
            <p className="text-xs text-muted-foreground">Must match what&apos;s on file with NIMC for your NIN.</p>
          </div>
          <Button size="sm" onClick={submit} disabled={submitting}>
            {submitting ? "Verifying..." : "Verify Identity"}
          </Button>
        </div>
      )}
    </div>
  );
}

function ClientProfileTab() {
  const { user, refreshMe } = useAuth();
  const [firstName, setFirstName] = useState(user?.first_name || "");
  const [lastName, setLastName] = useState(user?.last_name || "");
  const [phone, setPhone] = useState(user?.phone || "");
  const [avatarUrl, setAvatarUrl] = useState(user?.avatar_url || "");
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const uploadAvatar = async (file: File) => {
    setUploadingAvatar(true);
    try {
      const { url } = await api.uploadFile(file);
      setAvatarUrl(url);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not upload photo");
    } finally {
      setUploadingAvatar(false);
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      await api.updateClientProfile({ first_name: firstName, last_name: lastName, phone, avatar_url: avatarUrl });
      await refreshMe();
      toast.success("Profile saved");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not save profile");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-xl border bg-background p-6 space-y-4">
      <h2 className="font-semibold">Profile Information</h2>
      <div className="space-y-1.5">
        <label className="text-sm">Profile Photo</label>
        <div className="flex items-center gap-3">
          <UserAvatar avatarUrl={avatarUrl} name={`${firstName} ${lastName}`.trim() || "?"} className="h-14 w-14" />
          <input
            type="file"
            accept="image/*"
            onChange={(e) => e.target.files?.[0] && uploadAvatar(e.target.files[0])}
            className="text-xs"
            disabled={uploadingAvatar}
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5"><label className="text-sm">First Name</label><Input value={firstName} onChange={(e) => setFirstName(e.target.value)} /></div>
        <div className="space-y-1.5"><label className="text-sm">Last Name</label><Input value={lastName} onChange={(e) => setLastName(e.target.value)} /></div>
      </div>
      <div className="space-y-1.5"><label className="text-sm">Email</label><Input defaultValue={user?.email} disabled /></div>
      <div className="space-y-1.5"><label className="text-sm">Phone</label><Input value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
      <Button onClick={save} disabled={saving}>{saving ? "Saving..." : "Save Changes"}</Button>
    </div>
  );
}

function ClientCompanyTab() {
  const { user, refreshMe } = useAuth();
  const [companyName, setCompanyName] = useState(user?.company_name || "");
  const [companyDescription, setCompanyDescription] = useState(user?.company_description || "");
  const [companyWebsite, setCompanyWebsite] = useState(user?.company_website || "");
  const [logoUrl, setLogoUrl] = useState(user?.company_logo_url || "");
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  const uploadLogo = async (file: File) => {
    setUploadingLogo(true);
    try {
      const { url } = await api.uploadFile(file);
      setLogoUrl(url);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not upload logo");
    } finally {
      setUploadingLogo(false);
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      await api.updateClientProfile({
        company_name: companyName,
        company_description: companyDescription,
        company_website: companyWebsite,
        company_logo_url: logoUrl,
      });
      await refreshMe();
      toast.success("Company profile saved");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not save company profile");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-xl border bg-background p-6 space-y-4">
      <div className="flex items-center gap-2">
        <Building2 className="h-4 w-4 text-muted-foreground" />
        <h2 className="font-semibold">Company Profile</h2>
        {user?.is_verified_business && <Badge className="text-xs rounded-full bg-emerald-100 text-emerald-700">Verified Business</Badge>}
      </div>
      <p className="text-xs text-muted-foreground">Shown to professionals when they view your projects.</p>
      <div className="space-y-1.5"><label className="text-sm">Company Name</label><Input value={companyName} onChange={(e) => setCompanyName(e.target.value)} /></div>
      <div className="space-y-1.5">
        <label className="text-sm">Logo</label>
        <div className="flex items-center gap-3">
          {logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="Company logo" className="h-12 w-12 rounded-lg object-cover border" />
          )}
          <input
            type="file"
            accept="image/*"
            onChange={(e) => e.target.files?.[0] && uploadLogo(e.target.files[0])}
            className="text-xs"
            disabled={uploadingLogo}
          />
        </div>
      </div>
      <div className="space-y-1.5"><label className="text-sm">Website</label><Input value={companyWebsite} onChange={(e) => setCompanyWebsite(e.target.value)} placeholder="https://" /></div>
      <div className="space-y-1.5">
        <label className="text-sm">Description</label>
        <textarea
          rows={3}
          value={companyDescription}
          onChange={(e) => setCompanyDescription(e.target.value)}
          className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none"
          placeholder="What does your company do?"
        />
      </div>
      <Button onClick={save} disabled={saving}>{saving ? "Saving..." : "Save Changes"}</Button>
    </div>
  );
}

function ClientPreferencesTab() {
  const { user, refreshMe } = useAuth();
  const [preferredCategories, setPreferredCategories] = useState<string[]>(user?.preferred_categories || []);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await api.updateClientProfile({ preferred_categories: preferredCategories });
      await refreshMe();
      toast.success("Preferences saved");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not save preferences");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-xl border bg-background p-6 space-y-3">
      <h2 className="font-semibold">Preferred Categories</h2>
      <p className="text-xs text-muted-foreground">Optional. Select the kind of work you typically hire for, this shows on your profile.</p>
      <div className="grid grid-cols-2 gap-2">
        {CATEGORIES.map((c) => (
          <label key={c.id} className={`flex items-center gap-2 rounded-lg border p-3 cursor-pointer transition-colors ${preferredCategories.includes(c.id) ? "border-primary bg-primary/5" : "hover:bg-muted/50"}`}>
            <Checkbox
              checked={preferredCategories.includes(c.id)}
              onCheckedChange={(v) => setPreferredCategories((prev) => v ? [...prev, c.id] : prev.filter((x) => x !== c.id))}
            />
            <span className="text-xs">{c.label}</span>
          </label>
        ))}
      </div>
      <Button onClick={save} disabled={saving}>{saving ? "Saving..." : "Save Changes"}</Button>
    </div>
  );
}

export function ClientSettings() {
  const [tab, setTab] = useState<"profile" | "company" | "preferences" | "verification" | "security">("profile");

  return (
    <div className="space-y-5 max-w-lg">
      <h1 className="text-2xl font-bold">Account Settings</h1>
      <div className="flex gap-2 flex-wrap">
        <SettingsTabButton active={tab === "profile"} onClick={() => setTab("profile")}>Profile</SettingsTabButton>
        <SettingsTabButton active={tab === "company"} onClick={() => setTab("company")}>Company</SettingsTabButton>
        <SettingsTabButton active={tab === "preferences"} onClick={() => setTab("preferences")}>Preferences</SettingsTabButton>
        <SettingsTabButton active={tab === "verification"} onClick={() => setTab("verification")}>Verification</SettingsTabButton>
        <SettingsTabButton active={tab === "security"} onClick={() => setTab("security")}>Security</SettingsTabButton>
      </div>

      {tab === "profile" && <ClientProfileTab />}
      {tab === "company" && <ClientCompanyTab />}
      {tab === "preferences" && <ClientPreferencesTab />}
      {tab === "verification" && <ClientKycCard />}
      {tab === "security" && <SecurityPanel />}
    </div>
  );
}

function fmtMemberSince(d: string) {
  return new Date(d).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

// ─── Client's own profile: the same trust signals a professional would see ───
export function ClientProfile() {
  const { user } = useAuth();
  const [pub, setPub] = useState<ClientPublicOut | null>(null);
  const [reviews, setReviews] = useState<ReviewOut[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    api.getClientPublic(user.id)
      .then((p) => {
        setPub(p);
        return api.reviewsForUser(user.id).then(setReviews).catch(() => {});
      })
      .catch(() => toast.error("Could not load profile"))
      .finally(() => setLoading(false));
  }, [user]);

  if (loading) return <ListSkeleton />;
  if (!user || !pub) return <p className="text-sm text-muted-foreground">No profile found.</p>;

  const preferredLabels = (pub.preferred_categories || [])
    .map((id) => CATEGORIES.find((c) => c.id === id)?.label)
    .filter((l): l is string => Boolean(l));

  return (
    <div className="space-y-5 max-w-2xl">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">My Profile</h1>
        <Button variant="outline" size="sm" asChild>
          <Link href="/client/dashboard/settings">Edit in Settings</Link>
        </Button>
      </div>

      <div className="rounded-xl border bg-background p-6 space-y-5">
        <div className="flex items-start gap-4">
          {pub.company_logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={pub.company_logo_url} alt={pub.company_name || "Company logo"} className="h-16 w-16 rounded-full object-cover border" />
          ) : (
            <UserAvatar avatarUrl={user.avatar_url} name={`${pub.first_name} ${pub.last_name}`} className="h-16 w-16" />
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <p className="font-bold text-lg">{pub.first_name} {pub.last_name}</p>
              {pub.is_verified_business && (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-100 rounded-full px-2 py-0.5">
                  <BadgeCheck className="h-3 w-3" /> Verified Business
                </span>
              )}
            </div>
            {pub.company_name ? (
              <p className="text-sm text-muted-foreground flex items-center gap-1"><Building2 className="h-3.5 w-3.5" /> {pub.company_name}{pub.industry ? ` · ${pub.industry}` : ""}</p>
            ) : (
              <p className="text-sm text-muted-foreground">Individual client</p>
            )}
            {pub.company_website && (
              <a href={pub.company_website} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline flex items-center gap-1 mt-0.5">
                <Globe className="h-3 w-3" /> {pub.company_website}
              </a>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-lg border bg-muted/30 p-3 text-center">
            <p className="text-lg font-bold flex items-center justify-center gap-1">
              {pub.hire_rate !== null && pub.hire_rate !== undefined ? (
                <><TrendingUp className="h-3.5 w-3.5 text-emerald-600" /> {pub.hire_rate}%</>
              ) : "New"}
            </p>
            <p className="text-xs text-muted-foreground">Hire rate</p>
          </div>
          <div className="rounded-lg border bg-muted/30 p-3 text-center">
            <p className="text-lg font-bold">{pub.completed_project_count}</p>
            <p className="text-xs text-muted-foreground">Completed projects</p>
          </div>
          <div className="rounded-lg border bg-muted/30 p-3 text-center">
            <p className="text-lg font-bold">{pub.open_project_count}</p>
            <p className="text-xs text-muted-foreground">Open jobs</p>
          </div>
          <div className="rounded-lg border bg-muted/30 p-3 text-center">
            <p className="text-xs font-semibold flex items-center justify-center gap-1"><Calendar className="h-3 w-3" /> {fmtMemberSince(pub.member_since)}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Member since</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-3 text-xs">
          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 ${pub.kyc_verified ? "text-emerald-700 bg-emerald-100" : "text-muted-foreground bg-muted"}`}>
            <ShieldCheck className="h-3.5 w-3.5" /> {pub.kyc_verified ? "Identity verified" : "Identity not verified"}
          </span>
          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 ${user.email_verified ? "text-emerald-700 bg-emerald-100" : "text-muted-foreground bg-muted"}`}>
            <Mail className="h-3.5 w-3.5" /> {user.email_verified ? "Email verified" : "Email not verified"}
          </span>
          {user.phone && (
            <span className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-muted-foreground bg-muted">
              <MapPin className="h-3.5 w-3.5" /> {user.phone}
            </span>
          )}
        </div>

        {pub.company_description && (
          <div>
            <h2 className="text-sm font-semibold mb-1">About</h2>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{pub.company_description}</p>
          </div>
        )}

        {preferredLabels.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold mb-2">Typically Hires For</h2>
            <div className="flex flex-wrap gap-1.5">
              {preferredLabels.map((l) => <Badge key={l} variant="secondary" className="text-xs rounded-full">{l}</Badge>)}
            </div>
          </div>
        )}
      </div>

      <div className="rounded-xl border bg-background p-6 space-y-3">
        <h2 className="text-sm font-semibold">Reviews from Professionals ({reviews.length})</h2>
        {reviews.length === 0 && <p className="text-sm text-muted-foreground">No reviews yet. Professionals you've worked with can leave a review once a project completes.</p>}
        {reviews.map((r) => <ReviewCard key={r.id} review={r} />)}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TALENT DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════════
const PROP_STATUS_COLORS = BID_STATUS_COLORS;

export function TalentOverview() {
  const { user } = useAuth();
  const [projects, setProjects] = useState<ProjectOut[]>([]);
  const [bids, setBids] = useState<BidOut[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.myProjects(), api.myBids()])
      .then(([p, b]) => {
        setProjects(p);
        setBids(b);
      })
      .catch(() => toast.error("Could not load dashboard data"))
      .finally(() => setLoading(false));
  }, []);

  const activeJobs = projects.filter((p) => p.status === "in_progress");

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border bg-gradient-to-br from-primary to-primary/80 text-primary-foreground p-6 md:p-7 flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">Welcome back{user ? `, ${user.first_name}` : ""} <span className="inline-block">👋</span></h1>
          <p className="text-primary-foreground/80 text-sm mt-1">Your professional dashboard at a glance.</p>
        </div>
        <Link href="/talent/dashboard/find-work">
          <Button size="sm" className="bg-background text-foreground hover:bg-background/90 shrink-0">
            <Search className="h-3.5 w-3.5 mr-1" /> Find Work
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Active Jobs" value={String(activeJobs.length)} icon={Briefcase} color="emerald" />
        <StatCard label="Proposals Sent" value={String(bids.length)} icon={FileText} color="blue" />
        <StatCard label="Accepted" value={String(bids.filter((b) => b.status === "accepted").length)} icon={CheckCircle2} color="amber" />
        <StatCard label="Pending" value={String(bids.filter((b) => b.status === "pending").length)} icon={Clock} />
      </div>

      <div className="rounded-xl border bg-background">
        <div className="flex items-center justify-between p-5 border-b">
          <h2 className="font-semibold">Active Jobs</h2>
          {activeJobs.length > 0 && (
            <Link href="/talent/dashboard/active" className="text-xs text-primary hover:underline flex items-center gap-0.5">
              View all <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          )}
        </div>
        <div className="divide-y">
          {loading && <ListSkeleton />}
          {!loading && activeJobs.length === 0 && (
            <div className="p-2">
              <EmptyState
                icon={Briefcase}
                title="No active jobs yet"
                message="Browse Find Work to submit proposals and land your next job."
                action={
                  <Link href="/talent/dashboard/find-work">
                    <Button size="sm"><Search className="h-3.5 w-3.5 mr-1" /> Find Work</Button>
                  </Link>
                }
              />
            </div>
          )}
          {activeJobs.map((j) => (
            <Link
              key={j.id}
              href={`/talent/dashboard/active/${j.id}`}
              className="flex items-center gap-4 p-4 hover:bg-muted/40 transition-colors group"
            >
              <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <Briefcase className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate group-hover:text-primary transition-colors">{j.title}</p>
                <p className="text-xs text-muted-foreground">{j.category.label}</p>
                <div className="mt-2 flex items-center gap-2">
                  <div className="flex-1 h-1.5 rounded-full bg-muted">
                    <div className="h-1.5 rounded-full bg-emerald-500" style={{ width: `${j.progress}%` }} />
                  </div>
                  <span className="text-xs text-muted-foreground">{j.progress}%</span>
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-semibold">{fmtNaira(j.budget_min)} – {fmtNaira(j.budget_max)}</p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 hidden sm:block" />
            </Link>
          ))}
        </div>
      </div>

      <div className="rounded-xl border bg-background">
        <div className="flex items-center justify-between p-5 border-b">
          <h2 className="font-semibold">Recent Proposals</h2>
          {bids.length > 0 && (
            <Link href="/talent/dashboard/proposals" className="text-xs text-primary hover:underline flex items-center gap-0.5">
              View all <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          )}
        </div>
        <div className="divide-y">
          {loading && <ListSkeleton />}
          {!loading && bids.length === 0 && (
            <div className="p-2">
              <EmptyState
                icon={FileText}
                title="No proposals yet"
                message="Apply to open projects on Find Work to send your first proposal."
              />
            </div>
          )}
          {bids.slice(0, 5).map((b) => (
            <Link
              key={b.id}
              href={`/talent/dashboard/find-work/${b.project_id}`}
              className="flex items-center justify-between gap-4 p-4 hover:bg-muted/40 transition-colors group"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">{b.project_title}</p>
                <p className="text-xs text-muted-foreground">Submitted {new Date(b.created_at).toLocaleDateString()}</p>
              </div>
              <div className="flex flex-col items-end gap-1 shrink-0">
                <Badge className={`text-xs rounded-full ${PROP_STATUS_COLORS[b.status]}`}>{b.status}</Badge>
                <span className="text-xs font-medium">{fmtNaira(b.amount)}</span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

export function ApplyDialog({ project, onClose, onApplied }: { project: ProjectOut; onClose: () => void; onApplied: () => void }) {
  const [amount, setAmount] = useState("");
  const [coverLetter, setCoverLetter] = useState("");
  const [estimatedDays, setEstimatedDays] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount) return toast.error("Please enter your proposed amount");
    setSubmitting(true);
    try {
      await api.createBid(project.id, {
        amount: Number(amount),
        cover_letter: coverLetter || undefined,
        estimated_days: estimatedDays ? Number(estimatedDays) : undefined,
      });
      toast.success("Proposal submitted!");
      onApplied();
      onClose();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not submit proposal");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4">
      <div className="w-full sm:max-w-md max-h-[90vh] overflow-y-auto bg-background rounded-t-2xl sm:rounded-2xl border shadow-lg p-6">
        <h2 className="text-lg font-bold mb-1">Submit Proposal</h2>
        <p className="text-sm text-muted-foreground mb-4">{project.title}</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Your Proposed Amount (₦) *</label>
            <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="900000" />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Estimated Days</label>
            <Input type="number" value={estimatedDays} onChange={(e) => setEstimatedDays(e.target.value)} placeholder="21" />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Cover Letter</label>
            <textarea
              rows={4}
              value={coverLetter}
              onChange={(e) => setCoverLetter(e.target.value)}
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none"
              placeholder="Explain your approach, relevant experience, and timeline..."
            />
          </div>
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
            <Button type="submit" className="flex-1 bg-emerald-600 hover:bg-emerald-700" disabled={submitting}>
              {submitting ? "Submitting..." : "Submit Proposal"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function TalentFindWork() {
  const searchParams = useSearchParams();
  const [projects, setProjects] = useState<ProjectOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [applyTarget, setApplyTarget] = useState<ProjectOut | null>(null);
  const [search, setSearch] = useState(searchParams?.get("q") || "");
  const [categoryId, setCategoryId] = useState("");
  const [location, setLocation] = useState("");
  const [budgetMin, setBudgetMin] = useState("");
  const [budgetMax, setBudgetMax] = useState("");
  const [sortBy, setSortBy] = useState("");
  const [myBids, setMyBids] = useState<Record<string, BidStatus>>({});
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    api.favorites().then((favs) => setSavedIds(new Set(favs.filter((f) => f.target_type === "project").map((f) => f.target_id)))).catch(() => {});
  }, []);

  const toggleSaved = (id: string, next: boolean) => {
    setSavedIds((prev) => {
      const copy = new Set(prev);
      if (next) copy.add(id); else copy.delete(id);
      return copy;
    });
  };

  const loadMyBids = () => {
    api.myBids().then((bids) => {
      const map: Record<string, BidStatus> = {};
      bids.forEach((b) => { map[b.project_id] = b.status; });
      setMyBids(map);
    }).catch(() => {});
  };

  const load = () => {
    setLoading(true);
    api
      .projects({
        q: search || undefined,
        category_id: categoryId || undefined,
        location: location || undefined,
        budget_min: budgetMin ? Number(budgetMin) : undefined,
        budget_max: budgetMax ? Number(budgetMax) : undefined,
        sort_by: sortBy || undefined,
      })
      .then(setProjects)
      .catch(() => toast.error("Could not load projects"))
      .finally(() => setLoading(false));
    loadMyBids();
  };

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">Find Work</h1>
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder='Try "I want tiling jobs" or "leaking pipe repair"...'
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && load()}
          />
        </div>
        <div className="grid sm:grid-cols-4 gap-3">
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">All categories</option>
            {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
          <Input
            placeholder="Location..."
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && load()}
          />
          <Input
            type="number"
            placeholder="Min budget (₦)"
            value={budgetMin}
            onChange={(e) => setBudgetMin(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && load()}
          />
          <Input
            type="number"
            placeholder="Max budget (₦)"
            value={budgetMax}
            onChange={(e) => setBudgetMax(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && load()}
          />
        </div>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          className="flex h-10 w-full sm:w-56 rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="">Sort: Newest</option>
          <option value="budget_asc">Budget: Low to High</option>
          <option value="budget_desc">Budget: High to Low</option>
          <option value="most_bids">Most Proposals</option>
        </select>
        <Button onClick={load} size="sm">Apply Filters</Button>
      </div>
      {loading && <ListSkeleton />}
      {!loading && projects.length === 0 && <p className="text-sm text-muted-foreground">No open projects match your search.</p>}
      <div className="grid md:grid-cols-3 gap-4">
        {projects.map((proj) => (
          <div key={proj.id} className="relative rounded-xl border bg-background p-5 hover:shadow-md transition-shadow">
            <FavoriteButton
              targetType="project"
              targetId={proj.id}
              saved={savedIds.has(proj.id)}
              onToggle={(next) => toggleSaved(proj.id, next)}
              className="absolute top-3 right-3"
            />
            <Link href={`/talent/dashboard/find-work/${proj.id}`} className="block">
              <Badge variant="outline" className="text-xs rounded-full mb-2 mr-8">{proj.category.label}</Badge>
              <h3 className="font-semibold text-sm">{proj.title}</h3>
              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{proj.description}</p>
              {proj.client_company_name && (
                <div className="flex items-center gap-1 mt-2">
                  <p className="text-xs text-muted-foreground">{proj.client_company_name}</p>
                  {proj.client_is_verified_business && <BadgeCheck className="h-3 w-3 text-emerald-600" />}
                  {proj.client_completed_project_count > 0 && (
                    <span className="text-xs text-muted-foreground">· {proj.client_completed_project_count} completed</span>
                  )}
                </div>
              )}
              <div className="mt-3 flex flex-wrap gap-1">
                {proj.skills.slice(0, 3).map((sk) => <Badge key={sk} variant="secondary" className="text-xs rounded-full">{sk}</Badge>)}
              </div>
            </Link>
            <div className="mt-4 flex items-center justify-between">
              <span className="text-sm font-semibold text-emerald-600">
                {fmtNaira(proj.budget_min)} – {fmtNaira(proj.budget_max)}
              </span>
              {myBids[proj.id] ? (
                <Badge className={`text-xs rounded-full ${BID_STATUS_COLORS[myBids[proj.id]]}`}>
                  {BID_STATUS_LABELS[myBids[proj.id]]}
                </Badge>
              ) : (
                <Button size="sm" className="rounded-full bg-emerald-600 hover:bg-emerald-700" onClick={() => setApplyTarget(proj)}>
                  Apply
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
      {applyTarget && (
        <ApplyDialog project={applyTarget} onClose={() => setApplyTarget(null)} onApplied={load} />
      )}
    </div>
  );
}

export function TalentSavedProjects() {
  const [projects, setProjects] = useState<ProjectOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [myBids, setMyBids] = useState<Record<string, BidStatus>>({});
  const [applyTarget, setApplyTarget] = useState<ProjectOut | null>(null);

  const load = () => {
    setLoading(true);
    api.favoriteProjects().then(setProjects).catch(() => toast.error("Could not load saved projects")).finally(() => setLoading(false));
    api.myBids().then((bids) => {
      const map: Record<string, BidStatus> = {};
      bids.forEach((b) => { map[b.project_id] = b.status; });
      setMyBids(map);
    }).catch(() => {});
  };

  useEffect(load, []);

  const unsave = async (id: string) => {
    try {
      await api.removeFavorite("project", id);
      setProjects((prev) => prev.filter((p) => p.id !== id));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not remove from saved");
    }
  };

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">Saved Projects</h1>
      {loading && <ListSkeleton />}
      {!loading && projects.length === 0 && (
        <EmptyState icon={Heart} title="No saved projects yet" message="Tap the heart icon on a project card to save it here for later." />
      )}
      <div className="grid md:grid-cols-3 gap-4">
        {projects.map((proj) => (
          <div key={proj.id} className="relative rounded-xl border bg-background p-5 hover:shadow-md transition-shadow">
            <FavoriteButton targetType="project" targetId={proj.id} saved onToggle={() => unsave(proj.id)} className="absolute top-3 right-3" />
            <Link href={`/talent/dashboard/find-work/${proj.id}`} className="block">
              <Badge variant="outline" className="text-xs rounded-full mb-2 mr-8">{proj.category.label}</Badge>
              <h3 className="font-semibold text-sm">{proj.title}</h3>
              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{proj.description}</p>
              <div className="mt-3 flex flex-wrap gap-1">
                {proj.skills.slice(0, 3).map((sk) => <Badge key={sk} variant="secondary" className="text-xs rounded-full">{sk}</Badge>)}
              </div>
            </Link>
            <div className="mt-4 flex items-center justify-between">
              <span className="text-sm font-semibold text-emerald-600">
                {fmtNaira(proj.budget_min)} – {fmtNaira(proj.budget_max)}
              </span>
              {myBids[proj.id] ? (
                <Badge className={`text-xs rounded-full ${BID_STATUS_COLORS[myBids[proj.id]]}`}>
                  {BID_STATUS_LABELS[myBids[proj.id]]}
                </Badge>
              ) : (
                <Button size="sm" className="rounded-full bg-emerald-600 hover:bg-emerald-700" onClick={() => setApplyTarget(proj)}>
                  Apply
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
      {applyTarget && (
        <ApplyDialog project={applyTarget} onClose={() => setApplyTarget(null)} onApplied={load} />
      )}
    </div>
  );
}

function WithdrawDialog({ balance, onClose, onWithdrawn }: { balance: number; onClose: () => void; onWithdrawn: () => void }) {
  const [amount, setAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    const n = Number(amount);
    if (!n || n <= 0) return toast.error("Enter an amount greater than zero");
    if (n > balance) return toast.error("Amount exceeds your available balance");
    setSubmitting(true);
    try {
      await api.withdrawWallet(n);
      toast.success(`₦${n.toLocaleString()} withdrawal on its way to your bank account`);
      onWithdrawn();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not process your withdrawal");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-xl border bg-background p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold flex items-center gap-2"><Wallet className="h-4 w-4" /> Withdraw to Bank</h2>
        <p className="text-sm text-muted-foreground">Available balance: <span className="font-semibold text-foreground">{fmtNaira(balance)}</span></p>
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Amount (₦)</label>
          <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="50000" />
        </div>
        <button type="button" onClick={() => setAmount(String(balance))} className="text-xs rounded-full border px-2.5 py-1 hover:bg-muted transition-colors">
          Withdraw all ({fmtNaira(balance)})
        </button>
        <div className="flex gap-2 pt-1">
          <Button variant="outline" className="flex-1" onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button className="flex-1 bg-emerald-600 hover:bg-emerald-700" onClick={submit} disabled={submitting || balance <= 0}>{submitting ? "Processing..." : "Withdraw"}</Button>
        </div>
      </div>
    </div>
  );
}

export function TalentEarnings() {
  const { user, refreshMe } = useAuth();
  const [txs, setTxs] = useState<WalletTransactionOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [withdrawOpen, setWithdrawOpen] = useState(false);

  const load = () => {
    setLoading(true);
    api.walletTransactions().then(setTxs).catch(() => toast.error("Could not load earnings")).finally(() => setLoading(false));
  };
  useEffect(load, []);

  const paid = txs.filter((t) => t.type === "release" && t.status === "successful").reduce((s, t) => s + t.amount, 0);
  const withdrawn = txs.filter((t) => t.type === "withdrawal" && t.status === "successful").reduce((s, t) => s + t.amount, 0);
  const balance = user?.wallet_balance || 0;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Earnings</h1>
        <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={() => setWithdrawOpen(true)}>
          <Wallet className="h-4 w-4 mr-1.5" /> Withdraw
        </Button>
      </div>

      <div className="rounded-xl border bg-gradient-to-br from-emerald-600 to-emerald-700 text-white p-6">
        <p className="text-xs text-emerald-100 uppercase tracking-wide font-medium">Wallet Balance</p>
        <p className="text-3xl font-bold mt-1">{fmtNaira(balance)}</p>
        <p className="text-xs text-emerald-100 mt-2">Available to withdraw to your bank account anytime.</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Total Earned" value={fmtNaira(paid)} icon={TrendingUp} color="emerald" />
        <StatCard label="Withdrawn" value={fmtNaira(withdrawn)} icon={CheckCircle2} />
        <StatCard label="Payouts" value={String(txs.filter((t) => t.type === "release").length)} icon={Clock} />
      </div>
      <div className="rounded-xl border bg-background">
        <div className="p-5 border-b font-semibold">Transaction History</div>
        <div className="divide-y">
          {loading && <ListSkeleton />}
          {!loading && txs.length === 0 && <p className="p-4 text-sm text-muted-foreground">No earnings yet.</p>}
          {txs.map((r) => {
            const isCredit = r.type === "release";
            return (
              <div key={r.id} className="flex items-center justify-between p-4">
                <div>
                  <p className="text-sm font-medium">{r.note || (isCredit ? r.project_title : TXN_TYPE_LABELS[r.type]?.label) || TXN_TYPE_LABELS[r.type]?.label}</p>
                  <p className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <div className="flex items-center gap-2">
                    <span className={`font-semibold text-sm ${r.status !== "successful" ? "text-amber-600" : isCredit ? "text-emerald-600" : "text-foreground"}`}>
                      {isCredit ? "+" : "-"}{fmtNaira(r.amount)}
                    </span>
                    {r.status === "successful" && <ReceiptDownloadButton transactionId={r.id} />}
                  </div>
                  {r.platform_fee > 0 && <span className="text-[11px] text-muted-foreground">₦{r.platform_fee.toLocaleString("en-NG")} platform fee deducted</span>}
                  <Badge className={`text-xs rounded-full ${r.status === "successful" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>{r.status}</Badge>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {withdrawOpen && (
        <WithdrawDialog
          balance={balance}
          onClose={() => setWithdrawOpen(false)}
          onWithdrawn={() => {
            setWithdrawOpen(false);
            refreshMe();
            load();
          }}
        />
      )}
    </div>
  );
}

const VERIFICATION_LABELS: Record<string, { label: string; className: string }> = {
  unverified: { label: "Not Verified", className: "bg-gray-100 text-gray-600" },
  pending: { label: "Verification Pending", className: "bg-amber-100 text-amber-700" },
  verified: { label: "Verified", className: "bg-emerald-100 text-emerald-700" },
  rejected: { label: "Verification Rejected", className: "bg-red-100 text-red-600" },
};

function AddPortfolioItemForm({ onAdded }: { onAdded: () => void }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!title) return toast.error("Title is required");
    setSubmitting(true);
    try {
      const uploaded = await Promise.all(files.map((f) => api.uploadFile(f)));
      await api.addPortfolioItem({ title, description: description || undefined, image_urls: uploaded.map((u) => u.url) });
      toast.success("Portfolio item added");
      setTitle(""); setDescription(""); setFiles([]); setOpen(false);
      onAdded();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not add portfolio item");
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return <Button size="sm" variant="outline" onClick={() => setOpen(true)}><Plus className="h-3.5 w-3.5 mr-1" /> Add Project</Button>;

  return (
    <div className="rounded-lg border p-3 space-y-2 bg-muted/20">
      <Input placeholder="Project title" value={title} onChange={(e) => setTitle(e.target.value)} />
      <textarea rows={2} placeholder="Brief description" value={description} onChange={(e) => setDescription(e.target.value)} className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none" />
      <input type="file" accept="image/*" multiple onChange={(e) => setFiles(Array.from(e.target.files || []))} className="text-xs" />
      <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
        <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={submit} disabled={submitting}>{submitting ? "Adding..." : "Add"}</Button>
      </div>
    </div>
  );
}

// ─── Employment history editor ────────────────────────────────────────────
function AddEmploymentForm({ onAdded }: { onAdded: () => void }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [employer, setEmployer] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [current, setCurrent] = useState(false);
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!title || !employer || !startDate) return toast.error("Title, employer, and start date are required");
    setSubmitting(true);
    try {
      await api.addEmployment({ title, employer, start_date: startDate, end_date: current ? undefined : (endDate || undefined), description: description || undefined });
      toast.success("Employment history added");
      setTitle(""); setEmployer(""); setStartDate(""); setEndDate(""); setCurrent(false); setDescription(""); setOpen(false);
      onAdded();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not add employment history");
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return <Button size="sm" variant="outline" onClick={() => setOpen(true)}><Plus className="h-3.5 w-3.5 mr-1" /> Add Job</Button>;

  return (
    <div className="rounded-lg border p-3 space-y-2 bg-muted/20">
      <Input placeholder="Job title (e.g. Site Engineer)" value={title} onChange={(e) => setTitle(e.target.value)} />
      <Input placeholder="Employer" value={employer} onChange={(e) => setEmployer(e.target.value)} />
      <div className="grid grid-cols-2 gap-2">
        <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} disabled={current} />
      </div>
      <label className="flex items-center gap-2 text-xs text-muted-foreground">
        <Checkbox checked={current} onCheckedChange={(v) => setCurrent(!!v)} /> I currently work here
      </label>
      <textarea rows={2} placeholder="What did you do there? (optional)" value={description} onChange={(e) => setDescription(e.target.value)} className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none" />
      <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
        <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={submit} disabled={submitting}>{submitting ? "Adding..." : "Add"}</Button>
      </div>
    </div>
  );
}

// ─── Education editor ──────────────────────────────────────────────────────
function AddEducationForm({ onAdded }: { onAdded: () => void }) {
  const [open, setOpen] = useState(false);
  const [school, setSchool] = useState("");
  const [degree, setDegree] = useState("");
  const [field, setField] = useState("");
  const [startYear, setStartYear] = useState("");
  const [endYear, setEndYear] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!school) return toast.error("School is required");
    setSubmitting(true);
    try {
      await api.addEducation({
        school,
        degree: degree || undefined,
        field_of_study: field || undefined,
        start_year: startYear ? Number(startYear) : undefined,
        end_year: endYear ? Number(endYear) : undefined,
      });
      toast.success("Education added");
      setSchool(""); setDegree(""); setField(""); setStartYear(""); setEndYear(""); setOpen(false);
      onAdded();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not add education");
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return <Button size="sm" variant="outline" onClick={() => setOpen(true)}><Plus className="h-3.5 w-3.5 mr-1" /> Add Education</Button>;

  return (
    <div className="rounded-lg border p-3 space-y-2 bg-muted/20">
      <Input placeholder="School / University" value={school} onChange={(e) => setSchool(e.target.value)} />
      <div className="grid grid-cols-2 gap-2">
        <Input placeholder="Degree (e.g. B.Sc.)" value={degree} onChange={(e) => setDegree(e.target.value)} />
        <Input placeholder="Field of study" value={field} onChange={(e) => setField(e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Input type="number" placeholder="Start year" value={startYear} onChange={(e) => setStartYear(e.target.value)} />
        <Input type="number" placeholder="End year" value={endYear} onChange={(e) => setEndYear(e.target.value)} />
      </div>
      <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
        <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={submit} disabled={submitting}>{submitting ? "Adding..." : "Add"}</Button>
      </div>
    </div>
  );
}

// ─── Certification editor ──────────────────────────────────────────────────
function AddCertificationForm({ onAdded }: { onAdded: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [issuingBody, setIssuingBody] = useState("");
  const [issuedDate, setIssuedDate] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!name) return toast.error("Certification name is required");
    setSubmitting(true);
    try {
      await api.addCertification({
        name,
        issuing_body: issuingBody || undefined,
        issued_date: issuedDate || undefined,
        expiry_date: expiryDate || undefined,
      });
      toast.success("Certification added");
      setName(""); setIssuingBody(""); setIssuedDate(""); setExpiryDate(""); setOpen(false);
      onAdded();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not add certification");
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return <Button size="sm" variant="outline" onClick={() => setOpen(true)}><Plus className="h-3.5 w-3.5 mr-1" /> Add Certification</Button>;

  return (
    <div className="rounded-lg border p-3 space-y-2 bg-muted/20">
      <Input placeholder="Certification name (e.g. COREN Registration)" value={name} onChange={(e) => setName(e.target.value)} />
      <Input placeholder="Issuing body" value={issuingBody} onChange={(e) => setIssuingBody(e.target.value)} />
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1"><label className="text-xs text-muted-foreground">Issued</label><Input type="date" value={issuedDate} onChange={(e) => setIssuedDate(e.target.value)} /></div>
        <div className="space-y-1"><label className="text-xs text-muted-foreground">Expires</label><Input type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} /></div>
      </div>
      <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
        <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={submit} disabled={submitting}>{submitting ? "Adding..." : "Add"}</Button>
      </div>
    </div>
  );
}

// ─── Languages editor (stored as a comma-list on the profile) ──────────────
function LanguagesEditor({ languages, onSaved }: { languages: LanguageEntry[]; onSaved: () => void }) {
  const [editing, setEditing] = useState(false);
  const [rows, setRows] = useState<LanguageEntry[]>(languages.length ? languages : [{ name: "", level: "Conversational" }]);
  const [submitting, setSubmitting] = useState(false);

  const startEditing = () => {
    setRows(languages.length ? languages : [{ name: "", level: "Conversational" }]);
    setEditing(true);
  };

  const save = async () => {
    const cleaned = rows.filter((r) => r.name.trim());
    setSubmitting(true);
    try {
      await api.updateMyProfile({ languages: cleaned });
      toast.success("Languages updated");
      setEditing(false);
      onSaved();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not update languages");
    } finally {
      setSubmitting(false);
    }
  };

  if (!editing) {
    return (
      <div>
        <div className="flex flex-wrap gap-1.5 mb-2">
          {languages.length === 0 && <span className="text-xs text-muted-foreground">No languages listed yet</span>}
          {languages.map((l) => <Badge key={l.name} variant="outline" className="text-xs rounded-full">{l.name} · {l.level}</Badge>)}
        </div>
        <Button size="sm" variant="outline" onClick={startEditing}>Edit Languages</Button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {rows.map((row, i) => (
        <div key={i} className="flex gap-2 items-center">
          <Input placeholder="Language" value={row.name} onChange={(e) => setRows((prev) => prev.map((r, ri) => ri === i ? { ...r, name: e.target.value } : r))} />
          <select
            value={row.level}
            onChange={(e) => setRows((prev) => prev.map((r, ri) => ri === i ? { ...r, level: e.target.value } : r))}
            className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option>Native</option>
            <option>Fluent</option>
            <option>Conversational</option>
            <option>Basic</option>
          </select>
          <button type="button" onClick={() => setRows((prev) => prev.filter((_, ri) => ri !== i))} className="text-muted-foreground hover:text-red-600">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
      <Button size="sm" variant="outline" onClick={() => setRows((prev) => [...prev, { name: "", level: "Conversational" }])}>
        <Plus className="h-3.5 w-3.5 mr-1" /> Add Language
      </Button>
      <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={() => setEditing(false)}>Cancel</Button>
        <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={save} disabled={submitting}>{submitting ? "Saving..." : "Save"}</Button>
      </div>
    </div>
  );
}

export function TalentProfile() {
  const [profile, setProfile] = useState<ProfessionalOut | null>(null);
  const [loading, setLoading] = useState(true);
  const [reviews, setReviews] = useState<ReviewOut[]>([]);

  const load = () => {
    api.myProfile().then((p) => {
      setProfile(p);
      api.reviewsForUser(p.user_id).then(setReviews).catch(() => {});
    }).catch(() => toast.error("Could not load profile")).finally(() => setLoading(false));
  };
  useEffect(load, []);

  if (loading) return <ListSkeleton />;
  if (!profile) return <p className="text-sm text-muted-foreground">No profile found.</p>;

  const verification = VERIFICATION_LABELS[profile.verification_status];

  return (
    <div className="space-y-5 max-w-2xl">
      <h1 className="text-2xl font-bold">My Profile</h1>
      <div className="rounded-xl border bg-background p-6 space-y-5">
        <div className="flex items-start gap-4">
          <div className="h-16 w-16 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold text-2xl">
            {profile.first_name.charAt(0)}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-bold text-lg">{profile.first_name} {profile.last_name}</p>
              <Badge className="bg-green-100 text-green-700 rounded-full text-xs capitalize">{profile.availability}</Badge>
              <Badge className={`rounded-full text-xs ${verification.className}`}>{verification.label}</Badge>
            </div>
            <p className="text-muted-foreground text-sm">{profile.title} · {profile.location || "Location not set"}</p>
            <div className="flex items-center gap-1 mt-1">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className={`h-3.5 w-3.5 ${i < Math.round(profile.rating) ? "fill-amber-400 text-amber-400" : "text-muted-foreground"}`} />
              ))}
              <span className="text-xs text-muted-foreground ml-1">{profile.rating || "New"} ({profile.review_count} reviews)</span>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          {profile.hourly_rate && (
            <div>
              <p className="text-xs text-muted-foreground mb-1">Hourly Rate</p>
              <p className="font-semibold">₦{profile.hourly_rate} / hour</p>
            </div>
          )}
          {profile.bio && (
            <div>
              <p className="text-xs text-muted-foreground mb-1">Bio</p>
              <p className="text-sm">{profile.bio}</p>
            </div>
          )}
          <div>
            <p className="text-xs text-muted-foreground mb-2">Skills</p>
            <div className="flex flex-wrap gap-2">
              {profile.skills.length === 0 && <span className="text-xs text-muted-foreground">No skills listed yet</span>}
              {profile.skills.map((sk) => (
                <Badge key={sk} variant="secondary" className="rounded-full text-xs">{sk}</Badge>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-xl border bg-background p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Portfolio</h2>
          <AddPortfolioItemForm onAdded={load} />
        </div>
        {profile.portfolio_items.length === 0 && <p className="text-sm text-muted-foreground">No portfolio items yet, add a completed project to build trust with clients.</p>}
        <div className="grid sm:grid-cols-2 gap-4">
          {profile.portfolio_items.map((item) => (
            <div key={item.id} className="rounded-lg border overflow-hidden">
              {item.image_urls[0] && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={item.image_urls[0]} alt={item.title} className="h-32 w-full object-cover" />
              )}
              <div className="p-3">
                <p className="font-medium text-sm">{item.title}</p>
                {item.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{item.description}</p>}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border bg-background p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold flex items-center gap-1.5"><LanguagesIcon className="h-4 w-4" /> Languages</h2>
        </div>
        <LanguagesEditor languages={profile.languages} onSaved={load} />
      </div>

      <div className="rounded-xl border bg-background p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold flex items-center gap-1.5"><Briefcase className="h-4 w-4" /> Employment History</h2>
          <AddEmploymentForm onAdded={load} />
        </div>
        {profile.employment_history.length === 0 && <p className="text-sm text-muted-foreground">No employment history added yet.</p>}
        {profile.employment_history.map((e) => (
          <div key={e.id} className="flex items-start justify-between gap-2 border-t pt-3 first:border-t-0 first:pt-0">
            <div>
              <p className="text-sm font-medium">{e.title} · {e.employer}</p>
              <p className="text-xs text-muted-foreground">
                {new Date(e.start_date).toLocaleDateString("en-US", { month: "short", year: "numeric" })} - {e.end_date ? new Date(e.end_date).toLocaleDateString("en-US", { month: "short", year: "numeric" }) : "Present"}
              </p>
              {e.description && <p className="text-sm text-muted-foreground mt-1">{e.description}</p>}
            </div>
            <button
              type="button"
              onClick={async () => { try { await api.deleteEmployment(e.id); toast.success("Removed"); load(); } catch { toast.error("Could not remove"); } }}
              className="text-muted-foreground hover:text-red-600 shrink-0"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>

      <div className="rounded-xl border bg-background p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold flex items-center gap-1.5"><GraduationCap className="h-4 w-4" /> Education</h2>
          <AddEducationForm onAdded={load} />
        </div>
        {profile.education.length === 0 && <p className="text-sm text-muted-foreground">No education added yet.</p>}
        {profile.education.map((e) => (
          <div key={e.id} className="flex items-start justify-between gap-2 border-t pt-3 first:border-t-0 first:pt-0">
            <div>
              <p className="text-sm font-medium">{e.school}</p>
              {(e.degree || e.field_of_study) && <p className="text-xs text-muted-foreground">{[e.degree, e.field_of_study].filter(Boolean).join(", ")}</p>}
              {(e.start_year || e.end_year) && <p className="text-xs text-muted-foreground">{e.start_year || ""}{e.start_year && e.end_year ? " - " : ""}{e.end_year || ""}</p>}
            </div>
            <button
              type="button"
              onClick={async () => { try { await api.deleteEducation(e.id); toast.success("Removed"); load(); } catch { toast.error("Could not remove"); } }}
              className="text-muted-foreground hover:text-red-600 shrink-0"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>

      <div className="rounded-xl border bg-background p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold flex items-center gap-1.5"><Award className="h-4 w-4" /> Certifications</h2>
          <AddCertificationForm onAdded={load} />
        </div>
        {profile.certifications.length === 0 && <p className="text-sm text-muted-foreground">No certifications added yet.</p>}
        {profile.certifications.map((c) => (
          <div key={c.id} className="flex items-start justify-between gap-2 border-t pt-3 first:border-t-0 first:pt-0">
            <div>
              <p className="text-sm font-medium">{c.name}</p>
              {c.issuing_body && <p className="text-xs text-muted-foreground">{c.issuing_body}</p>}
              {(c.issued_date || c.expiry_date) && (
                <p className="text-xs text-muted-foreground">
                  {c.issued_date && `Issued ${new Date(c.issued_date).toLocaleDateString("en-US", { month: "short", year: "numeric" })}`}
                  {c.expiry_date && ` · Expires ${new Date(c.expiry_date).toLocaleDateString("en-US", { month: "short", year: "numeric" })}`}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={async () => { try { await api.deleteCertification(c.id); toast.success("Removed"); load(); } catch { toast.error("Could not remove"); } }}
              className="text-muted-foreground hover:text-red-600 shrink-0"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>

      <div className="rounded-xl border bg-background p-6 space-y-3">
        <h2 className="font-semibold">Reviews ({reviews.length})</h2>
        {reviews.length === 0 && <p className="text-sm text-muted-foreground">No reviews yet.</p>}
        {reviews.map((r) => (
          <ReviewCard
            key={r.id}
            review={r}
            canRespond
            onResponded={(updated) => setReviews((prev) => prev.map((rv) => (rv.id === updated.id ? updated : rv)))}
          />
        ))}
      </div>
    </div>
  );
}

function PayoutDetailsForm() {
  const [bankCode, setBankCode] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [resolvedName, setResolvedName] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api.myProfile().then((p) => {
      if (p.bank_code) setBankCode(p.bank_code);
      if (p.has_payout_details) setResolvedName("On file");
    }).catch(() => {});
  }, []);

  const submit = async () => {
    if (!bankCode || accountNumber.length < 10) return toast.error("Select a bank and enter a valid account number");
    setSubmitting(true);
    try {
      const res = await api.setPayoutDetails({ bank_code: bankCode, bank_account_number: accountNumber });
      setResolvedName(res.bank_account_name);
      toast.success("Payout details saved");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not save payout details");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="rounded-xl border bg-background p-6 space-y-4">
      <h2 className="font-semibold">Payout Details</h2>
      <p className="text-xs text-muted-foreground">Milestone payouts are sent to this account via Monnify.</p>
      <div className="space-y-1.5">
        <label className="text-sm">Bank</label>
        <select value={bankCode} onChange={(e) => setBankCode(e.target.value)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
          <option value="">Select bank…</option>
          {NIGERIAN_BANKS.map((b) => <option key={b.code} value={b.code}>{b.name}</option>)}
        </select>
      </div>
      <div className="space-y-1.5">
        <label className="text-sm">Account Number</label>
        <Input value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} placeholder="0123456789" maxLength={10} />
      </div>
      {resolvedName && <p className="text-xs text-emerald-600">Account: {resolvedName}</p>}
      <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={submit} disabled={submitting}>{submitting ? "Saving..." : "Save Payout Details"}</Button>
    </div>
  );
}

function fmtFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ─── Verification document dropzone: click-to-browse card with a chosen-file state ───
function FileUploadField({
  label,
  description,
  required,
  file,
  onChange,
  disabled,
}: {
  label: string;
  description: string;
  required?: boolean;
  file: File | null;
  onChange: (f: File | null) => void;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div>
      <div className="flex items-center gap-1.5 mb-1">
        <span className="text-sm font-medium">{label}</span>
        {required ? (
          <span className="text-[10px] font-medium text-amber-700 bg-amber-100 rounded-full px-1.5 py-0.5">Required</span>
        ) : (
          <span className="text-[10px] font-medium text-muted-foreground bg-muted rounded-full px-1.5 py-0.5">Optional</span>
        )}
      </div>
      <p className="text-xs text-muted-foreground mb-2">{description}</p>
      <input
        ref={inputRef}
        type="file"
        accept="image/*,.pdf"
        className="hidden"
        onChange={(e) => onChange(e.target.files?.[0] || null)}
        disabled={disabled}
      />
      {file ? (
        <div className="flex items-center gap-3 rounded-lg border bg-muted/30 p-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
            <FileCheck2 className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{file.name}</p>
            <p className="text-xs text-muted-foreground">{fmtFileSize(file.size)}</p>
          </div>
          <button
            type="button"
            onClick={() => onChange(null)}
            disabled={disabled}
            className="text-muted-foreground hover:text-foreground shrink-0 disabled:opacity-50"
            aria-label={`Remove ${label}`}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={disabled}
          className="flex w-full items-center gap-3 rounded-lg border-2 border-dashed p-3 text-left hover:border-primary/50 hover:bg-muted/30 transition-colors disabled:opacity-50"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
            <Upload className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">Choose a file</p>
            <p className="text-xs text-muted-foreground">Image or PDF, up to 10MB</p>
          </div>
        </button>
      )}
    </div>
  );
}

function VerificationForm() {
  const [idFile, setIdFile] = useState<File | null>(null);
  const [licenseFile, setLicenseFile] = useState<File | null>(null);
  const [insuranceFile, setInsuranceFile] = useState<File | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api.myProfile().then((p) => setStatus(p.verification_status)).catch(() => {});
  }, []);

  const submit = async () => {
    if (!idFile && !licenseFile && !insuranceFile) return toast.error("Upload at least one document");
    setSubmitting(true);
    try {
      const [idUp, licUp, insUp] = await Promise.all([
        idFile ? api.uploadFile(idFile) : Promise.resolve(null),
        licenseFile ? api.uploadFile(licenseFile) : Promise.resolve(null),
        insuranceFile ? api.uploadFile(insuranceFile) : Promise.resolve(null),
      ]);
      const res = await api.submitVerification({
        id_document_url: idUp?.url,
        license_document_url: licUp?.url,
        insurance_document_url: insUp?.url,
      });
      setStatus(res.verification_status);
      toast.success("Documents submitted for review");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not submit documents");
    } finally {
      setSubmitting(false);
    }
  };

  const statusMeta = status ? VERIFICATION_LABELS[status] : null;
  const StatusIcon = status === "verified" ? ShieldCheck : status === "rejected" ? ShieldAlert : ShieldCheck;

  return (
    <div className="space-y-5">
      <div className="rounded-xl border bg-background p-6">
        <div className="flex items-start gap-4">
          <div
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${
              status === "verified" ? "bg-emerald-100 text-emerald-700" : status === "rejected" ? "bg-red-100 text-red-600" : status === "pending" ? "bg-amber-100 text-amber-700" : "bg-muted text-muted-foreground"
            }`}
          >
            <StatusIcon className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="font-semibold">Identity & Professional Verification</h2>
              {statusMeta && <Badge className={`text-xs rounded-full ${statusMeta.className}`}>{statusMeta.label}</Badge>}
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Upload a government ID and your professional license/registration (e.g. COREN, ARCON, CORBON) to earn a verified badge.
              Verified professionals get more visibility and client trust.
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-xl border bg-background p-6 space-y-5">
        <FileUploadField
          label="Government ID"
          description="A valid national ID, driver's licence, or international passport."
          required
          file={idFile}
          onChange={setIdFile}
          disabled={submitting}
        />
        <FileUploadField
          label="Professional License / Registration"
          description="Your industry body registration certificate (e.g. COREN, ARCON, CORBON, NIQS)."
          required
          file={licenseFile}
          onChange={setLicenseFile}
          disabled={submitting}
        />
        <FileUploadField
          label="Proof of Insurance"
          description="Professional indemnity or public liability insurance, if you have it."
          file={insuranceFile}
          onChange={setInsuranceFile}
          disabled={submitting}
        />
        <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={submit} disabled={submitting}>
          {submitting ? "Submitting..." : "Submit for Review"}
        </Button>
      </div>
    </div>
  );
}

function SettingsTabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
        active ? "bg-emerald-600 text-white" : "bg-muted text-muted-foreground hover:bg-muted/70"
      }`}
    >
      {children}
    </button>
  );
}

function TalentProfileTab() {
  const { user, refreshMe } = useAuth();
  const [firstName, setFirstName] = useState(user?.first_name || "");
  const [lastName, setLastName] = useState(user?.last_name || "");
  const [phone, setPhone] = useState(user?.phone || "");
  const [avatarUrl, setAvatarUrl] = useState(user?.avatar_url || "");
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const uploadAvatar = async (file: File) => {
    setUploadingAvatar(true);
    try {
      const { url } = await api.uploadFile(file);
      setAvatarUrl(url);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not upload photo");
    } finally {
      setUploadingAvatar(false);
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      await api.updateMe({ first_name: firstName, last_name: lastName, phone, avatar_url: avatarUrl });
      await refreshMe();
      toast.success("Profile saved");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not save profile");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-xl border bg-background p-6 space-y-4">
      <h2 className="font-semibold">Profile Information</h2>
      <div className="space-y-1.5">
        <label className="text-sm">Profile Photo</label>
        <div className="flex items-center gap-3">
          <UserAvatar avatarUrl={avatarUrl} name={`${firstName} ${lastName}`.trim() || "?"} className="h-14 w-14" fallbackClassName="bg-emerald-100 text-emerald-700" />
          <input
            type="file"
            accept="image/*"
            onChange={(e) => e.target.files?.[0] && uploadAvatar(e.target.files[0])}
            className="text-xs"
            disabled={uploadingAvatar}
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5"><label className="text-sm">First Name</label><Input value={firstName} onChange={(e) => setFirstName(e.target.value)} /></div>
        <div className="space-y-1.5"><label className="text-sm">Last Name</label><Input value={lastName} onChange={(e) => setLastName(e.target.value)} /></div>
      </div>
      <div className="space-y-1.5"><label className="text-sm">Email</label><Input defaultValue={user?.email} disabled /></div>
      <div className="space-y-1.5"><label className="text-sm">Phone</label><Input value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
      <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={save} disabled={saving}>{saving ? "Saving..." : "Save Changes"}</Button>
    </div>
  );
}

function TalentProfessionalTab() {
  const [profile, setProfile] = useState<ProfessionalOut | null>(null);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [bio, setBio] = useState("");
  const [location, setLocation] = useState("");
  const [hourlyRate, setHourlyRate] = useState("");
  const [yearsExperience, setYearsExperience] = useState("");
  const [skills, setSkills] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.myProfile().then((p) => {
      setProfile(p);
      setTitle(p.title);
      setCategoryId(p.category.id);
      setBio(p.bio || "");
      setLocation(p.location || "");
      setHourlyRate(p.hourly_rate != null ? String(p.hourly_rate) : "");
      setYearsExperience(p.years_experience || "");
      setSkills(p.skills.join(", "));
    }).catch(() => toast.error("Could not load professional profile")).finally(() => setLoading(false));
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      await api.updateMyProfile({
        title,
        category_id: categoryId,
        bio,
        location,
        hourly_rate: hourlyRate ? Number(hourlyRate) : undefined,
        years_experience: yearsExperience,
        skills: skills.split(",").map((s) => s.trim()).filter(Boolean),
      });
      toast.success("Professional details saved");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not save professional details");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <ListSkeleton />;
  if (!profile) return <p className="text-sm text-muted-foreground">No profile found.</p>;

  return (
    <div className="rounded-xl border bg-background p-6 space-y-4">
      <h2 className="font-semibold">Professional Details</h2>
      <p className="text-xs text-muted-foreground">Shown to clients when they view your profile or proposals.</p>
      <div className="space-y-1.5"><label className="text-sm">Title</label><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Structural Engineer" /></div>
      <div className="space-y-1.5">
        <label className="text-sm">Category</label>
        <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
          {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
        </select>
      </div>
      <div className="space-y-1.5">
        <label className="text-sm">Bio</label>
        <textarea rows={4} value={bio} onChange={(e) => setBio(e.target.value)} className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none" placeholder="Tell clients about your experience..." />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5"><label className="text-sm">Location</label><Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Lekki, Lagos" /></div>
        <div className="space-y-1.5"><label className="text-sm">Hourly Rate (₦)</label><Input type="number" value={hourlyRate} onChange={(e) => setHourlyRate(e.target.value)} /></div>
      </div>
      <div className="space-y-1.5"><label className="text-sm">Years of Experience</label><Input value={yearsExperience} onChange={(e) => setYearsExperience(e.target.value)} placeholder="e.g. 8" /></div>
      <div className="space-y-1.5">
        <label className="text-sm">Skills (comma-separated)</label>
        <Input value={skills} onChange={(e) => setSkills(e.target.value)} placeholder="AutoCAD, Structural Design, COREN" />
      </div>
      <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={save} disabled={saving}>{saving ? "Saving..." : "Save Professional Details"}</Button>
    </div>
  );
}

export function TalentSettings() {
  const [tab, setTab] = useState<"profile" | "professional" | "verification" | "payout" | "security">("profile");

  return (
    <div className="space-y-5 max-w-lg">
      <h1 className="text-2xl font-bold">Account Settings</h1>
      <div className="flex gap-2 flex-wrap">
        <SettingsTabButton active={tab === "profile"} onClick={() => setTab("profile")}>Profile</SettingsTabButton>
        <SettingsTabButton active={tab === "professional"} onClick={() => setTab("professional")}>Professional</SettingsTabButton>
        <SettingsTabButton active={tab === "verification"} onClick={() => setTab("verification")}>Verification</SettingsTabButton>
        <SettingsTabButton active={tab === "payout"} onClick={() => setTab("payout")}>Payout</SettingsTabButton>
        <SettingsTabButton active={tab === "security"} onClick={() => setTab("security")}>Security</SettingsTabButton>
      </div>

      {tab === "profile" && <TalentProfileTab />}
      {tab === "professional" && <TalentProfessionalTab />}
      {tab === "verification" && <VerificationForm />}
      {tab === "payout" && <PayoutDetailsForm />}
      {tab === "security" && <SecurityPanel />}
    </div>
  );
}

function SecurityPanel() {
  const { user, token, setSession } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [emailNotifs, setEmailNotifs] = useState(user?.email_notifications_enabled ?? true);
  const [savingNotifs, setSavingNotifs] = useState(false);

  const toggleEmailNotifs = async () => {
    const next = !emailNotifs;
    setEmailNotifs(next);
    setSavingNotifs(true);
    try {
      const updated = await api.updateMe({ email_notifications_enabled: next });
      if (token) setSession(updated, token);
      toast.success(next ? "Email notifications enabled" : "Email notifications disabled");
    } catch (err) {
      setEmailNotifs(!next);
      toast.error(err instanceof ApiError ? err.message : "Could not update preference");
    } finally {
      setSavingNotifs(false);
    }
  };

  const changePassword = async () => {
    if (!currentPassword || !newPassword) return toast.error("Please fill in both password fields");
    if (newPassword !== confirmPassword) return toast.error("New passwords do not match");
    if (newPassword.length < 8) return toast.error("New password must be at least 8 characters");
    setSaving(true);
    try {
      const res = await api.changePassword(currentPassword, newPassword);
      setSession(res.user, res.access_token);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast.success("Password changed");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not change password");
    } finally {
      setSaving(false);
    }
  };

  const logoutEverywhere = async () => {
    if (!confirm("Log out of all other devices? Any other active sessions will be signed out immediately.")) return;
    setLoggingOut(true);
    try {
      const res = await api.logoutEverywhere();
      setSession(res.user, res.access_token);
      toast.success("Logged out of all other devices");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not complete this action");
    } finally {
      setLoggingOut(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="rounded-xl border bg-background p-6 space-y-4">
        <h2 className="font-semibold">Change Password</h2>
        <div className="space-y-1.5"><label className="text-sm">Current Password</label><Input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} /></div>
        <div className="space-y-1.5"><label className="text-sm">New Password</label><Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} /></div>
        <div className="space-y-1.5"><label className="text-sm">Confirm New Password</label><Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} /></div>
        <Button onClick={changePassword} disabled={saving}>{saving ? "Saving..." : "Change Password"}</Button>
      </div>
      <div className="rounded-xl border bg-background p-6 space-y-3">
        <h2 className="font-semibold">Active Sessions</h2>
        <p className="text-xs text-muted-foreground">If you signed in on a device you don&apos;t recognize, log out everywhere and change your password.</p>
        <Button variant="outline" onClick={logoutEverywhere} disabled={loggingOut}>{loggingOut ? "Working..." : "Log Out of All Other Devices"}</Button>
      </div>
      <div className="rounded-xl border bg-background p-6 space-y-3">
        <h2 className="font-semibold">Notifications</h2>
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium">Email notifications</p>
            <p className="text-xs text-muted-foreground">Get emails for messages, milestones, disputes, and other account activity.</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={emailNotifs}
            disabled={savingNotifs}
            onClick={toggleEmailNotifs}
            className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-60 ${emailNotifs ? "bg-emerald-600" : "bg-muted-foreground/30"}`}
          >
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${emailNotifs ? "translate-x-6" : "translate-x-1"}`} />
          </button>
        </div>
      </div>
    </div>
  );
}

const PROPOSAL_STATUS_TABS: { value: BidStatus | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "shortlisted", label: "Shortlisted" },
  { value: "accepted", label: "Accepted" },
  { value: "rejected", label: "Rejected" },
];

export function TalentProposals() {
  const [bids, setBids] = useState<BidOut[]>([]);
  const [invites, setInvites] = useState<InviteOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<BidStatus | "all">("all");

  const load = () => {
    setLoading(true);
    Promise.all([api.myBids(), api.myInvites()])
      .then(([b, i]) => {
        setBids(b);
        setInvites(i.filter((x) => x.status === "pending"));
      })
      .catch(() => toast.error("Could not load proposals"))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const respond = async (id: string, status: "accepted" | "declined") => {
    try {
      await api.respondToInvite(id, status);
      toast.success(status === "accepted" ? "Invite accepted, a proposal was created" : "Invite declined");
      load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not respond to invite");
    }
  };

  const counts = {
    all: bids.length,
    pending: bids.filter((b) => b.status === "pending").length,
    shortlisted: bids.filter((b) => b.status === "shortlisted").length,
    accepted: bids.filter((b) => b.status === "accepted").length,
    rejected: bids.filter((b) => b.status === "rejected").length,
  };
  const filteredBids = statusFilter === "all" ? bids : bids.filter((b) => b.status === statusFilter);
  const winRate = counts.all > 0 ? Math.round((counts.accepted / counts.all) * 100) : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">My Proposals</h1>
        <p className="text-muted-foreground text-sm mt-1">Track every proposal you&apos;ve submitted and its status.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Sent" value={String(counts.all)} icon={Send} color="blue" />
        <StatCard label="Pending" value={String(counts.pending)} icon={Clock} color="amber" />
        <StatCard label="Accepted" value={String(counts.accepted)} icon={CheckCircle2} color="emerald" />
        <StatCard label="Win Rate" value={`${winRate}%`} icon={TrendingUp} />
      </div>

      {invites.length > 0 && (
        <div className="rounded-xl border bg-background divide-y">
          <div className="p-4 border-b font-semibold text-sm flex items-center gap-2">
            <Mail className="h-4 w-4 text-muted-foreground" /> Invitations ({invites.length})
          </div>
          {invites.map((inv) => (
            <div key={inv.id} className="flex items-center justify-between p-4 gap-3">
              <div className="min-w-0">
                <Link href={`/talent/dashboard/find-work/${inv.project_id}`} className="font-medium text-sm hover:underline hover:text-emerald-600">
                  {inv.project_title}
                </Link>
                <p className="text-xs text-muted-foreground truncate">
                  from {inv.client_name}{inv.message ? `, "${inv.message}"` : ""}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {inv.proposed_amount != null && <span className="text-sm font-medium">{fmtNaira(inv.proposed_amount)}</span>}
                <Button size="sm" variant="outline" onClick={() => respond(inv.id, "declined")}>Decline</Button>
                <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => respond(inv.id, "accepted")}>Accept</Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {PROPOSAL_STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setStatusFilter(tab.value)}
            className={`text-xs font-medium rounded-full px-3 py-1.5 border transition-colors ${
              statusFilter === tab.value
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-background text-muted-foreground border-input hover:bg-muted"
            }`}
          >
            {tab.label} <span className="opacity-70">({counts[tab.value]})</span>
          </button>
        ))}
      </div>

      <div className="rounded-xl border bg-background divide-y">
        {loading && <ListSkeleton />}
        {!loading && filteredBids.length === 0 && (
          <div className="p-2">
            <EmptyState
              icon={Send}
              title={bids.length === 0 ? "No proposals submitted yet" : "No proposals in this status"}
              message="Browse open projects and submit a proposal to get started."
              action={
                <Link href="/talent/dashboard/find-work">
                  <Button size="sm"><Search className="h-3.5 w-3.5 mr-1" /> Find Work</Button>
                </Link>
              }
            />
          </div>
        )}
        {filteredBids.map((b) => (
          <Link
            key={b.id}
            href={`/talent/dashboard/find-work/${b.project_id}`}
            className="flex items-start justify-between gap-4 p-5 hover:bg-muted/40 transition-colors group"
          >
            <div className="flex items-start gap-3 min-w-0">
              <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5">
                <Briefcase className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-sm truncate group-hover:text-primary transition-colors">{b.project_title}</p>
                {b.cover_letter && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{b.cover_letter}</p>}
                <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                  <span>Submitted {new Date(b.created_at).toLocaleDateString()}</span>
                  {b.estimated_days && <span>· Est. {b.estimated_days} days</span>}
                </div>
              </div>
            </div>
            <div className="flex flex-col items-end gap-1.5 shrink-0">
              <Badge className={`text-xs rounded-full ${PROP_STATUS_COLORS[b.status]}`}>{b.status}</Badge>
              <span className="text-sm font-semibold">{fmtNaira(b.amount)}</span>
              <ChevronRight className="h-4 w-4 text-muted-foreground hidden sm:block" />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

export function TalentActiveJobs() {
  const [projects, setProjects] = useState<ProjectOut[]>([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    api.myProjects().then((p) => setProjects(p.filter((x) => x.status === "in_progress" || x.status === "review"))).catch(() => toast.error("Could not load jobs")).finally(() => setLoading(false));
  };

  useEffect(load, []);

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">Active Jobs</h1>
      {loading && <ListSkeleton />}
      {!loading && projects.length === 0 && (
        <EmptyState icon={Briefcase} title="No active jobs right now" message="Keep applying to open projects to land your next job." />
      )}
      {projects.map((j) => (
        <Link key={j.id} href={`/talent/dashboard/active/${j.id}`} className="block w-full text-left rounded-xl border bg-background p-5 hover:shadow-sm transition-shadow">
          <div className="flex items-start justify-between">
            <div>
              <p className="font-semibold">{j.title}</p>
              <p className="text-sm text-muted-foreground">{j.category.label} · {j.location || "-"}</p>
            </div>
            <span className="font-semibold text-emerald-600">{fmtNaira(j.budget_min)} – {fmtNaira(j.budget_max)}</span>
          </div>
          <div className="mt-4 flex items-center gap-3">
            <div className="flex-1 h-2 rounded-full bg-muted">
              <div className="h-2 rounded-full bg-emerald-500" style={{ width: `${j.progress}%` }} />
            </div>
            <span className="text-sm font-medium">{j.progress}%</span>
          </div>
        </Link>
      ))}
    </div>
  );
}

export function TalentMessages() {
  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">Messages</h1>
      <MessagesPanel />
    </div>
  );
}

