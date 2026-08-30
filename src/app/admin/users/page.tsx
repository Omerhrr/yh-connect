"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api, ApiError, type AdminUserOut, type UserRole } from "@/lib/api";
import { Wallet, UserPlus, BadgeCheck, Search } from "lucide-react";
import { AdjustWalletDialog } from "@/components/admin/AdjustWalletDialog";
import { toast } from "sonner";
import Link from "next/link";
import { formatNaira as fmtNaira } from "@/lib/utils";

const KYC_LABELS: Record<string, string> = { unverified: "KYC unverified", pending: "KYC pending", verified: "KYC verified", rejected: "KYC rejected" };
const KYC_TONES: Record<string, string> = {
  unverified: "bg-gray-100 text-gray-600",
  pending: "bg-amber-100 text-amber-700",
  verified: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-600",
};

const PAGE_SIZE = 25;

function SuspendUserDialog({ user, onClose, onDone }: { user: AdminUserOut; onClose: () => void; onDone: (u: AdminUserOut) => void }) {
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

function AddAdminDialog({ onClose, onAdded }: { onClose: () => void; onAdded: () => void }) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!firstName.trim() || !lastName.trim() || !email.trim() || password.length < 8) {
      return toast.error("All fields are required (password at least 8 characters)");
    }
    setSubmitting(true);
    try {
      await api.registerAdmin({ first_name: firstName.trim(), last_name: lastName.trim(), email: email.trim(), password });
      toast.success("Admin account created");
      onAdded();
      onClose();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not create admin");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-xl border bg-background p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold flex items-center gap-2"><UserPlus className="h-4 w-4" /> Add Admin</h2>
        <p className="text-xs text-muted-foreground">Creates a new admin account that can sign in at /admin/login.</p>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">First name</label>
            <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Last name</label>
            <Input value={lastName} onChange={(e) => setLastName(e.target.value)} />
          </div>
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Email</label>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ops@yhconnect.ng" />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Password</label>
          <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" />
        </div>
        <div className="flex gap-2 pt-1">
          <Button variant="outline" className="flex-1" onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button className="flex-1 bg-slate-800 hover:bg-slate-900" onClick={submit} disabled={submitting}>
            {submitting ? "Creating..." : "Create Admin"}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUserOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [role, setRole] = useState<UserRole | "">("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [addAdminOpen, setAddAdminOpen] = useState(false);
  const [walletTarget, setWalletTarget] = useState<AdminUserOut | null>(null);
  const [suspendTarget, setSuspendTarget] = useState<AdminUserOut | null>(null);

  const load = (append = false) => {
    const offset = append ? users.length : 0;
    setLoading(true);
    api
      .adminUsers({ q: q || undefined, role: role || undefined, limit: PAGE_SIZE, offset })
      .then((page) => {
        setUsers((prev) => (append ? [...prev, ...page] : page));
        setHasMore(page.length === PAGE_SIZE);
      })
      .catch(() => toast.error("Could not load users"))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);
  const search = () => { setUsers([]); load(); };

  const unsuspend = async (user: AdminUserOut) => {
    setBusyId(user.id);
    try {
      const updated = await api.unsuspendUser(user.id);
      toast.success("User reactivated");
      setUsers((prev) => prev.map((u) => (u.id === user.id ? updated : u)));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not update user");
    } finally {
      setBusyId(null);
    }
  };

  const toggleVerifiedBusiness = async (user: AdminUserOut) => {
    setBusyId(user.id);
    try {
      await api.updateAdminUser(user.id, { is_verified_business: !user.is_verified_business });
      toast.success(user.is_verified_business ? "Verified Business badge removed" : "Verified Business badge granted");
      setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, is_verified_business: !user.is_verified_business } : u)));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not update user");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold">Users</h1>
        <Button size="sm" className="bg-slate-800 hover:bg-slate-900" onClick={() => setAddAdminOpen(true)}>
          <UserPlus className="h-3.5 w-3.5 mr-1" /> Add Admin
        </Button>
      </div>

      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search name or email..." value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && search()} className="pl-9" />
        </div>
        <select
          value={role}
          onChange={(e) => { setRole(e.target.value as UserRole | ""); setUsers([]); }}
          className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="">All roles</option>
          <option value="client">Client</option>
          <option value="professional">Professional</option>
          <option value="admin">Admin</option>
        </select>
        <Button onClick={search} size="sm">Search</Button>
      </div>

      {loading && users.length === 0 && <p className="text-sm text-muted-foreground">Loading…</p>}

      <div className="rounded-xl border bg-background divide-y">
        {!loading && users.length === 0 && <p className="p-5 text-sm text-muted-foreground">No users found.</p>}
        {users.map((u) => (
          <div key={u.id} className="flex items-center justify-between gap-3 p-4 flex-wrap">
            <Link href={`/admin/users/${u.id}`} className="flex items-center gap-3 min-w-0 hover:opacity-80 transition-opacity">
              <div className="h-9 w-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-700 font-bold text-sm shrink-0">
                {u.first_name.charAt(0)}{u.last_name.charAt(0)}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-medium text-sm">{u.first_name} {u.last_name}</p>
                  <Badge variant="outline" className="text-[10px] rounded-full capitalize">{u.role}</Badge>
                  {!u.is_active && (
                    <Badge className="text-xs rounded-full bg-red-100 text-red-600">
                      Suspended{u.suspended_until ? ` until ${new Date(u.suspended_until).toLocaleDateString()}` : " until further notice"}
                    </Badge>
                  )}
                  {u.is_verified_business && (
                    <Badge className="text-xs rounded-full bg-blue-100 text-blue-700 flex items-center gap-1">
                      <BadgeCheck className="h-3 w-3" /> Verified Business
                    </Badge>
                  )}
                  {u.professional_tier && u.professional_tier > 1 && (
                    <Badge className="text-xs rounded-full bg-violet-100 text-violet-700">Tier {u.professional_tier}</Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground truncate">{u.email}{u.company_name ? ` · ${u.company_name}` : ""} · Joined {new Date(u.created_at).toLocaleDateString()}</p>
                <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                  <Badge className={`text-[10px] rounded-full ${KYC_TONES[u.kyc_status]}`}>{KYC_LABELS[u.kyc_status]}</Badge>
                  {!u.email_verified && <Badge className="text-[10px] rounded-full bg-gray-100 text-gray-500">Email unverified</Badge>}
                  <span className="text-[11px] text-muted-foreground">Wallet: <span className="font-semibold">{fmtNaira(u.wallet_balance)}</span></span>
                </div>
              </div>
            </Link>
            <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
              {u.role !== "admin" && (
                <Button size="sm" variant="outline" disabled={busyId === u.id} onClick={() => setWalletTarget(u)}>
                  <Wallet className="h-3.5 w-3.5 mr-1" /> Wallet
                </Button>
              )}
              {u.role !== "admin" && u.company_name && (
                <Button size="sm" variant="outline" disabled={busyId === u.id} onClick={() => toggleVerifiedBusiness(u)}>
                  <BadgeCheck className="h-3.5 w-3.5 mr-1" /> {u.is_verified_business ? "Unverify Business" : "Verify Business"}
                </Button>
              )}
              {u.role !== "admin" && (
                <Button size="sm" variant={u.is_active ? "outline" : "default"} disabled={busyId === u.id} onClick={() => (u.is_active ? setSuspendTarget(u) : unsuspend(u))}>
                  {u.is_active ? "Suspend" : "Reactivate"}
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>

      {hasMore && (
        <div className="flex justify-center">
          <Button variant="outline" onClick={() => load(true)} disabled={loading}>
            {loading ? "Loading..." : "Load more users"}
          </Button>
        </div>
      )}

      {addAdminOpen && <AddAdminDialog onClose={() => setAddAdminOpen(false)} onAdded={() => { setUsers([]); load(); }} />}
      {suspendTarget && (
        <SuspendUserDialog
          user={suspendTarget}
          onClose={() => setSuspendTarget(null)}
          onDone={(updated) => setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)))}
        />
      )}
      {walletTarget && (
        <AdjustWalletDialog
          userId={walletTarget.id}
          userName={`${walletTarget.first_name} ${walletTarget.last_name}`}
          balance={walletTarget.wallet_balance}
          onClose={() => setWalletTarget(null)}
          onDone={() => { setUsers([]); load(); }}
        />
      )}
    </div>
  );
}
