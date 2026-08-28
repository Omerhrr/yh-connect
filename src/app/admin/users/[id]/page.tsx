"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BackButton } from "@/components/site/BackButton";
import { api, ApiError, type AdminUserDetailOut, type AdminWalletTransactionOut } from "@/lib/api";
import { PROJECT_STATUS_COLORS, BID_STATUS_COLORS, WALLET_TX_TYPE_COLORS, WALLET_TX_STATUS_COLORS } from "@/lib/statusColors";
import { formatNaira as fmtNaira, formatBudgetRange } from "@/lib/utils";
import { AdjustWalletDialog } from "@/components/admin/AdjustWalletDialog";
import { toast } from "sonner";
import { BadgeCheck, Wallet, ArrowRight } from "lucide-react";

const VERIFICATION_LABELS: Record<string, string> = {
  unverified: "Unverified",
  pending: "Pending review",
  verified: "Verified",
  rejected: "Rejected",
};

const VERIFICATION_TONES: Record<string, string> = {
  unverified: "bg-gray-100 text-gray-600",
  pending: "bg-amber-100 text-amber-700",
  verified: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-600",
};

// Tier is derived the same way the professionals' own dashboard derives it:
// both verified = Tier 3, identity only = Tier 2, otherwise Tier 1.
function tierFor(identity: string, address: string) {
  if (identity === "verified" && address === "verified") return { tier: 3, label: "Tier 3 · Full trust, no caps" };
  if (identity === "verified") return { tier: 2, label: "Tier 2 · NIN-verified" };
  return { tier: 1, label: "Tier 1 · Identity unverified" };
}

export default function AdminUserDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [data, setData] = useState<AdminUserDetailOut | null>(null);
  const [walletTxs, setWalletTxs] = useState<AdminWalletTransactionOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [walletOpen, setWalletOpen] = useState(false);

  useEffect(() => {
    api.adminUserDetail(id).then(setData).catch(() => toast.error("Could not load user")).finally(() => setLoading(false));
    api.adminWalletTransactions({ user_id: id, limit: 8 })
      .then(setWalletTxs)
      .catch(() => toast.error("Could not load wallet activity"));
  }, [id]);

  const patchUser = async (payload: { is_active?: boolean; is_verified_business?: boolean }) => {
    if (!data) return;
    setBusy(true);
    try {
      await api.updateAdminUser(data.id, payload);
      toast.success("User updated");
      setData((prev) => (prev ? { ...prev, ...payload } : prev));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not update user");
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <p className="p-6 text-sm text-muted-foreground">Loading…</p>;
  if (!data) return <p className="p-6 text-sm text-muted-foreground">User not found.</p>;

  const prof = data.professional_profile;
  const tier = prof ? tierFor(prof.verification_status, prof.address_verification_status) : null;

  return (
    <div className="space-y-5 max-w-4xl">
      <BackButton fallbackHref="/admin/users" />

      <div className="rounded-xl border bg-background p-6 space-y-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-xl font-bold">{data.first_name} {data.last_name}</h1>
            <p className="text-sm text-muted-foreground">{data.email}{data.phone ? ` · ${data.phone}` : ""}</p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
            <Badge variant="outline" className="text-xs rounded-full capitalize">{data.role}</Badge>
            {!data.is_active && <Badge className="text-xs rounded-full bg-red-100 text-red-600">Suspended</Badge>}
            {data.is_verified_business && (
              <Badge className="text-xs rounded-full bg-blue-100 text-blue-700 flex items-center gap-1">
                <BadgeCheck className="h-3 w-3" /> Verified Business
              </Badge>
            )}
          </div>
        </div>
        {data.role !== "admin" && (
          <div className="flex gap-2 flex-wrap">
            <Button
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => {
                if (data.is_active && !confirm(`Suspend ${data.first_name} ${data.last_name}? This immediately ends their active sessions.`)) return;
                patchUser({ is_active: !data.is_active });
              }}
            >
              {data.is_active ? "Suspend" : "Reactivate"}
            </Button>
            {data.company_name && (
              <Button size="sm" variant="outline" disabled={busy} onClick={() => patchUser({ is_verified_business: !data.is_verified_business })}>
                <BadgeCheck className="h-3.5 w-3.5 mr-1" /> {data.is_verified_business ? "Remove Verified Business" : "Verify Business"}
              </Button>
            )}
          </div>
        )}
        {data.company_name && (
          <p className="text-xs text-muted-foreground">
            {data.company_name}{data.is_verified_business ? " (verified business)" : ""}
            {data.industry ? ` · ${data.industry}` : ""}
          </p>
        )}
        <p className="text-xs text-muted-foreground">Joined {new Date(data.created_at).toLocaleDateString()}</p>
      </div>

      {/* Wallet */}
      <div className="rounded-xl border bg-background p-6 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h2 className="text-sm font-semibold flex items-center gap-1.5">
            <Wallet className="h-4 w-4" /> Wallet
          </h2>
          <div className="flex items-center gap-2">
            <Link href={`/admin/payments?user=${data.id}`} className="text-xs text-primary hover:underline flex items-center gap-0.5">
              View all in Payments <ArrowRight className="h-3 w-3" />
            </Link>
            <Button size="sm" variant="outline" onClick={() => setWalletOpen(true)}>
              <Wallet className="h-3.5 w-3.5 mr-1" /> Adjust
            </Button>
          </div>
        </div>
        <p className="text-2xl font-bold">{fmtNaira(data.wallet_balance ?? 0)}</p>
        {walletTxs.length === 0 ? (
          <p className="text-sm text-muted-foreground">No wallet activity yet.</p>
        ) : (
          <div className="divide-y">
            {walletTxs.map((tx) => (
              <div key={tx.id} className="py-2.5 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">
                    {tx.project_title || (tx.type === "topup" ? "Wallet top-up" : tx.type === "withdrawal" ? "Wallet withdrawal" : tx.type === "adjustment" ? "Admin adjustment" : "Untitled project")}
                  </p>
                  <p className="text-xs text-muted-foreground">{new Date(tx.created_at).toLocaleString()}</p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <Badge className={`text-xs rounded-full ${WALLET_TX_TYPE_COLORS[tx.type]}`}>{tx.type}</Badge>
                  <Badge className={`text-xs rounded-full ${WALLET_TX_STATUS_COLORS[tx.status]}`}>{tx.status}</Badge>
                  <span className="text-sm font-semibold">{fmtNaira(tx.amount)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {prof && (
        <div className="rounded-xl border bg-background p-6 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h2 className="text-sm font-semibold">Professional Profile</h2>
            {tier && <Badge className="text-xs rounded-full bg-slate-800 text-white">{tier.label}</Badge>}
          </div>
          <p className="text-sm font-medium">{prof.title}</p>
          {prof.bio && <p className="text-sm text-muted-foreground">{prof.bio}</p>}
          <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
            <span>Category: {prof.category.label}</span>
            {prof.location && <span>Location: {prof.location}</span>}
            {prof.hourly_rate && <span>Rate: ₦{prof.hourly_rate}/day</span>}
            <span>Rating: {prof.rating || "New"} ({prof.review_count})</span>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <div className="rounded-lg border p-3 space-y-1">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-medium text-muted-foreground">Identity & Documents</p>
                <Badge className={`text-[10px] rounded-full ${VERIFICATION_TONES[prof.verification_status] || "bg-gray-100 text-gray-600"}`}>
                  {VERIFICATION_LABELS[prof.verification_status] || prof.verification_status}
                </Badge>
              </div>
              {prof.verification_status === "rejected" && prof.verification_note && (
                <p className="text-xs text-red-600">Rejected: {prof.verification_note}</p>
              )}
              {prof.verification_status === "pending" && (
                <Link href="/admin/verifications" className="text-xs text-primary hover:underline">Review in Verifications →</Link>
              )}
            </div>
            <div className="rounded-lg border p-3 space-y-1">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-medium text-muted-foreground">Proof of Address (Tier 3)</p>
                <Badge className={`text-[10px] rounded-full ${VERIFICATION_TONES[prof.address_verification_status] || "bg-gray-100 text-gray-600"}`}>
                  {VERIFICATION_LABELS[prof.address_verification_status] || prof.address_verification_status}
                </Badge>
              </div>
              {prof.address_verification_status === "rejected" && prof.address_verification_note && (
                <p className="text-xs text-red-600">Rejected: {prof.address_verification_note}</p>
              )}
              {prof.address_verification_status === "pending" && (
                <Link href="/admin/verifications" className="text-xs text-primary hover:underline">Review in Verifications →</Link>
              )}
            </div>
          </div>

          {prof.skills.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {prof.skills.map((sk) => <Badge key={sk} variant="secondary" className="text-xs rounded-full">{sk}</Badge>)}
            </div>
          )}
        </div>
      )}

      {data.role === "client" && (
        <div className="rounded-xl border bg-background p-6 space-y-3">
          <h2 className="text-sm font-semibold">Projects Posted ({data.projects.length})</h2>
          {data.projects.length === 0 && <p className="text-sm text-muted-foreground">No projects posted yet.</p>}
          {data.projects.map((p) => (
            <Link
              key={p.id}
              href={`/admin/projects/${p.id}`}
              className="border-t pt-3 first:border-t-0 first:pt-0 flex items-start justify-between gap-3 block hover:bg-muted/30 -mx-2 px-2 rounded-md"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{p.title}</p>
                <p className="text-xs text-muted-foreground">{formatBudgetRange(p.budget_min, p.budget_max)}</p>
              </div>
              <Badge className={`text-xs rounded-full shrink-0 ${PROJECT_STATUS_COLORS[p.status]}`}>{p.status.replace("_", " ")}</Badge>
            </Link>
          ))}
        </div>
      )}

      {data.role === "professional" && (
        <div className="rounded-xl border bg-background p-6 space-y-3">
          <h2 className="text-sm font-semibold">Bids Submitted ({data.bids.length})</h2>
          {data.bids.length === 0 && <p className="text-sm text-muted-foreground">No bids submitted yet.</p>}
          {data.bids.map((b) => (
            <Link
              key={b.id}
              href={`/admin/projects/${b.project_id}`}
              className="border-t pt-3 first:border-t-0 first:pt-0 flex items-start justify-between gap-3 block hover:bg-muted/30 -mx-2 px-2 rounded-md"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{b.project_title || "Untitled project"}</p>
                <p className="text-xs text-muted-foreground">{fmtNaira(b.amount)}</p>
              </div>
              <Badge className={`text-xs rounded-full shrink-0 ${BID_STATUS_COLORS[b.status]}`}>{b.status}</Badge>
            </Link>
          ))}
        </div>
      )}

      {walletOpen && (
        <AdjustWalletDialog
          userId={data.id}
          userName={`${data.first_name} ${data.last_name}`}
          balance={data.wallet_balance ?? 0}
          onClose={() => setWalletOpen(false)}
          onDone={() => {
            api.adminUserDetail(id).then(setData).catch(() => undefined);
            api.adminWalletTransactions({ user_id: id, limit: 8 }).then(setWalletTxs).catch(() => undefined);
          }}
        />
      )}
    </div>
  );
}
