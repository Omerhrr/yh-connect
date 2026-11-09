"use client";

import { useCallback, useEffect, useState } from "react";
import { BadgeCheck, CheckCircle2, ExternalLink, Loader2, LogOut, ShieldCheck, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ApiError, resolveAssetUrl } from "@/lib/api";
import { getVerifierToken, setVerifierToken, verifierApi, type VerifierCert } from "@/lib/verifierApi";

type Me = { id: string; name: string; email: string; body_name: string };

function LoginCard({ onLoggedIn }: { onLoggedIn: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) return toast.error("Enter your email and password");
    setLoading(true);
    try {
      const res = await verifierApi.login(email.trim(), password);
      setVerifierToken(res.access_token);
      onLoggedIn();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not sign in");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 px-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2.5 mb-6 justify-center text-white">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 border border-white/20">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <span className="font-bold text-xl">YH Connect <span className="text-slate-400 font-normal">Verifier Portal</span></span>
        </div>
        <form onSubmit={submit} className="bg-white dark:bg-slate-900 rounded-2xl border shadow-xl p-8 space-y-4">
          <div>
            <h1 className="text-lg font-bold">Issuing body sign in</h1>
            <p className="text-sm text-muted-foreground mt-1">For ARCON, COREN, CORBON and other bodies helping us confirm professional credentials.</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="v-email">Email</Label>
            <Input id="v-email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} disabled={loading} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="v-pass">Password</Label>
            <Input id="v-pass" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} disabled={loading} />
          </div>
          <Button type="submit" className="w-full bg-slate-800 hover:bg-slate-900" disabled={loading}>
            {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Signing in...</> : "Sign In"}
          </Button>
          <p className="text-xs text-muted-foreground text-center">Accounts are created by YH Connect. Access is logged.</p>
        </form>
      </div>
    </div>
  );
}

function CertCard({ cert, onDecided, readOnly }: { cert: VerifierCert; onDecided: () => void; readOnly: boolean }) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const doc = resolveAssetUrl(cert.credential_url) || cert.credential_url || undefined;

  const decide = async (status: "verified" | "rejected") => {
    if (status === "rejected" && !note.trim()) return toast.error("Please say why you're rejecting it");
    setBusy(true);
    try {
      await verifierApi.decide(cert.id, status, note.trim() || undefined);
      toast.success(status === "verified" ? "Marked as verified" : "Rejected");
      onDecided();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not save");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-xl border bg-background p-5 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold">{cert.name}</p>
          <p className="text-sm text-muted-foreground">Issued by {cert.issuing_body || "unspecified"}</p>
        </div>
        {readOnly && (
          <Badge className={`rounded-full text-xs ${cert.status === "verified" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-600"}`}>{cert.status}</Badge>
        )}
      </div>
      <div className="grid sm:grid-cols-2 gap-x-6 gap-y-1 text-sm">
        <p><span className="text-muted-foreground">Holder: </span>{cert.holder_name || "n/a"}</p>
        <p><span className="text-muted-foreground">Title: </span>{cert.holder_title || "n/a"}</p>
        <p><span className="text-muted-foreground">Location: </span>{cert.holder_location || "n/a"}</p>
        <p><span className="text-muted-foreground">Issued: </span>{cert.issued_date || "n/a"}{cert.expiry_date ? ` · expires ${cert.expiry_date}` : ""}</p>
      </div>
      {doc ? (
        <a href={doc} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline">
          <ExternalLink className="h-3.5 w-3.5" /> Open submitted document
        </a>
      ) : (
        <p className="text-xs text-muted-foreground">No document attached.</p>
      )}

      {readOnly ? (
        <p className="text-xs text-muted-foreground">
          {cert.verified_by_name ? `By ${cert.verified_by_name}. ` : ""}{cert.note || ""}
        </p>
      ) : (
        <div className="space-y-2 pt-1">
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder="Note (required if rejecting, e.g. registration number not found)"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
          <div className="flex gap-2">
            <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" disabled={busy} onClick={() => decide("verified")}>
              <CheckCircle2 className="h-4 w-4 mr-1.5" /> Confirm genuine
            </Button>
            <Button size="sm" variant="outline" className="text-red-600 border-red-200" disabled={busy} onClick={() => decide("rejected")}>
              <XCircle className="h-4 w-4 mr-1.5" /> Reject
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function VerifierPortalPage() {
  const [me, setMe] = useState<Me | null>(null);
  const [checking, setChecking] = useState(true);
  const [tab, setTab] = useState<"pending" | "reviewed">("pending");
  const [items, setItems] = useState<VerifierCert[] | null>(null);

  const loadMe = useCallback(() => {
    if (!getVerifierToken()) { setMe(null); setChecking(false); return; }
    verifierApi.me()
      .then(setMe)
      .catch(() => { setVerifierToken(null); setMe(null); })
      .finally(() => setChecking(false));
  }, []);
  useEffect(loadMe, [loadMe]);

  const loadItems = useCallback(() => {
    setItems(null);
    verifierApi.certifications(tab).then(setItems).catch(() => setItems([]));
  }, [tab]);
  useEffect(() => { if (me) loadItems(); }, [me, loadItems]);

  if (checking) return <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">Loading…</div>;
  if (!me) return <LoginCard onLoggedIn={() => { setChecking(true); loadMe(); }} />;

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b bg-background">
        <div className="mx-auto max-w-3xl px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2 font-semibold">
            <BadgeCheck className="h-5 w-5 text-primary" /> {me.body_name} · Verifier Portal
          </div>
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <span className="hidden sm:inline">{me.name}</span>
            <Button size="sm" variant="ghost" onClick={() => { setVerifierToken(null); setMe(null); }}>
              <LogOut className="h-4 w-4 mr-1.5" /> Sign out
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8 space-y-5">
        <div>
          <h1 className="text-2xl font-bold">Credentials to verify</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Professionals who listed {me.body_name} as the issuer of a certificate. Open the submitted document, check it against your register, then confirm or reject it.
          </p>
        </div>

        <div className="flex gap-2">
          {(["pending", "reviewed"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-full border px-3 py-1 text-sm ${tab === t ? "bg-primary text-primary-foreground border-primary" : "hover:bg-muted"}`}
            >
              {t === "pending" ? "Awaiting review" : "Reviewed by us"}
            </button>
          ))}
        </div>

        {items === null && <p className="text-sm text-muted-foreground">Loading…</p>}
        {items !== null && items.length === 0 && (
          <div className="rounded-xl border border-dashed bg-background py-12 text-center text-sm text-muted-foreground">
            {tab === "pending" ? "Nothing waiting. You're all caught up." : "No sign-offs yet."}
          </div>
        )}
        {(items ?? []).map((c) => (
          <CertCard key={c.id} cert={c} readOnly={tab === "reviewed"} onDecided={loadItems} />
        ))}
      </main>
    </div>
  );
}
