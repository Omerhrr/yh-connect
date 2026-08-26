
"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  BarChart3,
  Bell,
  Briefcase,
  CheckCircle2,
  ChevronDown,
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
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  FileEdit,
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
  Play,
  Pause,
  Reply,
  Smile,
  Mic,
  Pencil,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
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
  type DisputeOutcome,
  type ReviewOut,
  type FavoriteTargetType,
  type EmploymentHistoryOut,
  type EducationOut,
  type CertificationOut,
  type LanguageEntry,
  type ClientPublicOut,
  type PayoutAccountOut,
  type ProjectMediaSettingsOut,
  DISPUTE_CATEGORY_LABELS,
  DISPUTE_OUTCOME_LABELS,
} from "@/lib/api";
import { CATEGORIES, SKILLS } from "@/data/content";
import { inferCategoryId } from "@/lib/categoryInference";
import { PROJECT_STATUS_COLORS, BID_STATUS_COLORS, DISPUTE_STATUS_COLORS } from "@/lib/statusColors";
import { formatNaira as fmtNaira, formatBudgetRange } from "@/lib/utils";
import { toast } from "sonner";
import Link from "next/link";
import { ProjectChat } from "@/components/site/chat/ProjectChat";
import { useProjectUnread } from "@/hooks/useProjectUnread";
import { Skeleton } from "@/components/ui/skeleton";
import { Inbox } from "lucide-react";
import { ReviewCard } from "@/components/site/shared/ReviewCard";
import { ProfessionalProfileView, StatsBar, WorkHistoryFeed } from "@/components/site/pages/ProfessionalProfileView";
import { TierTag, CertificationBadges } from "@/components/site/shared/TalentTier";

// ─── Unread message count chip for project cards/lists ────────────────────────
function UnreadBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span
      className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-medium text-primary-foreground"
      title={`${count} unread message${count === 1 ? "" : "s"}`}
    >
      {count > 9 ? "9+" : count}
    </span>
  );
}

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

// ─── Shared messaging panel (thread list + chat via ProjectChat) ───────────
function formatThreadTime(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (sameDay(d, now)) return d.toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit" });
  const yesterday = new Date();
  yesterday.setDate(now.getDate() - 1);
  if (sameDay(d, yesterday)) return "Yesterday";
  return d.toLocaleDateString("en-NG", { day: "numeric", month: "short" });
}

function MessagesPanel() {
  const { user } = useAuth();
  const [threads, setThreads] = useState<ThreadOut[]>([]);
  const [loadingThreads, setLoadingThreads] = useState(true);
  const [active, setActive] = useState<ThreadOut | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const rolePath = user?.role === "professional" ? "talent" : "client";

  // Deep-link support: the project workspace's "Open in Messages" links here
  // with ?project=&user=&name=&title= so the same conversation is preselected
  // (and, when no messages exist yet, a placeholder thread is opened anyway).
  const deepLinkRef = useRef<{ projectId: string; otherUserId: string } | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const projectId = params.get("project");
    const otherUserId = params.get("user");
    if (!projectId || !otherUserId) return;
    deepLinkRef.current = { projectId, otherUserId };
    setActive({
      project_id: projectId,
      project_title: params.get("title") || "",
      other_user_id: otherUserId,
      other_user_name: params.get("name") || "Conversation",
      last_message: "",
      last_message_at: new Date().toISOString(),
      unread_count: 0,
    });
    // One-shot deep link: strip the params so a later reload lands on normal state.
    window.history.replaceState(null, "", window.location.pathname);
  }, []);

  const loadThreads = () => {
    api
      .messageThreads()
      .then((list) => {
        setThreads(list);
        // If the deep-linked thread exists among real conversations, prefer it
        // so the title, name and unread count are accurate.
        const dl = deepLinkRef.current;
        if (dl) {
          const match = list.find((t) => t.project_id === dl.projectId && t.other_user_id === dl.otherUserId);
          if (match) setActive(match);
        }
      })
      .catch(() => {})
      .finally(() => setLoadingThreads(false));
  };

  useEffect(() => {
    loadThreads();
    const interval = setInterval(loadThreads, 20000);
    return () => clearInterval(interval);
  }, []);

  const unreadTotal = threads.reduce((sum, t) => sum + t.unread_count, 0);
  const q = query.trim().toLowerCase();
  const filtered = threads.filter((t) => {
    if (filter === "unread" && t.unread_count === 0) return false;
    if (!q) return true;
    return (
      t.other_user_name.toLowerCase().includes(q) ||
      t.project_title.toLowerCase().includes(q) ||
      (t.last_message || "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="grid md:grid-cols-[300px_1fr] gap-4 h-[calc(100vh-220px)] min-h-[420px]">
      {/* Conversation list — full width on mobile until a thread is opened */}
      <div className={`rounded-xl border bg-background flex flex-col min-h-0 overflow-hidden ${active ? "hidden md:flex" : "flex"}`}>
        <div className="p-2 border-b space-y-2 shrink-0">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search conversations"
              className="h-9 pl-8"
            />
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setFilter("all")}
              className={`flex-1 rounded-md px-2 py-1 text-xs font-medium transition-colors ${
                filter === "all" ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted/40"
              }`}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => setFilter("unread")}
              className={`flex-1 rounded-md px-2 py-1 text-xs font-medium transition-colors ${
                filter === "unread" ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted/40"
              }`}
            >
              Unread{unreadTotal > 0 ? ` (${unreadTotal})` : ""}
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto divide-y min-h-0">
          {loadingThreads && <ListSkeleton />}
          {!loadingThreads && filtered.length === 0 && (
            <div className="p-2">
              <EmptyState
                icon={MessageSquare}
                title={threads.length === 0 ? "No conversations yet" : "No matches"}
                message={
                  threads.length === 0
                    ? "Messages with clients or professionals on your projects will show up here."
                    : "Try a different search or filter."
                }
              />
            </div>
          )}
          {filtered.map((t) => {
            const isActive = active?.project_id === t.project_id && active?.other_user_id === t.other_user_id;
            const unread = t.unread_count > 0;
            return (
              <button
                key={`${t.project_id}-${t.other_user_id}`}
                onClick={() => setActive(t)}
                className={`flex w-full items-start gap-3 p-3 text-left hover:bg-muted/30 transition-colors ${isActive ? "bg-muted/40" : ""}`}
              >
                <div
                  className={`h-9 w-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
                    unread ? "bg-primary text-primary-foreground" : "bg-primary/15 text-primary"
                  }`}
                >
                  {t.other_user_name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className={`text-sm truncate ${unread ? "font-semibold" : "font-medium"}`}>{t.other_user_name}</p>
                    <span className="text-[10px] text-muted-foreground shrink-0">{formatThreadTime(t.last_message_at)}</span>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{t.project_title}</p>
                  <div className="flex items-center justify-between gap-2 mt-0.5">
                    <p className={`text-xs truncate ${unread ? "text-foreground font-medium" : "text-muted-foreground"}`}>
                      {t.last_message || "No messages yet"}
                    </p>
                    {unread && (
                      <span className="shrink-0 min-w-[18px] h-[18px] px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-semibold flex items-center justify-center">
                        {t.unread_count > 9 ? "9+" : t.unread_count}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
      {/* Conversation — takes over on mobile when a thread is open */}
      <div className={`flex flex-col min-w-0 overflow-hidden ${active ? "flex" : "hidden md:flex"}`}>
        {!active ? (
          <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground rounded-xl border bg-background">Select a conversation</div>
        ) : (
          <ProjectChat
            projectId={active.project_id}
            otherUserId={active.other_user_id}
            otherUserName={active.other_user_name}
            subtitle={active.project_title}
            projectHref={`/${rolePath}/dashboard/${rolePath === "talent" ? "active" : "projects"}/${active.project_id}`}
            onActivity={loadThreads}
            onBack={() => setActive(null)}
            className="h-full"
          />
        )}
      </div>
    </div>
  );
}

// ─── Shared bid-status display (used wherever a talent can Apply) ──────────
const BID_STATUS_LABELS: Record<BidStatus, string> = {
  pending: "Applied",
  shortlisted: "Shortlisted",
  offered: "Offer received",
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
  const [proposeOpen, setProposeOpen] = useState(false);
  const [proposeOutcome, setProposeOutcome] = useState<DisputeOutcome>("refund_client");
  const [proposeSplit, setProposeSplit] = useState("");
  const [proposeNote, setProposeNote] = useState("");
  const [proposing, setProposing] = useState(false);
  const [responding, setResponding] = useState(false);

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

  const submitProposal = async () => {
    if (!dispute) return;
    if (proposeOutcome === "partial_split" && (!proposeSplit || Number(proposeSplit) < 0)) {
      return toast.error("Enter how much of the milestone amount goes to the professional");
    }
    setProposing(true);
    try {
      await api.proposeResolution(dispute.id, {
        outcome: proposeOutcome,
        split_professional_amount: proposeOutcome === "partial_split" ? Number(proposeSplit) : undefined,
        note: proposeNote || undefined,
      });
      toast.success("Proposal sent — waiting on their response");
      setProposeOpen(false);
      setProposeNote("");
      setProposeSplit("");
      load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not send proposal");
    } finally {
      setProposing(false);
    }
  };

  const respondToProposal = async (accept: boolean) => {
    if (!dispute) return;
    if (accept && !confirm("Accept this proposed resolution? This will move funds and close the dispute — it can't be undone.")) return;
    setResponding(true);
    try {
      await api.respondProposal(dispute.id, accept);
      toast.success(accept ? "Proposal accepted, dispute resolved" : "Proposal declined");
      load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not respond to proposal");
    } finally {
      setResponding(false);
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

        {!isClosed && dispute.proposal_status === "pending" && (
          <div className="rounded-lg bg-purple-50 border border-purple-200 p-3 text-sm space-y-2">
            <p className="font-medium text-purple-900">
              {dispute.proposed_by === user?.id ? "You proposed:" : `${dispute.proposed_by_name || "The other party"} proposed:`}{" "}
              {dispute.proposed_outcome && DISPUTE_OUTCOME_LABELS[dispute.proposed_outcome]}
              {dispute.proposed_outcome === "partial_split" && dispute.proposed_split_amount != null && ` (₦${dispute.proposed_split_amount.toLocaleString("en-NG")} to the professional)`}
            </p>
            {dispute.proposal_note && <p className="text-purple-800">{dispute.proposal_note}</p>}
            {dispute.proposal_expires_at && (
              <p className="text-xs text-purple-700/80">
                Auto-accepts by {new Date(dispute.proposal_expires_at).toLocaleString()} if there's no response.
              </p>
            )}
            {dispute.proposed_by !== user?.id && (
              <div className="flex gap-2 pt-1">
                <Button size="sm" variant="outline" disabled={responding} onClick={() => respondToProposal(false)}>Decline</Button>
                <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" disabled={responding} onClick={() => respondToProposal(true)}>Accept</Button>
              </div>
            )}
          </div>
        )}

        {!isClosed && dispute.proposal_status !== "pending" && (
          <div className="space-y-2">
            {!proposeOpen ? (
              <Button size="sm" variant="outline" onClick={() => setProposeOpen(true)}>Propose a Resolution</Button>
            ) : (
              <div className="rounded-lg border p-3 space-y-2 bg-muted/20">
                <p className="text-xs text-muted-foreground">
                  Suggest a settlement directly to the other party — no admin needed unless they decline.
                </p>
                <select
                  value={proposeOutcome}
                  onChange={(e) => setProposeOutcome(e.target.value as DisputeOutcome)}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  {(dispute.milestone_id
                    ? (["refund_client", "release_professional", "partial_split"] as DisputeOutcome[])
                    : (["no_action"] as DisputeOutcome[])
                  ).map((o) => (
                    <option key={o} value={o}>{DISPUTE_OUTCOME_LABELS[o]}</option>
                  ))}
                </select>
                {proposeOutcome === "partial_split" && (
                  <Input type="number" placeholder="Amount to the professional (₦)" value={proposeSplit} onChange={(e) => setProposeSplit(e.target.value)} />
                )}
                <textarea
                  rows={2}
                  value={proposeNote}
                  onChange={(e) => setProposeNote(e.target.value)}
                  placeholder="Explain your proposal (optional)"
                  className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none"
                />
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => setProposeOpen(false)}>Cancel</Button>
                  <Button size="sm" onClick={submitProposal} disabled={proposing}>{proposing ? "Sending..." : "Send Proposal"}</Button>
                </div>
              </div>
            )}
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

const POST_PROJECT_STEPS = ["What you need", "Project details", "Budget", "Skills", "Review & post"];

const DEFAULT_PROJECT_TERMS =
  "By posting a project, you confirm the details you've provided are accurate, you intend to genuinely hire for this work, and you agree to fund and pay professionals through YH Connect's escrow system for any work you approve.";

// Draft persistence: everything the wizard needs to resume mid-way lives in
// localStorage, so closing the dialog (or the browser) never loses progress.
const POST_DRAFT_KEY = "yh-connect.post-project.draft";

type PostProjectDraft = {
  step: number;
  needText: string;
  title: string;
  location: string;
  categoryId: string;
  categoryTouched: boolean;
  budgetType: "fixed" | "hourly";
  budgetAmount: string;
  hourlyMin: string;
  hourlyMax: string;
  skills: string[];
  termsAgreed: boolean;
};

function loadPostDraft(): PostProjectDraft | null {
  try {
    const raw = localStorage.getItem(POST_DRAFT_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw) as Partial<PostProjectDraft>;
    if (typeof d !== "object" || d === null) return null;
    return {
      step: typeof d.step === "number" && d.step >= 0 && d.step < POST_PROJECT_STEPS.length ? d.step : 0,
      needText: typeof d.needText === "string" ? d.needText : "",
      title: typeof d.title === "string" ? d.title : "",
      location: typeof d.location === "string" ? d.location : "",
      categoryId: typeof d.categoryId === "string" ? d.categoryId : "",
      categoryTouched: !!d.categoryTouched,
      budgetType: d.budgetType === "hourly" ? "hourly" : "fixed",
      budgetAmount: typeof d.budgetAmount === "string" ? d.budgetAmount : "",
      hourlyMin: typeof d.hourlyMin === "string" ? d.hourlyMin : "",
      hourlyMax: typeof d.hourlyMax === "string" ? d.hourlyMax : "",
      skills: Array.isArray(d.skills) ? d.skills.filter((s): s is string => typeof s === "string") : [],
      termsAgreed: !!d.termsAgreed,
    };
  } catch {
    return null;
  }
}

function isEmptyPostDraft(d: PostProjectDraft): boolean {
  return !d.needText && !d.title && !d.budgetAmount && !d.hourlyMin && !d.hourlyMax && !d.location && d.skills.length === 0;
}

/**
 * Guided "Post a Project" wizard. Broken into short steps so clients describe
 * their project in their own words, confirm the details, set a budget, pick
 * skills, then review everything before posting (mirroring the onboarding
 * wizard's conversational flow).
 */
export function PostProjectDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState<"forward" | "back">("forward");

  // Step 0: what they need, described in their own words.
  const [needText, setNeedText] = useState("");
  // Step 1: title, location, and the category (auto-inferred from the
  // description unless the client picks one manually).
  const [title, setTitle] = useState("");
  const [location, setLocation] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [categoryTouched, setCategoryTouched] = useState(false);
  // Step 2: budget. Fixed projects get a single estimate; hourly projects a rate range.
  const [budgetType, setBudgetType] = useState<"fixed" | "hourly">("fixed");
  const [budgetAmount, setBudgetAmount] = useState("");
  const [hourlyMin, setHourlyMin] = useState("");
  const [hourlyMax, setHourlyMax] = useState("");
  // Step 3: skills (tap suggestions or add your own).
  const [skills, setSkills] = useState<string[]>([]);
  const [customSkill, setCustomSkill] = useState("");
  // Step 4: review + project posting terms.
  const [projectTerms, setProjectTerms] = useState<{ title: string; body: string } | null>(null);
  const [termsAgreed, setTermsAgreed] = useState(false);
  // Optional media, gated by admin settings (images on by default, video off).
  const [mediaSettings, setMediaSettings] = useState<ProjectMediaSettingsOut | null>(null);
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [videoUrl, setVideoUrl] = useState("");
  const [uploadingVideo, setUploadingVideo] = useState(false);
  // Budget "I don't know yet" — posts budget 0/0, talent sees "Budget Not Set".
  const [budgetUnknown, setBudgetUnknown] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [restoredDraft, setRestoredDraft] = useState(false);

  // On open: restore the saved draft if one exists (so a client who closed
  // mid-way picks up exactly where they left off), otherwise start blank.
  // Either way, pull the admin-configurable posting terms.
  useEffect(() => {
    if (!open) return;
    const draft = loadPostDraft();
    if (draft) {
      setStep(draft.step);
      setNeedText(draft.needText);
      setTitle(draft.title);
      setLocation(draft.location);
      setCategoryId(draft.categoryId);
      setCategoryTouched(draft.categoryTouched);
      setBudgetType(draft.budgetType);
      setBudgetAmount(draft.budgetAmount);
      setHourlyMin(draft.hourlyMin);
      setHourlyMax(draft.hourlyMax);
      setSkills(draft.skills);
      setTermsAgreed(draft.termsAgreed);
      setRestoredDraft(true);
    } else {
      setStep(0);
      setNeedText("");
      setTitle("");
      setLocation("");
      setCategoryId("");
      setCategoryTouched(false);
      setBudgetType("fixed");
      setBudgetAmount("");
      setHourlyMin("");
      setHourlyMax("");
      setSkills([]);
      setTermsAgreed(false);
      setRestoredDraft(false);
    }
    setDirection("forward");
    setCustomSkill("");
    setSubmitting(false);
    setCreatedId(null);
    setImageUrls([]);
    setVideoUrl("");
    setBudgetUnknown(false);
    api.contentPage("client-project-terms")
      .then((p) => setProjectTerms({ title: p.title, body: p.body }))
      .catch(() => setProjectTerms(null));
    api.projectMediaSettings()
      .then(setMediaSettings)
      .catch(() => setMediaSettings(null));
  }, [open]);

  // Persist the draft as the client types AND broadcast to other tabs via
  // BroadcastChannel so a second tab picks up the same draft in real time.
  const draftChannelRef = useRef<BroadcastChannel | null>(null);
  useEffect(() => {
    draftChannelRef.current = new BroadcastChannel("yh-connect.post-project");
    return () => { draftChannelRef.current?.close(); draftChannelRef.current = null; };
  }, []);

  // Listen for draft changes from other tabs (so opening tab B while tab A
  // has a draft picks it up without a page reload).
  useEffect(() => {
    const ch = draftChannelRef.current;
    if (!ch) return;
    const handler = (e: MessageEvent) => {
      if (!open) return;
      const draft = e.data as PostProjectDraft | null;
      if (!draft) return;
      setStep(draft.step);
      setNeedText(draft.needText);
      setTitle(draft.title);
      setLocation(draft.location);
      setCategoryId(draft.categoryId);
      setCategoryTouched(draft.categoryTouched);
      setBudgetType(draft.budgetType);
      setBudgetAmount(draft.budgetAmount);
      setHourlyMin(draft.hourlyMin);
      setHourlyMax(draft.hourlyMax);
      setSkills(draft.skills);
      setTermsAgreed(draft.termsAgreed);
      setRestoredDraft(true);
    };
    ch.addEventListener("message", handler);
    return () => ch.removeEventListener("message", handler);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const draft: PostProjectDraft = {
      step,
      needText,
      title,
      location,
      categoryId,
      categoryTouched,
      budgetType,
      budgetAmount,
      hourlyMin,
      hourlyMax,
      skills,
      termsAgreed,
    };
    if (isEmptyPostDraft(draft)) {
      localStorage.removeItem(POST_DRAFT_KEY);
    } else {
      localStorage.setItem(POST_DRAFT_KEY, JSON.stringify(draft));
    }
    // Broadcast to other tabs so they pick up the latest draft in real time.
    draftChannelRef.current?.postMessage(draft);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, step, needText, title, location, categoryId, categoryTouched, budgetType, budgetAmount, hourlyMin, hourlyMax, skills, termsAgreed]);

  const inferredCategoryId = inferCategoryId(needText);
  const inferredCategoryLabel = CATEGORIES.find((c) => c.id === inferredCategoryId)?.label ?? "General Contracting & Building";
  const effectiveCategoryId = categoryId || inferredCategoryId;
  const categoryLabel = CATEGORIES.find((c) => c.id === effectiveCategoryId)?.label ?? inferredCategoryLabel;

  const onNeedChange = (text: string) => {
    setNeedText(text);
    // Follow the live inference until the client picks a category by hand.
    if (!categoryTouched) setCategoryId(inferCategoryId(text));
  };

  const addCustomSkill = () => {
    const s = customSkill.trim();
    if (!s) return;
    if (!skills.includes(s)) setSkills((prev) => [...prev, s]);
    setCustomSkill("");
  };

  // Rank skill suggestions so ones tied to the inferred category surface first.
  const suggestedSkills = [...SKILLS].sort((a, b) => {
    const catWord = inferredCategoryId.split("-")[0];
    const relevance = (s: (typeof SKILLS)[number]) =>
      s.label.toLowerCase().includes(catWord) || s.category.toLowerCase().includes(catWord) ? 1 : 0;
    return relevance(b) - relevance(a);
  });

  const goNext = () => {
    if (step === 0 && !needText.trim()) return toast.error("Please tell us what you need help with");
    if (step === 1 && !title.trim()) return toast.error("Please enter a project title");
    if (step === 2 && !budgetUnknown) {
      if (budgetType === "fixed" && (!budgetAmount || Number(budgetAmount) <= 0)) {
        return toast.error("Please enter your estimated budget");
      }
      if (budgetType === "hourly" && (!hourlyMin || !hourlyMax || Number(hourlyMin) <= 0 || Number(hourlyMax) <= 0)) {
        return toast.error("Please enter your hourly rate range");
      }
      if (budgetType === "hourly" && Number(hourlyMin) > Number(hourlyMax)) {
        return toast.error("Minimum rate can't be higher than the maximum");
      }
    }
    if (step === 3 && skills.length === 0) return toast.error("Pick at least one skill or add your own");
    setDirection("forward");
    setStep((s) => s + 1);
  };

  const goBack = () => {
    setDirection("back");
    setStep((s) => s - 1);
  };

  const clearDraft = () => {
    localStorage.removeItem(POST_DRAFT_KEY);
    setRestoredDraft(false);
    setDirection("forward");
    setStep(0);
    setNeedText("");
    setTitle("");
    setLocation("");
    setCategoryId("");
    setCategoryTouched(false);
    setBudgetType("fixed");
    setBudgetAmount("");
    setHourlyMin("");
    setHourlyMax("");
    setSkills([]);
    setCustomSkill("");
    setTermsAgreed(false);
    toast.success("Draft cleared, starting fresh");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!termsAgreed) return toast.error("Please accept the project posting terms to post");
    const budgetMin = budgetUnknown ? 0 : budgetType === "fixed" ? Number(budgetAmount) : Number(hourlyMin);
    const budgetMax = budgetUnknown ? 0 : budgetType === "fixed" ? Number(budgetAmount) : Number(hourlyMax);
    if (!budgetUnknown && (!budgetMin || !budgetMax)) return toast.error("Please set your budget");
    setSubmitting(true);
    try {
      const project = await api.createProject({
        title: title.trim(),
        description: needText.trim(),
        category_id: effectiveCategoryId,
        location: location.trim() || undefined,
        budget_min: budgetMin,
        budget_max: budgetMax,
        budget_type: budgetType,
        skills,
        image_urls: imageUrls,
        video_url: videoUrl.trim() || undefined,
      });
      setCreatedId(project.id);
      localStorage.removeItem(POST_DRAFT_KEY);
      setRestoredDraft(false);
      toast.success("Project posted!");
      onCreated();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not post project");
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  // Success screen: stay in the dialog and let the client decide where to go next.
  if (createdId) {
    return (
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4">
        <div className="w-full sm:max-w-md bg-background rounded-t-2xl sm:rounded-2xl border shadow-lg p-6 sm:p-8 text-center">
          <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto mb-3" />
          <h2 className="text-xl font-bold">Project posted!</h2>
          <p className="text-sm text-muted-foreground mt-1 mb-6">
            Your project is live. Professionals can now send proposals, and you'll get a notification the moment one lands.
          </p>
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={onClose}>Done</Button>
            <Button
              className="flex-1"
              onClick={() => {
                onClose();
                router.push(`/client/dashboard/projects/${createdId}`);
              }}
            >
              View Project
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const animationClass = direction === "forward" ? "animate-step-in" : "animate-step-in-back";
  const budgetSummary = budgetUnknown
    ? "Budget Not Set"
    : formatBudgetRange(
        budgetType === "fixed" ? Number(budgetAmount) || 0 : Number(hourlyMin) || 0,
        budgetType === "fixed" ? Number(budgetAmount) || 0 : Number(hourlyMax) || 0,
        budgetType === "hourly"
      );

  const handleImageFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const remaining = 8 - imageUrls.length;
    if (remaining <= 0) return toast.error("You can attach up to 8 images");
    const picked = Array.from(files).slice(0, remaining);
    setUploadingImages(true);
    try {
      const uploaded = await Promise.all(picked.map((f) => api.uploadFile(f, "project_image")));
      setImageUrls((prev) => [...prev, ...uploaded.map((u) => u.url)]);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not upload image");
    } finally {
      setUploadingImages(false);
    }
  };

  const handleVideoFile = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    setUploadingVideo(true);
    try {
      const uploaded = await api.uploadFile(file, "project_video");
      setVideoUrl(uploaded.url);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not upload video");
    } finally {
      setUploadingVideo(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4">
      <div className="w-full sm:max-w-lg max-h-[90vh] overflow-y-auto bg-background rounded-t-2xl sm:rounded-2xl border shadow-lg p-6">
        <div className="flex items-start justify-between gap-3 mb-1">
          <div>
            <h2 className="text-lg font-bold">Post a New Project</h2>
            <p className="text-xs text-muted-foreground mt-0.5">A few quick questions, then your project goes live for professionals to bid on.</p>
          </div>
          <button onClick={onClose} className="shrink-0 text-muted-foreground hover:text-foreground p-1" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Step progress */}
        <div className="my-5">
          <div className="flex items-center gap-1.5">
            {POST_PROJECT_STEPS.map((_, i) => (
              <div key={i} className={`h-1.5 flex-1 rounded-full transition-colors ${i <= step ? "bg-primary" : "bg-muted"}`} />
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Step {step + 1} of {POST_PROJECT_STEPS.length} · <span className="font-medium text-foreground">{POST_PROJECT_STEPS[step]}</span>
          </p>
        </div>

        {restoredDraft && (
          <div className="mb-4 flex items-center justify-between gap-2 rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-xs">
            <span className="text-muted-foreground">Resumed from your saved draft.</span>
            <button type="button" onClick={clearDraft} className="font-medium text-primary hover:underline">
              Start over
            </button>
          </div>
        )}

        <form onSubmit={step === POST_PROJECT_STEPS.length - 1 ? handleSubmit : (e) => e.preventDefault()}>
          <div key={step} className={animationClass}>
            {/* Step 0: What you need */}
            {step === 0 && (
              <div className="space-y-1.5">
                <label className="text-sm font-medium" htmlFor="pp-need">Describe the work you need *</label>
                <textarea
                  id="pp-need"
                  rows={4}
                  value={needText}
                  onChange={(e) => onNeedChange(e.target.value)}
                  placeholder="e.g. Renovate a 3-bedroom house in Lekki, mostly tiling, painting and a new kitchen"
                  className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
                />
                {needText.trim() && (
                  <p className="text-xs text-muted-foreground">
                    We'll file this under <span className="font-medium text-foreground">{inferredCategoryLabel}</span>. You can adjust that on the next step.
                  </p>
                )}
              </div>
            )}

            {/* Step 1: Project details */}
            {step === 1 && (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium" htmlFor="pp-title">Project Title *</label>
                  <Input id="pp-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. 3-bedroom bungalow renovation" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium" htmlFor="pp-location">Location</label>
                  <Input id="pp-location" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Lekki, Lagos" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium" htmlFor="pp-category">Category</label>
                  <select
                    id="pp-category"
                    value={effectiveCategoryId}
                    onChange={(e) => {
                      setCategoryTouched(true);
                      setCategoryId(e.target.value);
                    }}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                  </select>
                  <p className="text-xs text-muted-foreground">Professionals browse by category, so pick the closest match to your work.</p>
                </div>
              </div>
            )}

            {/* Step 2: Budget */}
            {step === 2 && (
              <div className="space-y-4">
                <label className="flex items-start gap-2 cursor-pointer rounded-lg border p-3">
                  <Checkbox checked={budgetUnknown} onCheckedChange={(v) => setBudgetUnknown(!!v)} className="mt-0.5" />
                  <span className="text-sm">
                    <span className="font-medium">I don't know the budget yet</span>
                    <span className="block text-xs text-muted-foreground mt-0.5">
                      We'll show professionals "Budget Not Set" so they can send you their own quote.
                    </span>
                  </span>
                </label>
                {!budgetUnknown && (
                <div className="flex gap-2">
                  {([["fixed", "Fixed price"], ["hourly", "Hourly rate"]] as const).map(([val, label]) => (
                    <button
                      type="button"
                      key={val}
                      onClick={() => setBudgetType(val)}
                      className={`flex-1 rounded-lg border py-2 text-xs font-medium capitalize transition-colors ${
                        budgetType === val ? "bg-primary text-primary-foreground border-primary" : "hover:border-primary"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                )}
                {!budgetUnknown && (budgetType === "fixed" ? (
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium" htmlFor="pp-budget">Estimated total (₦) *</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">₦</span>
                      <Input id="pp-budget" type="number" min="1" value={budgetAmount} onChange={(e) => setBudgetAmount(e.target.value)} placeholder="750000" className="pl-7" />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      A rough figure is fine. You'll fund milestones in escrow as the work progresses, so money only moves when you approve it.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium" htmlFor="pp-hourly-min">Min rate (₦/hr) *</label>
                      <Input id="pp-hourly-min" type="number" min="1" value={hourlyMin} onChange={(e) => setHourlyMin(e.target.value)} placeholder="2000" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium" htmlFor="pp-hourly-max">Max rate (₦/hr) *</label>
                      <Input id="pp-hourly-max" type="number" min="1" value={hourlyMax} onChange={(e) => setHourlyMax(e.target.value)} placeholder="5000" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Step 3: Skills */}
            {step === 3 && (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">Tap the skills your professional should have, or add your own.</p>
                <div className="flex flex-wrap gap-1.5">
                  {suggestedSkills.map((s) => {
                    const selected = skills.includes(s.label);
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => setSkills((prev) => (selected ? prev.filter((x) => x !== s.label) : [...prev, s.label]))}
                        className={`text-xs rounded-full border px-2.5 py-1.5 transition-colors ${
                          selected
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-background text-muted-foreground hover:bg-muted"
                        }`}
                      >
                        {s.label}
                      </button>
                    );
                  })}
                </div>
                <div className="flex gap-2">
                  <Input
                    value={customSkill}
                    onChange={(e) => setCustomSkill(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustomSkill(); } }}
                    placeholder="Or type your own, e.g. POP ceiling installation"
                  />
                  <Button type="button" size="sm" variant="outline" onClick={addCustomSkill} disabled={!customSkill.trim()}>Add</Button>
                </div>
                {skills.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {skills.map((s) => (
                      <span key={s} className="text-xs rounded-full bg-primary/10 text-primary px-2.5 py-1 flex items-center gap-1">
                        {s}
                        <button type="button" onClick={() => setSkills((prev) => prev.filter((x) => x !== s))} className="hover:text-foreground" aria-label={`Remove ${s}`}>×</button>
                      </span>
                    ))}
                  </div>
                )}

                {(mediaSettings?.images_enabled || mediaSettings?.video_enabled) && (
                  <div className="pt-2 border-t space-y-4">
                    <p className="text-xs font-medium text-muted-foreground">Photos or a video (optional) — helps professionals size up the job at a glance.</p>

                    {mediaSettings?.images_enabled && (
                      <div className="space-y-1.5">
                        <label className="text-sm font-medium">Photos</label>
                        <div className="flex flex-wrap gap-2">
                          {imageUrls.map((url) => (
                            <div key={url} className="relative h-16 w-16 rounded-md overflow-hidden border">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={url} alt="" className="h-full w-full object-cover" />
                              <button
                                type="button"
                                onClick={() => setImageUrls((prev) => prev.filter((u) => u !== url))}
                                className="absolute top-0.5 right-0.5 h-4 w-4 rounded-full bg-black/60 text-white text-[10px] flex items-center justify-center"
                                aria-label="Remove image"
                              >
                                ×
                              </button>
                            </div>
                          ))}
                          {imageUrls.length < 8 && (
                            <label className="h-16 w-16 rounded-md border border-dashed flex items-center justify-center text-xs text-muted-foreground cursor-pointer hover:border-primary">
                              {uploadingImages ? "…" : "+ Add"}
                              <input
                                type="file"
                                accept="image/png,image/jpeg,image/webp"
                                multiple
                                className="hidden"
                                disabled={uploadingImages}
                                onChange={(e) => { handleImageFiles(e.target.files); e.target.value = ""; }}
                              />
                            </label>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Up to 8 images{mediaSettings?.image_max_mb ? `, max ${mediaSettings.image_max_mb}MB each` : ""}.
                        </p>
                      </div>
                    )}

                    {mediaSettings?.video_enabled && (
                      <div className="space-y-1.5">
                        <label className="text-sm font-medium" htmlFor="pp-video-link">Video (upload or link)</label>
                        <Input
                          id="pp-video-link"
                          value={videoUrl}
                          onChange={(e) => setVideoUrl(e.target.value)}
                          placeholder="Paste a video link, or upload a file below"
                        />
                        <div className="flex items-center gap-2">
                          <label className="text-xs rounded-md border px-2.5 py-1.5 cursor-pointer hover:border-primary text-muted-foreground">
                            {uploadingVideo ? "Uploading…" : "Upload a video file"}
                            <input
                              type="file"
                              accept="video/mp4,video/quicktime,video/webm"
                              className="hidden"
                              disabled={uploadingVideo}
                              onChange={(e) => { handleVideoFile(e.target.files); e.target.value = ""; }}
                            />
                          </label>
                          {videoUrl && (
                            <button type="button" onClick={() => setVideoUrl("")} className="text-xs text-muted-foreground hover:text-foreground">
                              Clear
                            </button>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {mediaSettings?.video_max_mb ? `Max ${mediaSettings.video_max_mb}MB for uploads. ` : ""}A link (YouTube, etc.) works too.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Step 4: Review & post */}
            {step === 4 && (
              <div className="space-y-4">
                <div className="rounded-xl border divide-y text-sm">
                  <div className="flex justify-between gap-3 p-3"><span className="text-muted-foreground shrink-0">Title</span><span className="font-medium text-right">{title}</span></div>
                  <div className="flex justify-between gap-3 p-3"><span className="text-muted-foreground shrink-0">Category</span><span className="font-medium text-right">{categoryLabel}</span></div>
                  <div className="flex justify-between gap-3 p-3"><span className="text-muted-foreground shrink-0">Location</span><span className="font-medium text-right">{location || "-"}</span></div>
                  <div className="flex justify-between gap-3 p-3"><span className="text-muted-foreground shrink-0">Budget</span><span className="font-medium text-right">{budgetSummary}</span></div>
                  <div className="flex justify-between gap-3 p-3"><span className="text-muted-foreground shrink-0">Skills</span><span className="font-medium text-right">{skills.length ? skills.join(", ") : "-"}</span></div>
                  {(imageUrls.length > 0 || videoUrl) && (
                    <div className="flex justify-between gap-3 p-3">
                      <span className="text-muted-foreground shrink-0">Media</span>
                      <span className="font-medium text-right">
                        {[imageUrls.length > 0 ? `${imageUrls.length} photo${imageUrls.length === 1 ? "" : "s"}` : null, videoUrl ? "1 video" : null].filter(Boolean).join(", ")}
                      </span>
                    </div>
                  )}
                </div>
                <div className="max-h-40 overflow-y-auto rounded-md border border-input bg-muted/30 p-3 text-xs text-muted-foreground whitespace-pre-wrap">
                  {projectTerms?.body?.trim() || DEFAULT_PROJECT_TERMS}
                </div>
                <label className="flex items-start gap-2 cursor-pointer">
                  <Checkbox checked={termsAgreed} onCheckedChange={(v) => setTermsAgreed(!!v)} className="mt-0.5" />
                  <span className="text-sm text-muted-foreground">
                    I have read and accept the {projectTerms?.title?.trim() || "project posting terms"}
                  </span>
                </label>
              </div>
            )}
          </div>

          {/* Nav buttons */}
          <div className="mt-7 flex gap-3">
            {step > 0 && (
              <Button type="button" variant="outline" onClick={goBack}>
                <ArrowLeft className="h-4 w-4 mr-1" /> Back
              </Button>
            )}
            {step < POST_PROJECT_STEPS.length - 1 ? (
              <Button type="button" className="flex-1" onClick={goNext}>
                Continue <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            ) : (
              <Button type="submit" className="flex-1" disabled={submitting || !termsAgreed}>
                {submitting ? "Posting..." : "Post Project"}
                {!submitting && <CheckCircle2 className="h-4 w-4 ml-1" />}
              </Button>
            )}
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
  const { unreadByProject } = useProjectUnread();

  useEffect(() => {
    Promise.all([api.myProjects(), api.professionals()])
      .then(([p, pros]) => {
        setProjects(p);
        setProfessionals(pros.slice(0, 4));
      })
      .catch(() => toast.error("Could not load dashboard data"))
      .finally(() => setLoading(false));
  }, []);

  const activeCount = projects.filter((p) => p.status === "in_progress" || p.status === "review").length;
  const reviewCount = projects.filter((p) => p.status === "review").length;
  const openProjects = projects.filter((p) => p.status === "open");
  const proposalsWaiting = openProjects.reduce((sum, p) => sum + p.bid_count, 0);
  // Nothing is actually committed until funds hit escrow; this is the
  // combined budget range the client has advertised across their projects.
  const totalBudget = projects.reduce((sum, p) => sum + p.budget_max, 0);
  const totalProposals = projects.reduce((sum, p) => sum + p.bid_count, 0);

  // ─── Account readiness / "hire with confidence" checklist ───────────────────
  const checklist = [
    { key: "email", label: "Verify your email address", done: !!user?.email_verified, href: "/client/dashboard/settings" },
    { key: "kyc", label: "Verify your identity", done: user?.kyc_status === "verified", href: "/client/dashboard/settings?tab=verification" },
    { key: "wallet", label: "Fund your wallet", done: (user?.wallet_balance || 0) > 0, href: "/client/dashboard/payments" },
    { key: "project", label: "Post your first project", done: projects.length > 0, href: "/client/dashboard/projects" },
    { key: "company", label: "Add your company profile", done: !!user?.company_name, href: "/client/dashboard/settings?tab=company" },
  ] as const;
  const readiness = Math.round((checklist.filter((c) => c.done).length / checklist.length) * 100);

  // One clear next action, driven by the highest-leverage gap.
  const kyc = user?.kyc_status;
  const heroAction: { text: string; label: string; href: string | null } = !user?.email_verified
    ? { text: "Verify your email to secure your account", label: "Verify Email", href: "/client/dashboard/settings" }
    : kyc === "pending"
      ? { text: "Your identity verification is under review", label: "Check Status", href: "/client/dashboard/settings?tab=verification" }
      : kyc !== "verified"
        ? { text: "Verify your identity to message professionals and hire with confidence", label: "Verify Identity", href: "/client/dashboard/settings?tab=verification" }
        : (user?.wallet_balance || 0) <= 0
          ? { text: "Fund your wallet so you can pay for work through escrow", label: "Fund Wallet", href: "/client/dashboard/payments" }
          : projects.length === 0
            ? { text: "Post your first project and start receiving proposals", label: "Post Project", href: null }
            : proposalsWaiting > 0
              ? { text: `You have ${proposalsWaiting} proposal${proposalsWaiting === 1 ? "" : "s"} waiting for review`, label: "Review Proposals", href: "/client/dashboard/projects" }
              : { text: "Your projects are all set. Post another or browse professionals.", label: "Post Project", href: null };

  return (
    <div className="space-y-6">
      {/* Hero: greeting + the one thing worth doing next + account readiness */}
      <div className="rounded-2xl border bg-gradient-to-br from-primary to-primary/80 text-primary-foreground p-6 md:p-7">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold">Welcome back{user ? `, ${user.first_name}` : ""} 👋</h1>
            <p className="text-primary-foreground/85 text-sm mt-1">{heroAction.text}</p>
            <div className="mt-4 max-w-xs">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-primary-foreground/85">Account readiness</span>
                <span className="font-semibold">{readiness}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-white/25 overflow-hidden">
                <div className="h-full rounded-full bg-white transition-all" style={{ width: `${readiness}%` }} />
              </div>
            </div>
          </div>
          {heroAction.href ? (
            <Link href={heroAction.href}>
              <Button size="sm" className="bg-background text-foreground hover:bg-background/90 shrink-0">
                {heroAction.label}
              </Button>
            </Link>
          ) : (
            <Button size="sm" className="bg-background text-foreground hover:bg-background/90 shrink-0" onClick={onPostProject}>
              <Plus className="h-3.5 w-3.5 mr-1" /> {heroAction.label}
            </Button>
          )}
        </div>
      </div>

      {/* Meaningful numbers: work in motion, incoming proposals, and money */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Active Projects" value={String(activeCount)} icon={Briefcase} color="emerald" />
        <StatCard label="Proposals Received" value={String(totalProposals)} icon={FileText} color="blue" />
        <StatCard label="In Review" value={String(reviewCount)} icon={Clock} color="amber" />
        <StatCard label="Total Budget" value={fmtNaira(totalBudget)} icon={DollarSign} />
      </div>

      {/* Wallet + open pipeline */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Link
          href="/client/dashboard/payments"
          className="rounded-xl border bg-background p-5 flex items-center justify-between gap-3 hover:shadow-sm hover:border-primary/40 transition-all"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
              <Wallet className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Wallet Balance</p>
              <p className="text-xl font-bold">{fmtNaira(user?.wallet_balance || 0)}</p>
            </div>
          </div>
          <span className="text-xs font-medium text-primary flex items-center gap-0.5 shrink-0">
            Manage payments <ChevronRight className="h-3.5 w-3.5" />
          </span>
        </Link>
        <Link
          href="/client/dashboard/projects"
          className="rounded-xl border bg-background p-5 flex items-center justify-between gap-3 hover:shadow-sm hover:border-primary/40 transition-all"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Briefcase className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Open Projects</p>
              <p className="text-xl font-bold">{openProjects.length}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {proposalsWaiting > 0
                  ? `${proposalsWaiting} proposal${proposalsWaiting === 1 ? "" : "s"} waiting for review`
                  : "Browse professionals or post a new project"}
              </p>
            </div>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
        </Link>
      </div>

      <div className="grid lg:grid-cols-3 gap-4 items-start">
        {/* Recent projects take the main column */}
        <div className="lg:col-span-2 rounded-xl border bg-background">
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
                  <p className="font-medium text-sm truncate group-hover:text-primary transition-colors flex items-center gap-1.5 min-w-0">
                    <span className="truncate">{proj.title}</span>
                    <UnreadBadge count={unreadByProject[proj.id] || 0} />
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {proj.category.label} · {proj.bid_count} proposal{proj.bid_count === 1 ? "" : "s"}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-2 shrink-0">
                  <Badge className={`text-xs rounded-full ${STATUS_COLORS[proj.status]}`}>{proj.status.replace("_", " ")}</Badge>
                  <span className="text-xs font-medium">{formatBudgetRange(proj.budget_min, proj.budget_max, proj.budget_type === "hourly")}</span>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 hidden sm:block" />
              </Link>
            ))}
          </div>
        </div>

        {/* The path to a smooth hire */}
        <div className="rounded-xl border bg-background">
          <div className="p-5 border-b">
            <h2 className="font-semibold flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-primary" /> Hire with confidence
            </h2>
            <p className="text-xs text-muted-foreground mt-1">A few quick steps set you up for a smooth hire.</p>
          </div>
          <div className="divide-y">
            {checklist.map((item) => (
              <Link
                key={item.key}
                href={item.href}
                className={`flex items-center gap-3 p-3.5 ${item.done ? "" : "hover:bg-muted/40 transition-colors group"}`}
              >
                {item.done ? (
                  <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
                ) : (
                  <span className="h-5 w-5 rounded-full border-2 border-muted-foreground/40 shrink-0 flex items-center justify-center">
                    <ChevronRight className="h-3 w-3 text-muted-foreground/60" />
                  </span>
                )}
                <span
                  className={`text-sm flex-1 min-w-0 ${item.done ? "text-muted-foreground" : "font-medium group-hover:text-primary"}`}
                >
                  {item.label}
                </span>
                {!item.done && <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Recommended professionals */}
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

const PROJECT_FILTERS: Array<{ key: string; label: string }> = [
  { key: "all", label: "All" },
  { key: "open", label: "Open" },
  { key: "in_progress", label: "In Progress" },
  { key: "review", label: "Review" },
  { key: "completed", label: "Completed" },
  { key: "cancelled", label: "Closed" },
];

export function ClientProjects({ onPostProject, refreshKey }: { onPostProject: () => void; refreshKey: number }) {
  const [projects, setProjects] = useState<ProjectOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const { unreadByProject } = useProjectUnread();
  // A saved Post-a-Project draft (localStorage, written by PostProjectDialog)
  // gets a "continue where you left off" card at the top of the page.
  const [draft, setDraft] = useState<PostProjectDraft | null>(null);
  const [draftDismissed, setDraftDismissed] = useState(false);

  const load = () => {
    setLoading(true);
    api.myProjects().then(setProjects).catch(() => toast.error("Could not load projects")).finally(() => setLoading(false));
  };

  useEffect(load, [refreshKey]);

  // Re-read the draft on mount and after every refresh (e.g. right after a
  // project is posted, when the draft has been cleared).
  useEffect(() => {
    const d = loadPostDraft();
    setDraft(d && !isEmptyPostDraft(d) ? d : null);
    setDraftDismissed(false);
  }, [refreshKey]);

  const filtered = filter === "all" ? projects : projects.filter((p) => p.status === filter);
  const draftSummary = draft ? (draft.title.trim() || draft.needText.trim() || "Your unfinished project").slice(0, 80) : "";

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-2xl font-bold">My Projects</h1>
        <Button onClick={onPostProject}><Plus className="h-4 w-4 mr-1" /> Post New Project</Button>
      </div>
      {draft && !draftDismissed && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-primary/30 bg-primary/5 p-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <FileEdit className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold">Continue posting your draft</p>
              <p className="text-xs text-muted-foreground mt-0.5 truncate">
                {draftSummary} · left off at {POST_PROJECT_STEPS[draft.step]}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button size="sm" onClick={onPostProject}>
              Continue posting
            </Button>
            <button
              onClick={() => setDraftDismissed(true)}
              className="p-1 text-muted-foreground hover:text-foreground"
              aria-label="Dismiss draft reminder"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
      <div className="flex gap-2 flex-wrap">
        {PROJECT_FILTERS.map((f) => {
          const count = f.key === "all" ? projects.length : projects.filter((p) => p.status === f.key).length;
          return (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`text-xs rounded-full border px-3 py-1.5 font-medium transition-colors ${
                filter === f.key ? "bg-primary text-primary-foreground border-primary" : "bg-background text-muted-foreground hover:bg-muted"
              }`}
            >
              {f.label} ({count})
            </button>
          );
        })}
      </div>
      <div className="rounded-xl border bg-background divide-y">
        {loading && <ListSkeleton />}
        {!loading && filtered.length === 0 && (
          <p className="p-5 text-sm text-muted-foreground">No {filter === "all" ? "projects yet, post your first one." : `projects with this status yet.`}</p>
        )}
        {filtered.map((proj) => (
          <Link key={proj.id} href={`/client/dashboard/projects/${proj.id}`} className="flex w-full items-center gap-4 p-5 text-left hover:bg-muted/30">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 shrink-0">
              <Briefcase className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm flex items-center gap-1.5">{proj.title}<UnreadBadge count={unreadByProject[proj.id] || 0} /></p>
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
              <span className="text-sm font-semibold">{formatBudgetRange(proj.budget_min, proj.budget_max, proj.budget_type === "hourly")}</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

export function InviteToProjectDialog({ professional, onClose }: { professional: ProfessionalOut; onClose: () => void }) {
  const { user } = useAuth();
  const [projects, setProjects] = useState<ProjectOut[]>([]);
  const [projectId, setProjectId] = useState("");
  const [amount, setAmount] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const walletBalance = user?.wallet_balance || 0;
  const selectedProject = projects.find((p) => p.id === projectId);
  const proposedAmount = amount ? Number(amount) : 0;
  const insufficientFunds = proposedAmount > 0 && proposedAmount > walletBalance;

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
        <div className="rounded-lg bg-muted/50 border p-3 flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Your wallet balance</span>
          <span className="font-semibold">{fmtNaira(walletBalance)}</span>
        </div>
        {selectedProject && (
          <div className="rounded-lg bg-muted/50 border p-3 text-xs text-muted-foreground">
            Project budget: {fmtNaira(selectedProject.budget_min)} – {fmtNaira(selectedProject.budget_max)}
          </div>
        )}
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Proposed Amount (₦)</label>
          <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="e.g. 850000" />
          {insufficientFunds && (
            <p className="text-xs text-muted-foreground">
              Sending an invite doesn&apos;t charge your wallet, but you&apos;ll need at least this much in it when you fund the first milestone. <a href="/client/dashboard/payments" className="underline">Fund wallet</a>
            </p>
          )}
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
  const PAGE_SIZE = 12;
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const load = (reset: boolean) => {
    if (reset) {
      setLoading(true);
    } else {
      setLoadingMore(true);
    }
    const nextOffset = reset ? 0 : offset;
    api
      .professionals({
        q: search || undefined,
        category_id: categoryId || undefined,
        location: location || undefined,
        min_rating: minRating ? Number(minRating) : undefined,
        sort_by: sortBy || undefined,
        limit: PAGE_SIZE,
        offset: nextOffset,
      })
      .then((rows) => {
        setProfessionals((prev) => (reset ? rows : [...prev, ...rows]));
        setOffset(nextOffset + rows.length);
        setHasMore(rows.length === PAGE_SIZE);
      })
      .catch(() => toast.error("Could not load professionals"))
      .finally(() => {
        setLoading(false);
        setLoadingMore(false);
      });
  };

  useEffect(() => { load(true); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    api.favorites().then((favs) => setSavedIds(new Set(favs.filter((f) => f.target_type === "professional").map((f) => f.target_id)))).catch(() => {});
  }, []);

  // Apply filters immediately with the values passed in, so changing a
  // dropdown reloads without an explicit Apply click (and without reading
  // stale state from inside the previous render's closure).
  const applyFilters = (next: { category?: string; rating?: string; sort?: string; location?: string }) => {
    const cat = next.category !== undefined ? next.category : categoryId;
    const rat = next.rating !== undefined ? next.rating : minRating;
    const srt = next.sort !== undefined ? next.sort : sortBy;
    const loc = next.location !== undefined ? next.location : location;
    setCategoryId(cat);
    setMinRating(rat);
    setSortBy(srt);
    setLocation(loc);
    setLoading(true);
    api
      .professionals({
        q: search || undefined,
        category_id: cat || undefined,
        location: loc || undefined,
        min_rating: rat ? Number(rat) : undefined,
        sort_by: srt || undefined,
        limit: PAGE_SIZE,
        offset: 0,
      })
      .then((rows) => {
        setProfessionals(rows);
        setOffset(rows.length);
        setHasMore(rows.length === PAGE_SIZE);
      })
      .catch(() => toast.error("Could not load professionals"))
      .finally(() => setLoading(false));
  };

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
            onKeyDown={(e) => e.key === "Enter" && load(true)}
          />
        </div>
        <select
          value={categoryId}
          onChange={(e) => applyFilters({ category: e.target.value })}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="">All categories</option>
          {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
        </select>
        <Input
          placeholder="Location..."
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && applyFilters({ location })}
        />
      </div>
      <div className="grid sm:grid-cols-4 gap-3">
        <select
          value={minRating}
          onChange={(e) => applyFilters({ rating: e.target.value })}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="">Any rating</option>
          <option value="4.5">4.5+ stars</option>
          <option value="4">4+ stars</option>
          <option value="3">3+ stars</option>
        </select>
        <select
          value={sortBy}
          onChange={(e) => applyFilters({ sort: e.target.value })}
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
      <Button onClick={() => applyFilters({})} size="sm">Apply Filters</Button>
      {loading && <ListSkeleton rows={6} />}
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
              onClick={() => setInviteTarget(t)}
            >
              <UserPlus className="h-3.5 w-3.5 mr-1" /> Invite
            </Button>
          </div>
        ))}
      </div>
      {inviteTarget && (
        <InviteToProjectDialog professional={inviteTarget} onClose={() => setInviteTarget(null)} />
      )}
      {hasMore && !loading && (
        <div className="flex justify-center pt-2">
          <Button variant="outline" size="sm" onClick={() => load(false)} disabled={loadingMore}>
            {loadingMore ? "Loading..." : `Load more (${professionals.length} shown)`}
          </Button>
        </div>
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
  adjustment: { label: "Admin adjustment", sign: "+", className: "text-slate-600" },
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
      const result = await api.topupWallet(n, window.location.href);
      if (result.checkout_url) {
        // Live Monnify keys: the wallet isn't credited yet, the transaction
        // is pending until the customer actually pays on Monnify's checkout
        // and the webhook confirms it. Send them there instead of claiming
        // success early.
        window.location.href = result.checkout_url;
        return;
      }
      // No checkout_url means simulated mode (no live keys yet), where the
      // backend credits the wallet immediately so the flow can be tested.
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

// ─── Date-range filter helpers (shared by ClientPayments & TalentEarnings) ──
type DatePreset = "all" | "month" | "3months" | "6months" | "year";

const DATE_PRESETS: { key: DatePreset; label: string }[] = [
  { key: "all", label: "All Time" },
  { key: "year", label: "This Year" },
  { key: "6months", label: "Last 6 Months" },
  { key: "3months", label: "Last 3 Months" },
  { key: "month", label: "This Month" },
];

function filterByDateRange(txs: WalletTransactionOut[], preset: DatePreset, from: string, to: string): WalletTransactionOut[] {
  if (preset === "all" && !from && !to) return txs;
  return txs.filter((t) => {
    const d = new Date(t.created_at);
    if (from || to) {
      if (from && d < new Date(from)) return false;
      if (to) {
        const endDate = new Date(to);
        endDate.setHours(23, 59, 59, 999);
        if (d > endDate) return false;
      }
      return true;
    }
    const now = new Date();
    if (preset === "month") { const s = new Date(now.getFullYear(), now.getMonth(), 1); return d >= s; }
    if (preset === "3months") { const s = new Date(now); s.setMonth(s.getMonth() - 3); return d >= s; }
    if (preset === "6months") { const s = new Date(now); s.setMonth(s.getMonth() - 6); return d >= s; }
    if (preset === "year") return d >= new Date(now.getFullYear(), 0, 1);
    return true;
  });
}

function DateRangeFilter({ preset, setPreset, from, setFrom, to, setTo, onClear }: {
  preset: DatePreset; setPreset: (p: DatePreset) => void;
  from: string; setFrom: (v: string) => void;
  to: string; setTo: (v: string) => void;
  onClear: () => void;
}) {
  const hasFilter = preset !== "all" || !!from || !!to;
  return (
    <div className="flex flex-wrap items-center gap-2">
      {DATE_PRESETS.map((p) => (
        <button key={p.key} onClick={() => { setPreset(p.key); setFrom(""); setTo(""); }} className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${preset === p.key && !from && !to ? "bg-emerald-600 text-white border-emerald-600" : "text-muted-foreground hover:bg-muted"}`}>{p.label}</button>
      ))}
      <div className="flex items-center gap-1.5 ml-1">
        <span className="text-[11px] text-muted-foreground">From</span>
        <input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPreset("all"); }} className="text-xs border rounded px-1.5 py-0.5 w-[130px]" />
        <span className="text-[11px] text-muted-foreground">To</span>
        <input type="date" value={to} onChange={(e) => { setTo(e.target.value); setPreset("all"); }} className="text-xs border rounded px-1.5 py-0.5 w-[130px]" />
      </div>
      {hasFilter && (
        <button onClick={onClear} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-0.5"><X className="h-3 w-3" /> Clear</button>
      )}
    </div>
  );
}

export function ClientPayments() {
  const { user, refreshMe } = useAuth();
  const [txs, setTxs] = useState<WalletTransactionOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [fundOpen, setFundOpen] = useState(false);
  const [datePreset, setDatePreset] = useState<DatePreset>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const load = () => {
    setLoading(true);
    api.walletTransactions().then(setTxs).catch(() => toast.error("Could not load payments")).finally(() => setLoading(false));
  };
  useEffect(load, []);

  const filtered = filterByDateRange(txs, datePreset, dateFrom, dateTo);
  // What the client has actually put into project milestones, net of any
  // refunds. This intentionally does NOT try to split "still in escrow" vs
  // "released to the professional" — the `release` transaction amount is the
  // professional's net payout (platform fee already subtracted), so it can
  // never sum back up to the gross amount the client funded, which made a
  // fully-settled milestone look like it still had money stuck in escrow.
  // A single "money paid to milestones" figure is the number the client
  // actually cares about and it's always correct.
  const totalPaid = Math.max(
    filtered.filter((t) => t.type === "funding" && t.status === "successful").reduce((s, t) => s + t.amount, 0)
      - filtered.filter((t) => t.type === "refund" && t.status === "successful").reduce((s, t) => s + t.amount, 0),
    0
  );
  const hasDateFilter = datePreset !== "all" || !!dateFrom || !!dateTo;
  const clearDateFilter = () => { setDatePreset("all"); setDateFrom(""); setDateTo(""); };

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

      <div className="grid grid-cols-1 gap-4">
        <StatCard label="Paid to Milestones" value={fmtNaira(totalPaid)} icon={CheckCircle2} color="emerald" />
      </div>

      <div className="rounded-xl border bg-background">
        <div className="p-5 border-b">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <span className="font-semibold">Transaction History</span>
            <DateRangeFilter preset={datePreset} setPreset={setDatePreset} from={dateFrom} setFrom={setDateFrom} to={dateTo} setTo={setDateTo} onClear={clearDateFilter} />
          </div>
        </div>
        <div className="divide-y">
          {loading && <ListSkeleton />}
          {!loading && filtered.length === 0 && txs.length === 0 && (
            <div className="p-6 text-center space-y-2">
              <p className="text-sm text-muted-foreground">No transactions yet.</p>
              <Button size="sm" variant="outline" onClick={() => setFundOpen(true)}>Fund your wallet to get started</Button>
            </div>
          )}
          {!loading && filtered.length === 0 && txs.length > 0 && (
            <p className="p-4 text-sm text-muted-foreground">No transactions in the selected date range. <button onClick={clearDateFilter} className="underline text-emerald-600">Clear filter</button></p>
          )}
          {filtered.map((t) => {
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

// ─── Username field: live availability check + suggestions, shared by client & talent settings ───
function UsernameField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [status, setStatus] = useState<"idle" | "checking" | "available" | "taken" | "invalid" | "current">("idle");
  const [reason, setReason] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const { user } = useAuth();
  const original = user?.username || "";

  useEffect(() => {
    const trimmed = value.trim().toLowerCase();
    if (!trimmed) { setStatus("idle"); return; }
    if (trimmed === original) { setStatus("current"); return; }
    setStatus("checking");
    const t = setTimeout(() => {
      api.checkUsername(trimmed)
        .then((res) => {
          setStatus(res.available ? "available" : res.reason?.includes("3-20") ? "invalid" : "taken");
          setReason(res.reason || null);
        })
        .catch(() => setStatus("idle"));
    }, 400);
    return () => clearTimeout(t);
  }, [value, original]);

  const loadSuggestions = async () => {
    setLoadingSuggestions(true);
    try {
      const res = await api.usernameSuggestions();
      setSuggestions(res.suggestions);
    } catch {
      toast.error("Could not load suggestions");
    } finally {
      setLoadingSuggestions(false);
    }
  };

  return (
    <div className="space-y-1.5">
      <label className="text-sm">Username</label>
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">@</span>
          <Input
            value={value}
            onChange={(e) => onChange(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
            placeholder="yourname"
            maxLength={20}
            className="pl-7"
          />
        </div>
        <Button type="button" size="sm" variant="outline" onClick={loadSuggestions} disabled={loadingSuggestions}>
          {loadingSuggestions ? "..." : "Suggest"}
        </Button>
      </div>
      {status === "checking" && <p className="text-xs text-muted-foreground">Checking availability…</p>}
      {status === "available" && <p className="text-xs text-emerald-600">@{value} is available</p>}
      {status === "current" && <p className="text-xs text-muted-foreground">This is your current username</p>}
      {status === "taken" && <p className="text-xs text-red-600">Username taken</p>}
      {status === "invalid" && <p className="text-xs text-red-600">{reason || "Invalid username"}</p>}
      {suggestions.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {suggestions.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => { onChange(s); setSuggestions([]); }}
              className="text-xs rounded-full border px-2.5 py-1 hover:bg-muted transition-colors"
            >
              @{s}
            </button>
          ))}
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
  const [username, setUsername] = useState(user?.username || "");
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
      await api.updateClientProfile({
        first_name: firstName, last_name: lastName, phone, avatar_url: avatarUrl,
        ...(username.trim() && username.trim() !== (user?.username || "") ? { username: username.trim() } : {}),
      });
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
      <UsernameField value={username} onChange={setUsername} />
      <Button onClick={save} disabled={saving}>{saving ? "Saving..." : "Save Changes"}</Button>
    </div>
  );
}

function ClientCompanyTab() {
  const { user, refreshMe } = useAuth();
  const [companyName, setCompanyName] = useState(user?.company_name || "");
  const [industry, setIndustry] = useState(user?.industry || "");
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
        industry: industry || undefined,
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
      <div className="space-y-1.5"><label className="text-sm">Industry</label><Input value={industry} onChange={(e) => setIndustry(e.target.value)} placeholder="e.g. Real Estate Development, Construction, Facilities" /></div>
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

const BUSINESS_STATUS_COPY: Record<string, { label: string; color: string; blurb: string }> = {
  unverified: { label: "Not submitted", color: "bg-gray-100 text-gray-600", blurb: "Submit your CAC registration to earn the Verified Business badge on your profile." },
  pending: { label: "Under review", color: "bg-amber-100 text-amber-700", blurb: "Your CAC documentation is being reviewed by our team." },
  verified: { label: "Verified", color: "bg-emerald-100 text-emerald-700", blurb: "Your business is verified. The badge now shows on your profile." },
  rejected: { label: "Not approved", color: "bg-red-100 text-red-600", blurb: "Your submission wasn't approved. Review the note below and resubmit." },
};

function ClientBusinessVerificationCard() {
  const { user, refreshMe } = useAuth();
  const [cacNumber, setCacNumber] = useState("");
  const [docUrl, setDocUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const status = user?.business_verification_status || "unverified";
  const copy = BUSINESS_STATUS_COPY[status] || BUSINESS_STATUS_COPY.unverified;

  const uploadDoc = async (file: File) => {
    setUploading(true);
    try {
      const { url } = await api.uploadFile(file);
      setDocUrl(url);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not upload document");
    } finally {
      setUploading(false);
    }
  };

  const submit = async () => {
    if (!cacNumber.trim() || !docUrl) {
      toast.error("Provide your CAC number and upload the registration document");
      return;
    }
    setSubmitting(true);
    try {
      await api.submitBusinessVerification(cacNumber.trim(), docUrl);
      await refreshMe();
      toast.success("Submitted for review");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not submit for verification");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="rounded-xl border bg-background p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Business Verification (CAC)</h2>
        <Badge className={`text-xs rounded-full ${copy.color}`}>{copy.label}</Badge>
      </div>
      <p className="text-xs text-muted-foreground">{copy.blurb}</p>
      {status !== "verified" && status !== "pending" && (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-sm">CAC Registration Number</label>
            <Input value={cacNumber} onChange={(e) => setCacNumber(e.target.value)} placeholder="RC1234567" />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm">CAC Certificate / Document</label>
            <input
              type="file"
              accept="image/*,.pdf"
              onChange={(e) => e.target.files?.[0] && uploadDoc(e.target.files[0])}
              className="text-xs"
              disabled={uploading}
            />
            {docUrl && <p className="text-xs text-emerald-600">Document uploaded</p>}
          </div>
          <Button size="sm" onClick={submit} disabled={submitting || uploading}>
            {submitting ? "Submitting..." : "Submit for Verification"}
          </Button>
        </div>
      )}
    </div>
  );
}

function ClientPreferencesTab() {
  const { user, refreshMe } = useAuth();
  const [preferredCategories, setPreferredCategories] = useState<string[]>(user?.preferred_categories || []);
  const [emailNotifs, setEmailNotifs] = useState(user?.email_notifications_enabled ?? true);
  const [saving, setSaving] = useState(false);
  const [savingNotifs, setSavingNotifs] = useState(false);

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

  const toggleEmailNotifs = async () => {
    setSavingNotifs(true);
    try {
      await api.updateMe({ email_notifications_enabled: !emailNotifs });
      setEmailNotifs(!emailNotifs);
      await refreshMe();
      toast.success(emailNotifs ? "Email notifications disabled" : "Email notifications enabled");
    } catch {
      toast.error("Could not update notification settings");
    } finally {
      setSavingNotifs(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Preferred Categories */}
      <div className="rounded-xl border bg-background p-6 space-y-3">
        <h2 className="font-semibold">Preferred Categories</h2>
        <p className="text-xs text-muted-foreground">Select the kind of work you typically hire for, this shows on your profile.</p>
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

      {/* Notifications */}
      <div className="rounded-xl border bg-background p-6 space-y-4">
        <h2 className="font-semibold">Notifications</h2>
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium">Email notifications</p>
            <p className="text-xs text-muted-foreground">Get emails for messages, milestone updates, disputes, and other account activity.</p>
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
        <div className="h-px bg-border" />
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium">Proposal updates</p>
            <p className="text-xs text-muted-foreground">Get notified when a professional responds to your project.</p>
          </div>
          <div className="text-xs text-muted-foreground bg-muted rounded-full px-2.5 py-0.5">Always on</div>
        </div>
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium">Milestone alerts</p>
            <p className="text-xs text-muted-foreground">Get notified when milestones are submitted for your review or funded.</p>
          </div>
          <div className="text-xs text-muted-foreground bg-muted rounded-full px-2.5 py-0.5">Always on</div>
        </div>
      </div>

      {/* Communication preferences */}
      <div className="rounded-xl border bg-background p-6 space-y-4">
        <h2 className="font-semibold">Communication</h2>
        <p className="text-xs text-muted-foreground">Control how professionals can reach you.</p>
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium">Allow direct messages</p>
            <p className="text-xs text-muted-foreground">Professionals can message you directly before being hired.</p>
          </div>
          <div className="text-xs text-emerald-600 bg-emerald-50 rounded-full px-2.5 py-0.5">Enabled</div>
        </div>
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium">Show on marketplace</p>
            <p className="text-xs text-muted-foreground">Your projects are visible to all professionals in the marketplace.</p>
          </div>
          <div className="text-xs text-emerald-600 bg-emerald-50 rounded-full px-2.5 py-0.5">Enabled</div>
        </div>
      </div>
    </div>
  );
}

export function ClientSettings() {
  // Deep-linkable: ?tab=verification etc. so the dashboard's "hire with
  // confidence" checklist can jump straight to the right settings tab.
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<"profile" | "company" | "preferences" | "verification" | "security">(() => {
    const t = searchParams.get("tab");
    return t === "profile" || t === "company" || t === "preferences" || t === "verification" || t === "security" ? t : "profile";
  });

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
      {tab === "company" && (
        <div className="space-y-5">
          <ClientCompanyTab />
          <ClientBusinessVerificationCard />
        </div>
      )}
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
  const [projects, setProjects] = useState<ProjectOut[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    api.getClientPublic(user.id)
      .then((p) => {
        setPub(p);
        return Promise.all([
          api.reviewsForUser(user.id).then(setReviews).catch(() => {}),
          api.myProjects().then(setProjects).catch(() => {}),
        ]);
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
          {pub.payment_verified && (
            <span className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-emerald-700 bg-emerald-100" title="Has successfully funded a project before">
              <Wallet className="h-3.5 w-3.5" /> Payment verified
            </span>
          )}
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

      <div className="rounded-xl border bg-background overflow-hidden">
        <div className="flex items-center justify-between p-6 pb-3">
          <h2 className="text-sm font-semibold">Posted Projects ({projects.length})</h2>
          {projects.length > 0 && (
            <Link href="/client/dashboard/projects" className="text-xs font-medium text-primary hover:underline">
              View all
            </Link>
          )}
        </div>
        {projects.length === 0 ? (
          <p className="px-6 pb-6 text-sm text-muted-foreground">No projects posted yet.</p>
        ) : (
          <div className="divide-y">
            {projects.slice(0, 5).map((proj) => (
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
                  <span className="text-sm font-semibold">{formatBudgetRange(proj.budget_min, proj.budget_max, proj.budget_type === "hourly")}</span>
                </div>
              </Link>
            ))}
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
  const [profile, setProfile] = useState<ProfessionalOut | null>(null);
  const [loading, setLoading] = useState(true);
  const { unreadByProject } = useProjectUnread();

  useEffect(() => {
    Promise.all([api.myProjects(), api.myBids(), api.myProfile()])
      .then(([p, b, prof]) => {
        setProjects(p);
        setBids(b);
        setProfile(prof);
      })
      .catch(() => toast.error("Could not load dashboard data"))
      .finally(() => setLoading(false));
  }, []);

  const activeJobs = projects.filter((p) => p.status === "in_progress" || p.status === "review");

  // ─── Profile strength / "get hired faster" checklist ───────────────────────
  const checklist = [
    { key: "photo", label: "Add a profile photo", done: !!user?.avatar_url, href: "/talent/dashboard/profile" },
    { key: "titleBio", label: "Add a title and bio", done: !!(profile?.title && profile?.bio), href: "/talent/dashboard/profile" },
    { key: "skills", label: "Add your skills", done: (profile?.skills?.length || 0) > 0, href: "/talent/dashboard/profile" },
    { key: "portfolio", label: "Add portfolio items", done: (profile?.portfolio_items?.length || 0) > 0, href: "/talent/dashboard/profile" },
    { key: "identity", label: "Verify your identity", done: (profile?.tier || 1) >= 2, href: "/talent/dashboard/settings?tab=verification" },
    { key: "address", label: "Verify your address", done: profile?.address_verification_status === "verified", href: "/talent/dashboard/settings?tab=verification" },
    { key: "payout", label: "Add your bank details", done: !!profile?.has_payout_details, href: "/talent/dashboard/settings?tab=payout" },
  ] as const;
  const strength = profile
    ? Math.round((checklist.filter((c) => c.done).length / checklist.length) * 100)
    : 0;
  const profileContentDone = ["photo", "titleBio", "skills", "portfolio"].every((key) => checklist.find((c) => c.key === key)!.done);
  const needsVerification = !!profile && ((profile.tier || 1) < 2 || profile.address_verification_status !== "verified");

  // One clear next action, driven by the highest-leverage gap.
  const heroAction = needsVerification
    ? { text: "Verify your identity and address to unlock more proposals", label: "Verify Now", href: "/talent/dashboard/settings?tab=verification" }
    : profile && !profile.has_payout_details
      ? { text: "Add your bank details so payouts can reach you", label: "Add Bank Details", href: "/talent/dashboard/settings?tab=payout" }
      : profile && !profileContentDone
        ? { text: "Complete your profile so clients can find you", label: "Complete Profile", href: "/talent/dashboard/profile" }
        : profile
          ? { text: "You're all set. Time to find your next job.", label: "Find Work", href: "/talent/dashboard/find-work" }
          : null;

  const tier = profile?.tier || 1;
  const tierHint =
    tier === 1
      ? "1 proposal/day · 1 active job, verify your NIN to unlock more"
      : tier === 2
        ? "10 proposals/day · 5 active jobs, add proof of address to go uncapped"
        : "No caps, you're fully verified";

  return (
    <div className="space-y-6">
      {/* Hero: greeting + the one thing worth doing next + profile strength */}
      <div className="rounded-2xl border bg-gradient-to-br from-emerald-600 to-emerald-500 text-white p-6 md:p-7">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold">Welcome back{user ? `, ${user.first_name}` : ""} 👋</h1>
            <p className="text-white/85 text-sm mt-1">{heroAction?.text ?? "Here's what's happening with your jobs."}</p>
            {profile && (
              <div className="mt-4 max-w-xs">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-white/85">Profile strength</span>
                  <span className="font-semibold">{strength}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-white/25 overflow-hidden">
                  <div className="h-full rounded-full bg-white transition-all" style={{ width: `${strength}%` }} />
                </div>
              </div>
            )}
          </div>
          {heroAction && (
            <Link href={heroAction.href}>
              <Button size="sm" className="bg-white text-emerald-700 hover:bg-white/90 shrink-0">
                {heroAction.label === "Find Work" && <Search className="h-3.5 w-3.5 mr-1" />}
                {heroAction.label}
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* Wallet + tier */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Link href="/talent/dashboard/earnings" className="rounded-xl border bg-background p-5 hover:shadow-sm transition-shadow flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
              <Wallet className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Wallet Balance</p>
              <p className="text-xl font-bold">{fmtNaira(user?.wallet_balance || 0)}</p>
            </div>
          </div>
          <span className="text-xs text-primary font-medium shrink-0">Earnings →</span>
        </Link>
        <div className="rounded-xl border bg-background p-5 flex items-center justify-between gap-3 min-w-0">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Talent Tier</p>
              <p className="text-sm font-bold">Tier {tier} of 3</p>
              <p className="text-xs text-muted-foreground leading-snug">{tierHint}</p>
            </div>
          </div>
          {profile && tier < 3 && (
            <Link href="/talent/dashboard/settings?tab=verification" className="shrink-0">
              <Button size="sm" variant="outline">Upgrade</Button>
            </Link>
          )}
        </div>
      </div>

      {/* Meaningful numbers: work in progress, pipeline, and proven track record */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Active Jobs" value={String(activeJobs.length)} icon={Briefcase} color="emerald" />
        <StatCard label="Proposals Sent" value={String(bids.length)} icon={FileText} color="blue" />
        <StatCard label="Completed Jobs" value={String(profile?.stats?.completed_projects ?? 0)} icon={CheckCircle2} color="amber" />
        <StatCard
          label="Job Success"
          value={profile?.stats?.job_success_rate != null ? `${profile.stats.job_success_rate}%` : "-"}
          icon={ShieldCheck}
          color="primary"
        />
      </div>

      <div className="grid lg:grid-cols-3 gap-4 items-start">
        {/* Active jobs take the main column */}
        <div className="lg:col-span-2 rounded-xl border bg-background">
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
                  <p className="font-medium text-sm truncate group-hover:text-primary transition-colors flex items-center gap-1.5 min-w-0">
                    <span className="truncate">{j.title}</span>
                    <UnreadBadge count={unreadByProject[j.id] || 0} />
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {j.category.label}
                    {j.client_company_name ? ` · ${j.client_company_name}` : ""}
                  </p>
                  <div className="mt-2 flex items-center gap-2">
                    <div className="flex-1 h-1.5 rounded-full bg-muted">
                      <div className="h-1.5 rounded-full bg-emerald-500" style={{ width: `${j.progress}%` }} />
                    </div>
                    <span className="text-xs text-muted-foreground">{j.progress}%</span>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-semibold">{formatBudgetRange(j.budget_min, j.budget_max, j.budget_type === "hourly")}</p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 hidden sm:block" />
              </Link>
            ))}
          </div>
        </div>

        {/* The path to more work */}
        <div className="rounded-xl border bg-background">
          <div className="p-5 border-b">
            <h2 className="font-semibold flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" /> Get hired faster
            </h2>
            <p className="text-xs text-muted-foreground mt-1">Complete these to unlock more proposals and win more jobs.</p>
          </div>
          <div className="divide-y">
            {!profile && <ListSkeleton />}
            {checklist.map((item) => (
              <Link
                key={item.key}
                href={item.href}
                className={`flex items-center gap-3 p-3.5 ${item.done ? "" : "hover:bg-muted/40 transition-colors group"}`}
              >
                {item.done ? (
                  <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
                ) : (
                  <span className="h-5 w-5 rounded-full border-2 border-muted-foreground/40 shrink-0 flex items-center justify-center">
                    <ChevronRight className="h-3 w-3 text-muted-foreground/60" />
                  </span>
                )}
                <span
                  className={`text-sm flex-1 min-w-0 ${
                    item.done ? "text-muted-foreground" : "font-medium group-hover:text-primary"
                  }`}
                >
                  {item.label}
                </span>
                {!item.done && <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Recent proposals */}
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
    if (Number(amount) <= 0) return toast.error("Enter an amount greater than zero");
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
        <p className="text-sm text-muted-foreground mb-1">{project.title}</p>
        <p className="text-xs text-emerald-600 mb-4 font-medium">Budget: {formatBudgetRange(project.budget_min, project.budget_max, project.budget_type === "hourly")}</p>
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
          <div className="rounded-lg bg-emerald-50 text-emerald-700 p-3 flex items-start gap-2 text-xs">
            <ShieldCheck className="h-4 w-4 shrink-0 mt-0.5" />
            <span>
              Work is paid milestone-by-milestone through escrow: the client funds each stage, and you get paid once they approve it. No chasing invoices.
            </span>
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
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const PAGE_SIZE = 9;

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

  const fetchPage = (nextOffset: number, append: boolean) => {
    setLoading(true);
    api
      .projects({
        q: search || undefined,
        category_id: categoryId || undefined,
        location: location || undefined,
        budget_min: budgetMin ? Number(budgetMin) : undefined,
        budget_max: budgetMax ? Number(budgetMax) : undefined,
        sort_by: sortBy || undefined,
        limit: PAGE_SIZE,
        offset: nextOffset,
      })
      .then((page) => {
        setProjects((prev) => (append ? [...prev, ...page] : page));
        setHasMore(page.length === PAGE_SIZE);
        setOffset(nextOffset + page.length);
      })
      .catch(() => toast.error("Could not load projects"))
      .finally(() => setLoading(false));
    loadMyBids();
  };

  const applyFilters = (overrides: { category?: string; sort?: string }) => {
    const cat = overrides.category !== undefined ? overrides.category : categoryId;
    const srt = overrides.sort !== undefined ? overrides.sort : sortBy;
    setCategoryId(cat);
    setSortBy(srt);
    setLoading(true);
    api
      .projects({
        q: search || undefined,
        category_id: cat || undefined,
        location: location || undefined,
        budget_min: budgetMin ? Number(budgetMin) : undefined,
        budget_max: budgetMax ? Number(budgetMax) : undefined,
        sort_by: srt || undefined,
        limit: PAGE_SIZE,
        offset: 0,
      })
      .then((page) => {
        setProjects(page);
        setHasMore(page.length === PAGE_SIZE);
        setOffset(page.length);
      })
      .catch(() => toast.error("Could not load projects"))
      .finally(() => setLoading(false));
    loadMyBids();
  };

  const load = () => fetchPage(0, false);
  const loadMore = () => fetchPage(offset, true);

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
            onChange={(e) => applyFilters({ category: e.target.value })}
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
          onChange={(e) => applyFilters({ sort: e.target.value })}
          className="flex h-10 w-full sm:w-56 rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="">Sort: Newest</option>
          <option value="budget_asc">Budget: Low to High</option>
          <option value="budget_desc">Budget: High to Low</option>
          <option value="most_bids">Most Proposals</option>
        </select>
        <Button onClick={() => applyFilters({})} size="sm">Apply Filters</Button>
      </div>
      {loading && projects.length === 0 && <ListSkeleton />}
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
                  {proj.client_payment_verified && (
                    <span title="Payment verified"><Wallet className="h-3 w-3 text-emerald-600" /></span>
                  )}
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
                {formatBudgetRange(proj.budget_min, proj.budget_max, proj.budget_type === "hourly")}
              </span>
              {myBids[proj.id] && myBids[proj.id] !== "withdrawn" ? (
                <Badge className={`text-xs rounded-full ${BID_STATUS_COLORS[myBids[proj.id]]}`}>
                  {BID_STATUS_LABELS[myBids[proj.id]]}
                </Badge>
              ) : (
                <Link
                  href={`/talent/dashboard/find-work/${proj.id}`}
                  className="inline-flex items-center justify-center rounded-full bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium h-8 px-3"
                >
                  Express Interest
                </Link>
              )}
            </div>
          </div>
        ))}
      </div>
      {!loading && hasMore && (
        <div className="flex justify-center pt-2">
          <Button variant="outline" onClick={loadMore}>
            <ChevronDown className="h-4 w-4 mr-1" /> Load more projects
          </Button>
        </div>
      )}
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
                {formatBudgetRange(proj.budget_min, proj.budget_max, proj.budget_type === "hourly")}
              </span>
              {myBids[proj.id] && myBids[proj.id] !== "withdrawn" ? (
                <Badge className={`text-xs rounded-full ${BID_STATUS_COLORS[myBids[proj.id]]}`}>
                  {BID_STATUS_LABELS[myBids[proj.id]]}
                </Badge>
              ) : (
                <Link
                  href={`/talent/dashboard/find-work/${proj.id}`}
                  className="inline-flex items-center justify-center rounded-full bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium h-8 px-3"
                >
                  Express Interest
                </Link>
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
  const [datePreset, setDatePreset] = useState<DatePreset>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [hasPayoutDetails, setHasPayoutDetails] = useState<boolean | null>(null);

  const load = () => {
    setLoading(true);
    api.walletTransactions().then(setTxs).catch(() => toast.error("Could not load earnings")).finally(() => setLoading(false));
    api.myProfile().then((p) => setHasPayoutDetails(p.has_payout_details)).catch(() => undefined);
  };
  useEffect(load, []);

  const filtered = filterByDateRange(txs, datePreset, dateFrom, dateTo);
  const paid = filtered.filter((t) => t.type === "release" && t.status === "successful").reduce((s, t) => s + t.amount, 0);
  const withdrawn = filtered.filter((t) => t.type === "withdrawal" && t.status === "successful").reduce((s, t) => s + t.amount, 0);
  const balance = user?.wallet_balance || 0;
  const hasDateFilter = datePreset !== "all" || !!dateFrom || !!dateTo;

  const clearDateFilter = () => { setDatePreset("all"); setDateFrom(""); setDateTo(""); };

  const openWithdraw = () => {
    if (hasPayoutDetails === false) {
      toast.error("Add your bank details before withdrawing", {
        description: "You need a payout account on file so we know where to send the money.",
      });
      return;
    }
    setWithdrawOpen(true);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Earnings</h1>
        <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={openWithdraw}>
          <Wallet className="h-4 w-4 mr-1.5" /> Withdraw
        </Button>
      </div>

      {hasPayoutDetails === false && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-sm text-amber-800">You haven&apos;t added bank details yet, withdrawals won&apos;t work until you do.</p>
          <Link href="/talent/dashboard/settings?tab=payout">
            <Button size="sm" variant="outline" className="border-amber-300 text-amber-800 hover:bg-amber-100 shrink-0">Add Bank Details</Button>
          </Link>
        </div>
      )}

      <div className="rounded-xl border bg-gradient-to-br from-emerald-600 to-emerald-700 text-white p-6">
        <p className="text-xs text-emerald-100 uppercase tracking-wide font-medium">Wallet Balance</p>
        <p className="text-3xl font-bold mt-1">{fmtNaira(balance)}</p>
        <p className="text-xs text-emerald-100 mt-2">Available to withdraw to your bank account anytime.</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Total Earned" value={fmtNaira(paid)} icon={TrendingUp} color="emerald" />
        <StatCard label="Withdrawn" value={fmtNaira(withdrawn)} icon={CheckCircle2} />
        <StatCard label="Payouts" value={String(filtered.filter((t) => t.type === "release").length)} icon={Clock} />
      </div>
      <div className="rounded-xl border bg-background">
        <div className="p-5 border-b">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <span className="font-semibold">Transaction History</span>
            <DateRangeFilter preset={datePreset} setPreset={setDatePreset} from={dateFrom} setFrom={setDateFrom} to={dateTo} setTo={setDateTo} onClear={clearDateFilter} />
          </div>
        </div>
        <div className="divide-y">
          {loading && <ListSkeleton />}
          {!loading && filtered.length === 0 && txs.length === 0 && <p className="p-4 text-sm text-muted-foreground">No transactions yet.</p>}
          {!loading && filtered.length === 0 && txs.length > 0 && <p className="p-4 text-sm text-muted-foreground">No transactions in the selected date range. <button onClick={clearDateFilter} className="underline text-emerald-600">Clear filter</button></p>}
          {filtered.map((r) => {
            const isCredit = r.type === "release";
            const label = r.note || (isCredit ? r.project_title : TXN_TYPE_LABELS[r.type]?.label) || TXN_TYPE_LABELS[r.type]?.label;
            return (
              <div key={r.id} className="flex items-center justify-between p-4">
                {r.project_id && isCredit ? (
                  <Link href={`/talent/dashboard/active/${r.project_id}`} className="min-w-0 hover:underline">
                    <p className="text-sm font-medium truncate">{label}</p>
                    <p className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString()} · View project</p>
                  </Link>
                ) : (
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{label}</p>
                    <p className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</p>
                  </div>
                )}
                <div className="flex flex-col items-end gap-1 shrink-0">
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
  const [credFile, setCredFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!name) return toast.error("Certification name is required");
    setSubmitting(true);
    try {
      const credential_url = credFile ? (await api.uploadFile(credFile)).url : undefined;
      await api.addCertification({
        name,
        issuing_body: issuingBody || undefined,
        issued_date: issuedDate || undefined,
        expiry_date: expiryDate || undefined,
        credential_url,
      });
      toast.success("Certification added, submitted for badge review");
      setName(""); setIssuingBody(""); setIssuedDate(""); setExpiryDate(""); setCredFile(null); setOpen(false);
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
      <FileUploadField
        label="Credential document"
        description="A scan or photo of the certificate, so our team can verify it for your badge."
        file={credFile}
        onChange={setCredFile}
        disabled={submitting}
      />
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
              <TierTag tier={profile.tier} />
            </div>
            <p className="text-muted-foreground text-sm">{profile.title} · {profile.location || "Location not set"}</p>
            <div className="flex items-center gap-1 mt-1">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className={`h-3.5 w-3.5 ${i < Math.round(profile.rating) ? "fill-amber-400 text-amber-400" : "text-muted-foreground"}`} />
              ))}
              <span className="text-xs text-muted-foreground ml-1">{profile.rating || "New"} ({profile.review_count} reviews)</span>
            </div>
            <CertificationBadges certifications={profile.certifications} className="mt-2" />
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
  const [accounts, setAccounts] = useState<PayoutAccountOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [bankCode, setBankCode] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    api.payoutAccounts().then(setAccounts).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const submit = async () => {
    if (!bankCode || accountNumber.length < 10) return toast.error("Select a bank and enter a valid account number");
    setSubmitting(true);
    try {
      const bankName = NIGERIAN_BANKS.find((b) => b.code === bankCode)?.name;
      const res = await api.addPayoutAccount({ bank_code: bankCode, bank_name: bankName, account_number: accountNumber });
      toast.success(res.name_match ? "Bank account added" : "Bank account added — but the name doesn't match your profile, so you can't withdraw to it yet");
      setBankCode("");
      setAccountNumber("");
      setShowAddForm(false);
      load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not save this bank account");
    } finally {
      setSubmitting(false);
    }
  };

  const setDefault = async (id: string) => {
    setBusyId(id);
    try {
      await api.setDefaultPayoutAccount(id);
      load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not set this as default");
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Remove this bank account?")) return;
    setBusyId(id);
    try {
      await api.deletePayoutAccount(id);
      load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not remove this bank account");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="rounded-xl border bg-background p-6 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold">Payout Accounts</h2>
          <p className="text-xs text-muted-foreground mt-0.5">You can add more than one bank account. Withdrawals go to whichever is set as default.</p>
        </div>
        {!showAddForm && (
          <Button size="sm" variant="outline" onClick={() => setShowAddForm(true)}>Add Account</Button>
        )}
      </div>

      {loading && <p className="text-xs text-muted-foreground">Loading…</p>}

      {!loading && accounts.length === 0 && !showAddForm && (
        <div className="rounded-lg border border-dashed py-6 text-center">
          <p className="text-sm text-muted-foreground">No payout account yet. Add one to be able to withdraw.</p>
        </div>
      )}

      {accounts.length > 0 && (
        <div className="space-y-2">
          {accounts.map((a) => (
            <div key={a.id} className="rounded-lg border p-3 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium flex items-center gap-1.5 flex-wrap">
                  {a.bank_name || a.bank_code} <span className="text-muted-foreground font-normal">•••• {a.account_number.slice(-4)}</span>
                  {a.is_default && <span className="text-[10px] font-medium text-primary bg-primary/10 rounded-full px-1.5 py-0.5">Default</span>}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">{a.account_name}</p>
                {!a.name_match && (
                  <p className="text-xs text-amber-700 bg-amber-50 rounded-md px-2 py-1 mt-1.5 flex items-start gap-1.5">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                    <span>This account&apos;s name doesn&apos;t match your profile name, so withdrawals are blocked to it. Make sure the account is really yours, or add one in your own name.</span>
                  </p>
                )}
              </div>
              <div className="flex flex-col items-end gap-1.5 shrink-0">
                {!a.is_default && (
                  <Button size="sm" variant="outline" className="text-xs h-7" disabled={busyId === a.id} onClick={() => setDefault(a.id)}>
                    Set Default
                  </Button>
                )}
                <Button size="sm" variant="ghost" className="text-xs h-7 text-red-600 hover:text-red-700 hover:bg-red-50" disabled={busyId === a.id} onClick={() => remove(a.id)}>
                  Remove
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showAddForm && (
        <div className="rounded-lg border p-4 space-y-3">
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
          <p className="text-xs text-muted-foreground">
            We&apos;ll verify this account and check that its name matches your profile before it can be used for withdrawals.
          </p>
          <div className="flex gap-2">
            <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={submit} disabled={submitting}>{submitting ? "Verifying..." : "Add Account"}</Button>
            <Button variant="outline" onClick={() => { setShowAddForm(false); setBankCode(""); setAccountNumber(""); }}>Cancel</Button>
          </div>
        </div>
      )}
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
  const [profile, setProfile] = useState<ProfessionalOut | null>(null);
  const [loading, setLoading] = useState(true);

  // Tier 2: NIN + ID document (instant check, admin review fallback)
  const [nin, setNin] = useState("");
  const [dob, setDob] = useState("");
  const [idFile, setIdFile] = useState<File | null>(null);
  const [submittingId, setSubmittingId] = useState(false);

  // Tier 3: proof of address
  const [addressFile, setAddressFile] = useState<File | null>(null);
  const [submittingAddress, setSubmittingAddress] = useState(false);

  const load = () => {
    api.myProfile().then(setProfile).catch(() => {}).finally(() => setLoading(false));
  };
  useEffect(load, []);

  const submitIdentity = async () => {
    if (nin.length !== 11) return toast.error("NIN must be 11 digits");
    if (!dob) return toast.error("Please enter your date of birth");
    setSubmittingId(true);
    try {
      const documentUrl = idFile ? (await api.uploadFile(idFile)).url : undefined;
      const res = await api.submitProfessionalKyc({ nin, dob, document_url: documentUrl });
      if (res.kyc_status === "verified") {
        toast.success("Identity verified! You're now Tier 2.");
      } else {
        toast.error(res.kyc_note || "Could not verify your identity, please check your details.");
      }
      load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not submit for verification");
    } finally {
      setSubmittingId(false);
    }
  };

  const submitAddress = async () => {
    if (!addressFile) return toast.error("Upload a utility bill, bank statement, or similar proof of address");
    setSubmittingAddress(true);
    try {
      const uploaded = await api.uploadFile(addressFile);
      await api.submitAddressVerification(uploaded.url);
      toast.success("Submitted for review, you'll be notified once it's approved");
      setAddressFile(null);
      load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not submit document");
    } finally {
      setSubmittingAddress(false);
    }
  };

  if (loading || !profile) return <ListSkeleton />;

  const identityVerified = profile.tier >= 2;
  const docPending = profile.verification_status === "pending";
  const docRejected = profile.verification_status === "rejected";
  const addressStatus = profile.address_verification_status;
  const addressMeta = VERIFICATION_LABELS[addressStatus];
  const identityBadge = identityVerified
    ? VERIFICATION_LABELS.verified
    : docPending
      ? VERIFICATION_LABELS.pending
      : docRejected
        ? VERIFICATION_LABELS.rejected
        : VERIFICATION_LABELS.unverified;

  return (
    <div className="space-y-6">
      {/* Tier 2: identity */}
      <div className="rounded-xl border bg-background p-6 space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold">Identity &amp; Tier 2</h3>
            <TierTag tier={profile.tier} />
          </div>
          <Badge className={`text-xs rounded-full ${identityBadge.className}`}>{identityBadge.label}</Badge>
        </div>
        {identityVerified ? (
          <p className="text-sm text-muted-foreground">
            Your identity is verified. You're on Tier 2, which lifts your daily proposal and active-project caps.
          </p>
        ) : docPending ? (
          <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm">
            <p className="font-medium text-amber-800">Your identity document is under review</p>
            <p className="text-amber-700 mt-1">Our team is reviewing the document you uploaded. You'll be notified once it's approved.</p>
          </div>
        ) : (
          <>
            {docRejected && (
              <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm">
                <p className="font-medium text-red-800">Your identity verification was not approved</p>
                <p className="text-red-700 mt-1">{profile.verification_note || "Please review your details and resubmit."}</p>
              </div>
            )}
            <p className="text-sm text-muted-foreground">
              Enter your NIN and upload a scan of your NIN slip, national ID card, voters card, or passport. Your NIN is checked
              instantly; if it can't be confirmed automatically, the document goes to our team for review.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="verify-nin">NIN</Label>
                <Input id="verify-nin" value={nin} onChange={(e) => setNin(e.target.value.replace(/\D/g, "").slice(0, 11))} placeholder="12345678901" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="verify-dob">Date of Birth</Label>
                <Input id="verify-dob" type="date" value={dob} onChange={(e) => setDob(e.target.value)} />
              </div>
            </div>
            <FileUploadField
              label="ID Document"
              description="NIN slip, national ID card, voters card, or passport. Used by our team when the automatic NIN check can't confirm you."
              file={idFile}
              onChange={setIdFile}
              disabled={submittingId}
            />
            <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={submitIdentity} disabled={submittingId}>
              {submittingId ? "Submitting..." : "Verify Identity"}
            </Button>
          </>
        )}
      </div>

      {/* Tier 3: proof of address */}
      <div className="rounded-xl border bg-background p-6 space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h3 className="font-semibold">Proof of Address &amp; Tier 3</h3>
          <Badge className={`text-xs rounded-full ${addressMeta.className}`}>{addressMeta.label}</Badge>
        </div>
        {!identityVerified ? (
          <p className="text-sm text-muted-foreground">Verify your identity first, that's Tier 2 before Tier 3.</p>
        ) : addressStatus === "verified" ? (
          <p className="text-sm text-muted-foreground">Your address is verified. You're on Tier 3, no proposal or project caps.</p>
        ) : (
          <>
            {addressStatus === "rejected" && (
              <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm">
                <p className="font-medium text-red-800">Your proof of address was not approved</p>
                <p className="text-red-700 mt-1">{profile.address_verification_note || "Please review and resubmit your document."}</p>
              </div>
            )}
            <p className="text-sm text-muted-foreground">
              A recent utility bill, bank statement, or similar document showing your name and address. Reviewed by our team, usually within a day or two.
            </p>
            <FileUploadField
              label="Proof of Address"
              description="Utility bill, bank statement, or similar, issued within the last 3 months."
              file={addressFile}
              onChange={setAddressFile}
              disabled={submittingAddress}
            />
            <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={submitAddress} disabled={submittingAddress}>
              {submittingAddress ? "Submitting..." : "Submit for Review"}
            </Button>
          </>
        )}
      </div>

      {/* Credential badges */}
      <div className="rounded-xl border bg-background p-6 space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h3 className="font-semibold flex items-center gap-1.5"><Award className="h-4 w-4 text-amber-600" /> Credential Badges</h3>
          <AddCertificationForm onAdded={load} />
        </div>
        <p className="text-sm text-muted-foreground">
          Add any certifications you hold (COREN, ARCON, NIQS, etc.). Each one is reviewed by our team and, once approved, shows as a
          badge on your public profile that clients can see.
        </p>
        {profile.certifications.length === 0 && <p className="text-sm text-muted-foreground">No certifications added yet.</p>}
        {profile.certifications.map((c) => {
          const meta = VERIFICATION_LABELS[c.verification_status] || VERIFICATION_LABELS.unverified;
          return (
            <div key={c.id} className="rounded-lg border p-3 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-medium">{c.name}</p>
                  <Badge className={`text-xs rounded-full ${meta.className}`}>{meta.label}</Badge>
                </div>
                {c.issuing_body && <p className="text-xs text-muted-foreground mt-0.5">{c.issuing_body}</p>}
                {c.verification_status === "rejected" && c.verification_note && (
                  <p className="text-xs text-red-600 mt-1">{c.verification_note}</p>
                )}
                {c.credential_url && (
                  <a href={c.credential_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-1">
                    <FileText className="h-3 w-3" /> View credential
                  </a>
                )}
              </div>
              <button
                type="button"
                onClick={async () => { try { await api.deleteCertification(c.id); toast.success("Removed"); load(); } catch { toast.error("Could not remove"); } }}
                className="text-muted-foreground hover:text-red-600 shrink-0"
                aria-label={`Remove ${c.name}`}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          );
        })}
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
  const [username, setUsername] = useState(user?.username || "");
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
      await api.updateMe({
        first_name: firstName, last_name: lastName, phone, avatar_url: avatarUrl,
        ...(username.trim() && username.trim() !== (user?.username || "") ? { username: username.trim() } : {}),
      });
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
      <UsernameField value={username} onChange={setUsername} />
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
  const [skills, setSkills] = useState<string[]>([]);
  const [customSkill, setCustomSkill] = useState("");
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
      setSkills(p.skills);
    }).catch(() => toast.error("Could not load professional profile")).finally(() => setLoading(false));
  }, []);

  const addCustomSkill = () => {
    const s = customSkill.trim();
    if (!s) return;
    if (!skills.includes(s)) setSkills((prev) => [...prev, s]);
    setCustomSkill("");
  };

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
        skills,
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
      <div className="space-y-2">
        <label className="text-sm">Skills</label>
        <div className="flex flex-wrap gap-1.5 max-h-44 overflow-y-auto pr-1">
          {SKILLS.map((sk) => {
            const selected = skills.includes(sk.label);
            return (
              <button
                key={sk.id}
                type="button"
                onClick={() => setSkills((prev) => (selected ? prev.filter((x) => x !== sk.label) : [...prev, sk.label]))}
                className={`text-xs rounded-full border px-2.5 py-1.5 transition-colors ${
                  selected ? "bg-emerald-600 text-white border-emerald-600" : "bg-background text-muted-foreground hover:bg-muted"
                }`}
              >
                {sk.label}
              </button>
            );
          })}
        </div>
        <div className="flex gap-2">
          <Input
            value={customSkill}
            onChange={(e) => setCustomSkill(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustomSkill(); } }}
            placeholder="Or add your own skill"
          />
          <Button type="button" size="sm" variant="outline" onClick={addCustomSkill} disabled={!customSkill.trim()}>Add</Button>
        </div>
        {skills.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {skills.map((s) => (
              <span key={s} className="text-xs rounded-full bg-emerald-100 text-emerald-700 px-2.5 py-1 flex items-center gap-1">
                {s}
                <button type="button" onClick={() => setSkills((prev) => prev.filter((x) => x !== s))} className="hover:text-emerald-900" aria-label={`Remove ${s}`}>×</button>
              </span>
            ))}
          </div>
        )}
      </div>
      <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={save} disabled={saving}>{saving ? "Saving..." : "Save Professional Details"}</Button>
    </div>
  );
}

export function TalentSettings() {
  // Deep-linkable: ?tab=verification etc. so the dashboard's "get hired
  // faster" checklist can jump straight to the right settings tab.
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<"profile" | "professional" | "verification" | "payout" | "security">(() => {
    const t = searchParams.get("tab");
    return t === "profile" || t === "professional" || t === "verification" || t === "payout" || t === "security" ? t : "profile";
  });

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
  { value: "offered", label: "Offers" },
  { value: "accepted", label: "Accepted" },
  { value: "rejected", label: "Rejected" },
];

export function TalentProposals() {
  const [bids, setBids] = useState<BidOut[]>([]);
  const [invites, setInvites] = useState<InviteOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<BidStatus | "all">("all");
  const [withdrawingId, setWithdrawingId] = useState<string | null>(null);

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

  const withdraw = async (b: BidOut) => {
    if (!confirm(`Withdraw your proposal on "${b.project_title}"? You can re-apply anytime while the project is still open.`)) return;
    setWithdrawingId(b.id);
    try {
      await api.withdrawBid(b.id);
      toast.success("Proposal withdrawn");
      load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not withdraw proposal");
    } finally {
      setWithdrawingId(null);
    }
  };

  const respond = async (id: string, status: "accepted" | "declined") => {
    try {
      await api.respondToInvite(id, status);
      toast.success(status === "accepted" ? "Invite accepted, a proposal was created" : "Invite declined");
      load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not respond to invite");
    }
  };

  const confirmOffer = async (b: BidOut) => {
    if (!confirm(`Accept the client's offer of ${fmtNaira(b.offered_amount || 0)} for "${b.project_title}"? This assigns you to the project.`)) return;
    try {
      await api.confirmOffer(b.id);
      toast.success("Offer confirmed. Define the milestone plan to start");
      load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not confirm offer");
    }
  };

  const declineOffer = async (b: BidOut) => {
    try {
      await api.declineOffer(b.id);
      toast.success("Offer declined — back to shortlisted");
      load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not decline offer");
    }
  };

  const counts = {
    all: bids.length,
    pending: bids.filter((b) => b.status === "pending").length,
    shortlisted: bids.filter((b) => b.status === "shortlisted").length,
    offered: bids.filter((b) => b.status === "offered").length,
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
          <div key={b.id} className="flex items-start justify-between gap-4 p-5 hover:bg-muted/40 transition-colors group">
            <Link href={`/talent/dashboard/find-work/${b.project_id}`} className="flex items-start gap-3 min-w-0 flex-1">
              <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5">
                <Briefcase className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-sm truncate group-hover:text-primary transition-colors">{b.project_title}</p>
                {b.status === "offered" && b.offered_amount != null && (
                  <p className="text-xs text-purple-700 bg-purple-50 rounded-md px-2 py-1 mt-1.5 inline-block">
                    Client offered {fmtNaira(b.offered_amount)}{b.offer_note ? `: "${b.offer_note}"` : ""}
                  </p>
                )}
                {b.cover_letter && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{b.cover_letter}</p>}
                <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                  <span>Submitted {new Date(b.created_at).toLocaleDateString()}</span>
                  {b.estimated_days && <span>· Est. {b.estimated_days} days</span>}
                </div>
              </div>
            </Link>
            <div className="flex flex-col items-end gap-1.5 shrink-0">
              <Badge className={`text-xs rounded-full ${PROP_STATUS_COLORS[b.status]}`}>{b.status}</Badge>
              <span className="text-sm font-semibold">{fmtNaira(b.status === "offered" ? (b.offered_amount ?? b.amount) : b.amount)}</span>
              {(b.status === "pending" || b.status === "shortlisted") && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 px-2.5 text-xs text-muted-foreground hover:text-destructive"
                  onClick={() => withdraw(b)}
                  disabled={withdrawingId === b.id}
                >
                  {withdrawingId === b.id ? "Withdrawing..." : "Withdraw"}
                </Button>
              )}
              {b.status === "offered" && (
                <div className="flex gap-1.5">
                  <Button size="sm" variant="outline" className="h-7 px-2.5 text-xs" onClick={() => declineOffer(b)}>Decline</Button>
                  <Button size="sm" className="h-7 px-2.5 text-xs bg-emerald-600 hover:bg-emerald-700" onClick={() => confirmOffer(b)}>Confirm</Button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function TalentActiveJobs() {
  const [projects, setProjects] = useState<ProjectOut[]>([]);
  const [loading, setLoading] = useState(true);
  const { unreadByProject } = useProjectUnread();

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
        <Link key={j.id} href={`/talent/dashboard/active/${j.id}`} className="block w-full text-left rounded-xl border bg-background p-5 hover:shadow-sm hover:border-emerald-400/40 transition-all group">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-semibold group-hover:text-emerald-600 transition-colors flex items-center gap-1.5">{j.title}<UnreadBadge count={unreadByProject[j.id] || 0} /></p>
              <p className="text-sm text-muted-foreground mt-0.5">{j.category.label} · {j.location || "-"}</p>
              {j.client_company_name && (
                <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                  <Building2 className="h-3 w-3" /> {j.client_company_name}
                  {j.client_is_verified_business && <BadgeCheck className="h-3 w-3 text-emerald-600" />}
                  {j.client_payment_verified && (
                    <span title="Payment verified"><Wallet className="h-3 w-3 text-emerald-600" /></span>
                  )}
                </p>
              )}
            </div>
            <span className="font-semibold text-emerald-600 shrink-0">{formatBudgetRange(j.budget_min, j.budget_max, j.budget_type === "hourly")}</span>
          </div>
          <div className="mt-4 flex items-center gap-3">
            <div className="flex-1 h-2 rounded-full bg-muted">
              <div className="h-2 rounded-full bg-emerald-500" style={{ width: `${j.progress}%` }} />
            </div>
            <span className="text-sm font-medium">{j.progress}%</span>
            <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
          </div>
        </Link>
      ))}
    </div>
  );
}

// ─── Talent's own completed work history — the mirror of what a client sees
// on the professional's public profile (stats + per-project work history
// feed), but scoped to the logged-in talent's own record. ─────────────────
export function TalentWorkHistory() {
  const [profile, setProfile] = useState<ProfessionalOut | null>(null);
  const [projects, setProjects] = useState<ProjectOut[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.myProfile(), api.myProjects()])
      .then(([p, projs]) => {
        setProfile(p);
        setProjects(projs.filter((x) => x.status === "completed"));
      })
      .catch(() => toast.error("Could not load your work history"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <ListSkeleton />;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Work History</h1>
        <p className="text-muted-foreground text-sm mt-1">Every project you&apos;ve completed on YH Connect, with client ratings — the same record clients see on your public profile.</p>
      </div>

      {profile?.stats && <StatsBar pro={profile} />}

      {profile && (
        <WorkHistoryFeed
          profileId={profile.id}
          emptyState={
            <EmptyState icon={Briefcase} title="No completed jobs yet" message="Once you finish and close out a project, it'll show up here with the client's rating." />
          }
        />
      )}

      {projects.length > 0 && (
        <div className="rounded-xl border bg-background divide-y">
          <div className="p-4 border-b font-semibold text-sm">Completed Projects ({projects.length})</div>
          {projects.map((j) => (
            <Link key={j.id} href={`/talent/dashboard/active/${j.id}`} className="flex items-center justify-between p-4 hover:bg-muted/40 transition-colors group">
              <div className="min-w-0">
                <p className="font-medium text-sm group-hover:text-emerald-600 transition-colors truncate">{j.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{j.client_company_name || "Client"} · {j.category.label}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-sm font-semibold">{formatBudgetRange(j.budget_min, j.budget_max, j.budget_type === "hourly")}</span>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </Link>
          ))}
        </div>
      )}
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

