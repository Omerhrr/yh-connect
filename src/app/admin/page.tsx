"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  DollarSign,
  FolderKanban,
  Megaphone,
  RefreshCw,
  Settings,
  ShieldAlert,
  TrendingUp,
  UserPlus,
  Users,
  Wallet,
} from "lucide-react";
import { api, ApiError, type AdminWalletTransactionOut, type AnalyticsOverview } from "@/lib/api";
import { WALLET_TX_TYPE_COLORS, WALLET_TX_STATUS_COLORS } from "@/lib/statusColors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { formatNaira as fmtNaira } from "@/lib/utils";

function StatCard({ label, value, icon: Icon, href, tone }: { label: string; value: string; icon: React.ElementType; href?: string; tone?: string }) {
  const content = (
    <div className="rounded-xl border bg-background p-5 hover:shadow-sm transition-shadow">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className={`text-2xl font-bold mt-1 ${tone || ""}`}>{value}</p>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
  return href ? <Link href={href}>{content}</Link> : content;
}

function SectionCard({ title, href, hrefLabel, children }: { title: string; href?: string; hrefLabel?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border bg-background">
      <div className="flex items-center justify-between p-4 border-b">
        <h2 className="font-semibold">{title}</h2>
        {href && (
          <Link href={href} className="text-xs text-primary hover:underline flex items-center gap-0.5">
            {hrefLabel || "View all"} <ArrowRight className="h-3 w-3" />
          </Link>
        )}
      </div>
      {children}
    </div>
  );
}

function AnnouncementDialog({ onClose }: { onClose: () => void }) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [link, setLink] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!title.trim()) return toast.error("Title is required");
    if (!confirm(`Send "${title.trim()}" to every active user on the platform, by in-app notification and email? This can't be undone or unsent.`)) return;
    setSubmitting(true);
    try {
      const res = await api.sendAnnouncement({ title: title.trim(), body: body.trim() || undefined, link: link.trim() || undefined });
      toast.success(`Announcement sent to ${res.sent} user${res.sent === 1 ? "" : "s"}`);
      onClose();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not send announcement");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-xl border bg-background p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold flex items-center gap-2"><Megaphone className="h-4 w-4" /> Send Announcement</h2>
        <p className="text-xs text-muted-foreground">Delivers an in-app notification (and email) to every active user on the platform.</p>
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Title *</label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. New milestone escrow feature is live" />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Message</label>
          <textarea
            rows={3}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none"
            placeholder="What should users know?"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Link (optional)</label>
          <Input value={link} onChange={(e) => setLink(e.target.value)} placeholder="e.g. /blog/escrow-is-live" />
        </div>
        <div className="flex gap-2 pt-1">
          <Button variant="outline" className="flex-1" onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button className="flex-1" onClick={submit} disabled={submitting || !title.trim()}>
            {submitting ? "Sending..." : "Send to everyone"}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function AdminOverviewPage() {
  const [data, setData] = useState<AnalyticsOverview | null>(null);
  const [recentUsers, setRecentUsers] = useState<Awaited<ReturnType<typeof api.adminUsers>>>([]);
  const [recentTxs, setRecentTxs] = useState<AdminWalletTransactionOut[]>([]);
  const [summary, setSummary] = useState<Awaited<ReturnType<typeof api.adminWalletSummary>> | null>(null);
  const [attentionCounts, setAttentionCounts] = useState({ verifications: 0, address: 0, certs: 0 });
  const [loading, setLoading] = useState(true);
  const [announceOpen, setAnnounceOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = () => {
    setLoading(true);
    Promise.all([
      api.adminAnalyticsOverview(),
      api.adminUsers({ limit: 5 }),
      api.adminWalletTransactions({ limit: 5 }),
      api.adminWalletSummary(),
      api.pendingVerifications(),
      api.adminPendingAddressVerifications(),
      api.adminPendingCertifications(),
    ])
      .then(([overview, users, txs, wallet, v, a, c]) => {
        setData(overview);
        setRecentUsers(users);
        setRecentTxs(txs);
        setSummary(wallet);
        setAttentionCounts({ verifications: v.length, address: a.length, certs: c.length });
      })
      .catch(() => toast.error("Could not load overview data"))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);
  const refresh = () => {
    setRefreshing(true);
    load();
    setTimeout(() => setRefreshing(false), 800);
  };

  const attentionItems: { label: string; count: number; href: string; tone: string }[] = [];
  if (data) {
    const totalVerifications = attentionCounts.verifications + attentionCounts.address + attentionCounts.certs;
    if (totalVerifications > 0) attentionItems.push({ label: "Verifications to review", count: totalVerifications, href: "/admin/verifications", tone: "bg-amber-100 text-amber-700" });
    if (data.open_disputes > 0) attentionItems.push({ label: "Open disputes", count: data.open_disputes, href: "/admin/disputes", tone: "bg-red-100 text-red-600" });
  }
  if (summary && summary.failed_transaction_count > 0) {
    attentionItems.push({ label: "Failed transactions", count: summary.failed_transaction_count, href: "/admin/payments", tone: "bg-red-100 text-red-600" });
  }
  if (summary && summary.pending_transaction_count > 0) {
    attentionItems.push({ label: "Pending transactions", count: summary.pending_transaction_count, href: "/admin/payments", tone: "bg-amber-100 text-amber-700" });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Command Center</h1>
          <p className="text-muted-foreground text-sm mt-1">Platform health, attention items, and recent activity.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={refresh} disabled={refreshing}>
            <RefreshCw className={`h-3.5 w-3.5 mr-1 ${refreshing ? "animate-spin" : ""}`} /> Refresh
          </Button>
          <Button size="sm" className="bg-slate-800 hover:bg-slate-900" onClick={() => setAnnounceOpen(true)}>
            <Megaphone className="h-3.5 w-3.5 mr-1" /> Announce
          </Button>
        </div>
      </div>

      {loading && <p className="text-sm text-muted-foreground">Loading…</p>}

      {data && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Pending Verifications" value={String(attentionCounts.verifications + attentionCounts.address + attentionCounts.certs)} icon={BadgeCheck} href="/admin/verifications" />
          <StatCard label="Open Disputes" value={String(data.open_disputes)} icon={ShieldAlert} href="/admin/disputes" />
          <StatCard label="Active Projects" value={String(data.active_projects)} icon={FolderKanban} href="/admin/projects" />
          <StatCard label="Total Users" value={String(data.total_users)} icon={Users} href="/admin/users" />
          <StatCard label="Signups (7d)" value={String(data.signups_this_week)} icon={TrendingUp} />
          <StatCard label="GMV" value={fmtNaira(data.gmv)} icon={DollarSign} href="/admin/analytics" />
          <StatCard label="Platform Revenue" value={fmtNaira(data.platform_revenue)} icon={DollarSign} href="/admin/analytics" />
          <StatCard label="In Escrow" value={summary ? fmtNaira(summary.total_in_escrow) : "—"} icon={Wallet} href="/admin/payments" tone="text-emerald-600" />
        </div>
      )}

      {attentionItems.length > 0 && (
        <SectionCard title={`Needs Attention (${attentionItems.length})`}>
          <div className="divide-y">
            {attentionItems.map((item) => (
              <Link key={item.label} href={item.href} className="flex items-center justify-between p-4 hover:bg-muted/40 transition-colors">
                <span className="text-sm font-medium">{item.label}</span>
                <Badge className={`text-xs rounded-full ${item.tone}`}>{item.count}</Badge>
              </Link>
            ))}
          </div>
        </SectionCard>
      )}

      <div className="grid lg:grid-cols-2 gap-5">
        <SectionCard title="Recent Signups" href="/admin/users" hrefLabel="Manage users">
          <div className="divide-y">
            {recentUsers.length === 0 && <p className="p-4 text-sm text-muted-foreground">No users yet.</p>}
            {recentUsers.map((u) => (
              <Link key={u.id} href={`/admin/users/${u.id}`} className="flex items-center justify-between gap-3 p-3.5 hover:bg-muted/40 transition-colors">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{u.first_name} {u.last_name}</p>
                  <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <Badge variant="outline" className="text-[10px] rounded-full capitalize">{u.role}</Badge>
                  <span className="text-xs text-muted-foreground">{new Date(u.created_at).toLocaleDateString()}</span>
                </div>
              </Link>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Recent Transactions" href="/admin/payments">
          <div className="divide-y">
            {recentTxs.length === 0 && <p className="p-4 text-sm text-muted-foreground">No transactions yet.</p>}
            {recentTxs.map((tx) => (
              <Link
                key={tx.id}
                href={tx.project_id ? `/admin/projects/${tx.project_id}` : "/admin/payments"}
                className="flex items-center justify-between gap-3 p-3.5 hover:bg-muted/40 transition-colors"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{tx.project_title || (tx.type === "topup" ? "Wallet top-up" : tx.type === "withdrawal" ? "Wallet withdrawal" : tx.type === "adjustment" ? "Admin adjustment" : "Untitled project")}</p>
                  <p className="text-xs text-muted-foreground truncate">{tx.client_name || tx.professional_name || ""} · {new Date(tx.created_at).toLocaleString()}</p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <Badge className={`text-xs rounded-full ${WALLET_TX_TYPE_COLORS[tx.type]}`}>{tx.type}</Badge>
                  <Badge className={`text-xs rounded-full ${WALLET_TX_STATUS_COLORS[tx.status]}`}>{tx.status}</Badge>
                </div>
              </Link>
            ))}
          </div>
        </SectionCard>
      </div>

      <SectionCard title="Quick Actions">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-100">
          <Link href="/admin/verifications" className="p-4 hover:bg-muted/40 transition-colors flex items-center gap-3">
            <BadgeCheck className="h-4 w-4 text-emerald-600" />
            <div>
              <p className="text-sm font-medium">Review verifications</p>
              <p className="text-xs text-muted-foreground">Documents, address, badges</p>
            </div>
          </Link>
          <Link href="/admin/disputes" className="p-4 hover:bg-muted/40 transition-colors flex items-center gap-3">
            <ShieldAlert className="h-4 w-4 text-red-600" />
            <div>
              <p className="text-sm font-medium">Handle disputes</p>
              <p className="text-xs text-muted-foreground">Escalations and fund holds</p>
            </div>
          </Link>
          <Link href="/admin/users" className="p-4 hover:bg-muted/40 transition-colors flex items-center gap-3">
            <UserPlus className="h-4 w-4 text-blue-600" />
            <div>
              <p className="text-sm font-medium">Manage users</p>
              <p className="text-xs text-muted-foreground">Suspend, verify, adjust wallets</p>
            </div>
          </Link>
          <Link href="/admin/settings" className="p-4 hover:bg-muted/40 transition-colors flex items-center gap-3">
            <Settings className="h-4 w-4 text-slate-600" />
            <div>
              <p className="text-sm font-medium">Platform settings</p>
              <p className="text-xs text-muted-foreground">Fees, tiers, featured categories</p>
            </div>
          </Link>
        </div>
      </SectionCard>

      {announceOpen && <AnnouncementDialog onClose={() => setAnnounceOpen(false)} />}
    </div>
  );
}
