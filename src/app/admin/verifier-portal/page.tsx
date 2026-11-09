"use client";

import { useEffect, useState } from "react";
import { Copy, ExternalLink, KeyRound, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { api, ApiError, type AdminIssuingBody, type AdminVerifierAccount } from "@/lib/api";
import { ViewOnlyGuard } from "@/components/admin/ViewOnlyGuard";

export default function AdminVerifierPortalPage() {
  const [bodies, setBodies] = useState<AdminIssuingBody[]>([]);
  const [accounts, setAccounts] = useState<AdminVerifierAccount[]>([]);
  const [bodyName, setBodyName] = useState("");
  const [bodyAliases, setBodyAliases] = useState("");
  const [acc, setAcc] = useState({ body_id: "", name: "", email: "" });
  const [secret, setSecret] = useState<{ email: string; password: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = () => {
    api.adminIssuingBodies().then(setBodies).catch(() => toast.error("Could not load issuing bodies"));
    api.adminVerifierAccounts().then(setAccounts).catch(() => toast.error("Could not load accounts"));
  };
  useEffect(load, []);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try { await fn(); load(); } catch (err) { toast.error(err instanceof ApiError ? err.message : "Something went wrong"); } finally { setBusy(false); }
  };

  const portalUrl = typeof window !== "undefined" ? `${window.location.origin}/verifier` : "/verifier";

  return (
    <div className="space-y-6 max-w-3xl pb-16">
      <div>
        <h1 className="text-2xl font-bold">Verifier Portal</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Give issuing bodies (ARCON, COREN, CORBON, ...) a login so they can confirm the certificates they issued. Each account only sees certificates that name its own body.
        </p>
        <button
          className="mt-2 inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
          onClick={() => { navigator.clipboard?.writeText(portalUrl); toast.success("Portal link copied"); }}
        >
          <ExternalLink className="h-3.5 w-3.5" /> {portalUrl} <Copy className="h-3 w-3" />
        </button>
      </div>

      {secret && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-950/30 p-4 space-y-1">
          <p className="text-sm font-semibold">Temporary password for {secret.email}</p>
          <p className="font-mono text-sm">{secret.password}</p>
          <p className="text-xs text-muted-foreground">Shown once. Copy it and send it securely, it can&apos;t be viewed again (you can reset it later).</p>
          <div className="flex gap-2 pt-1">
            <Button size="sm" variant="outline" onClick={() => { navigator.clipboard?.writeText(secret.password); toast.success("Copied"); }}>Copy</Button>
            <Button size="sm" variant="ghost" onClick={() => setSecret(null)}>Done</Button>
          </div>
        </div>
      )}

      <ViewOnlyGuard area="verifier_portal">
      <section className="rounded-xl border bg-background p-5 space-y-4">
        <h2 className="font-semibold">Issuing bodies</h2>
        {bodies.length === 0 && <p className="text-sm text-muted-foreground">None yet. Add one below.</p>}
        {bodies.map((b) => (
          <div key={b.id} className="flex items-center justify-between gap-3 rounded-lg border p-3">
            <div className="min-w-0">
              <p className="font-medium text-sm">{b.name} <span className="text-xs text-muted-foreground">· {b.account_count} account{b.account_count === 1 ? "" : "s"}</span></p>
              {b.aliases && <p className="text-xs text-muted-foreground truncate">Also matches: {b.aliases}</p>}
            </div>
            <Button size="sm" variant="outline" disabled={busy} onClick={() => run(async () => { await api.adminUpdateIssuingBody(b.id, { is_active: !b.is_active }); })}>
              {b.is_active ? "Deactivate" : "Activate"}
            </Button>
          </div>
        ))}
        <div className="grid sm:grid-cols-[1fr_1.4fr_auto] gap-2">
          <Input placeholder="Name, e.g. ARCON" value={bodyName} onChange={(e) => setBodyName(e.target.value)} />
          <Input placeholder="Other spellings, comma-separated (e.g. architects registration council)" value={bodyAliases} onChange={(e) => setBodyAliases(e.target.value)} />
          <Button disabled={busy || !bodyName.trim()} onClick={() => run(async () => { await api.adminCreateIssuingBody({ name: bodyName, aliases: bodyAliases }); setBodyName(""); setBodyAliases(""); toast.success("Body added"); })}>
            <Plus className="h-4 w-4 mr-1" /> Add
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">A certificate is routed to a body when the &quot;issuing body&quot; the professional typed contains the body&apos;s name or one of its spellings. Anything unmatched stays with you in Verifications.</p>
      </section>

      <section className="rounded-xl border bg-background p-5 space-y-4">
        <h2 className="font-semibold flex items-center gap-2"><KeyRound className="h-4 w-4" /> Verifier accounts</h2>
        {accounts.map((a) => (
          <div key={a.id} className="flex items-center justify-between gap-3 rounded-lg border p-3 flex-wrap">
            <div className="min-w-0">
              <p className="text-sm font-medium">{a.name} <Badge variant="outline" className="ml-1 text-xs rounded-full">{a.body_name}</Badge></p>
              <p className="text-xs text-muted-foreground">{a.email} · {a.last_login_at ? `last sign-in ${new Date(a.last_login_at).toLocaleDateString()}` : "never signed in"}</p>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" disabled={busy} onClick={() => run(async () => { const r = await api.adminUpdateVerifierAccount(a.id, { reset_password: true }); if (r.temporary_password) setSecret({ email: a.email, password: r.temporary_password }); })}>Reset password</Button>
              <Button size="sm" variant="outline" disabled={busy} onClick={() => run(async () => { await api.adminUpdateVerifierAccount(a.id, { is_active: !a.is_active }); })}>
                {a.is_active ? "Deactivate" : "Activate"}
              </Button>
            </div>
          </div>
        ))}
        <div className="grid sm:grid-cols-2 gap-2 pt-1">
          <select className="h-9 rounded-md border border-input bg-background px-2 text-sm" value={acc.body_id} onChange={(e) => setAcc({ ...acc, body_id: e.target.value })}>
            <option value="">Choose body…</option>
            {bodies.filter((b) => b.is_active).map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
          <Input placeholder="Person's name" value={acc.name} onChange={(e) => setAcc({ ...acc, name: e.target.value })} />
          <Input type="email" placeholder="Email" value={acc.email} onChange={(e) => setAcc({ ...acc, email: e.target.value })} />
          <Button
            disabled={busy || !acc.body_id || !acc.name.trim() || !acc.email.trim()}
            onClick={() => run(async () => {
              const r = await api.adminCreateVerifierAccount(acc);
              setSecret({ email: r.email, password: r.temporary_password });
              setAcc({ body_id: acc.body_id, name: "", email: "" });
            })}
          >
            Create account
          </Button>
        </div>
      </section>
      </ViewOnlyGuard>
    </div>
  );
}
