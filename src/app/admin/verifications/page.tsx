"use client";

import { useEffect, useState } from "react";
import {
  Award,
  Briefcase,
  ChevronDown,
  FileText,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
  ShieldX,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  api,
  ApiError,
  type PendingAddressVerification,
  type PendingBusinessVerification,
  type PendingCertification,
  type PendingVerification,
} from "@/lib/api";
import { toast } from "sonner";
import Link from "next/link";

// ─── Shared bits ─────────────────────────────────────────────────────────

function isImageUrl(url: string) {
  return /\.(png|jpe?g|webp|gif)$/i.test(url);
}

function isPdfUrl(url: string) {
  return /\.pdf$/i.test(url);
}

/** Inline preview of an uploaded document, so an admin can actually look at
 * the evidence without leaving the page or trusting a bare link. Falls back
 * to an "Open document" link for file types that can't be previewed inline. */
function DocPreview({ label, url }: { label: string; url: string }) {
  return (
    <div className="rounded-lg border overflow-hidden bg-muted/30">
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b bg-background">
        <span className="text-xs font-medium flex items-center gap-1.5"><FileText className="h-3.5 w-3.5 text-muted-foreground" /> {label}</span>
        <a href={url} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline">Open full size</a>
      </div>
      {isImageUrl(url) ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={label} className="max-h-80 w-full object-contain bg-black/5" />
      ) : isPdfUrl(url) ? (
        <iframe src={url} className="w-full h-80" title={label} />
      ) : (
        <a href={url} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 h-24 text-sm text-primary hover:underline">
          <FileText className="h-4 w-4" /> Open document
        </a>
      )}
    </div>
  );
}

function DetailRow({ icon: Icon, children }: { icon: React.ElementType; children: React.ReactNode }) {
  if (!children) return null;
  return (
    <p className="text-xs text-muted-foreground flex items-center gap-1.5">
      <Icon className="h-3.5 w-3.5 shrink-0" /> {children}
    </p>
  );
}

function RejectDialog({
  label,
  onClose,
  onSubmit,
}: {
  label: string;
  onClose: () => void;
  onSubmit: (note?: string) => void;
}) {
  const [note, setNote] = useState("");
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-xl border bg-background p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold flex items-center gap-2"><ShieldX className="h-4 w-4 text-red-600" /> Reject {label}</h2>
        <p className="text-xs text-muted-foreground">
          The reason is shown to the professional so they know what to fix before resubmitting. Leave blank for a generic rejection.
        </p>
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Reason (visible to professional)</label>
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Document is blurry or expired" autoFocus />
        </div>
        <div className="flex gap-2 pt-1">
          <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button className="flex-1 bg-red-600 hover:bg-red-700" onClick={() => onSubmit(note.trim() || undefined)}>Reject</Button>
        </div>
      </div>
    </div>
  );
}

// ─── Generic expandable review list ─────────────────────────────────────

function ReviewList<T>({
  items,
  loading,
  emptyText,
  busyId,
  keyOf,
  onApprove,
  onReject,
  renderSummary,
  renderDetail,
}: {
  items: T[];
  loading: boolean;
  emptyText: string;
  busyId: string | null;
  keyOf: (item: T) => string;
  onApprove: (item: T) => void;
  onReject: (item: T) => void;
  renderSummary: (item: T) => React.ReactNode;
  renderDetail: (item: T) => React.ReactNode;
}) {
  const [openId, setOpenId] = useState<string | null>(null);

  if (loading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (items.length === 0) return <p className="text-sm text-muted-foreground">{emptyText}</p>;

  return (
    <div className="rounded-xl border bg-background divide-y">
      {items.map((item) => {
        const id = keyOf(item);
        const open = openId === id;
        return (
          <div key={id}>
            <button
              type="button"
              onClick={() => setOpenId(open ? null : id)}
              className="flex w-full items-center justify-between gap-3 p-4 text-left hover:bg-muted/30 transition-colors"
            >
              {renderSummary(item)}
              <ChevronDown className={`h-4 w-4 text-muted-foreground shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
            </button>
            {open && (
              <div className="px-4 pb-4 space-y-4 border-t bg-muted/20">
                <div className="pt-4">{renderDetail(item)}</div>
                <div className="flex gap-2 justify-end">
                  <Button size="sm" variant="outline" disabled={busyId === id} onClick={() => onReject(item)}>
                    <ShieldX className="h-3.5 w-3.5 mr-1" /> Reject
                  </Button>
                  <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" disabled={busyId === id} onClick={() => onApprove(item)}>
                    <ShieldCheck className="h-3.5 w-3.5 mr-1" /> Approve
                  </Button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────

type Tab = "tier2" | "tier3" | "certs" | "business";

const BADGE_SUGGESTIONS = ["COREN", "ARCON", "BSc", "HND", "CERT", "NSE", "PMP"];

export default function AdminVerificationsPage() {
  const [items, setItems] = useState<PendingVerification[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [addressItems, setAddressItems] = useState<PendingAddressVerification[]>([]);
  const [addressLoading, setAddressLoading] = useState(true);
  const [addressBusyId, setAddressBusyId] = useState<string | null>(null);

  const [certItems, setCertItems] = useState<PendingCertification[]>([]);
  const [certLoading, setCertLoading] = useState(true);
  const [certBusyId, setCertBusyId] = useState<string | null>(null);
  const [certBadgeNames, setCertBadgeNames] = useState<Record<string, string>>({});

  const [businessItems, setBusinessItems] = useState<PendingBusinessVerification[]>([]);
  const [businessLoading, setBusinessLoading] = useState(true);
  const [businessBusyId, setBusinessBusyId] = useState<string | null>(null);

  const [tab, setTab] = useState<Tab>("tier2");

  const load = () => {
    setLoading(true);
    api.pendingVerifications().then(setItems).catch(() => toast.error("Could not load verifications")).finally(() => setLoading(false));
  };
  const loadAddress = () => {
    setAddressLoading(true);
    api.adminPendingAddressVerifications().then(setAddressItems).catch(() => toast.error("Could not load address verifications")).finally(() => setAddressLoading(false));
  };
  const loadCerts = () => {
    setCertLoading(true);
    api.adminPendingCertifications().then(setCertItems).catch(() => toast.error("Could not load badge requests")).finally(() => setCertLoading(false));
  };
  const loadBusiness = () => {
    setBusinessLoading(true);
    api.adminPendingBusinessVerifications().then(setBusinessItems).catch(() => toast.error("Could not load business verifications")).finally(() => setBusinessLoading(false));
  };

  useEffect(() => {
    load();
    loadAddress();
    loadCerts();
    loadBusiness();
  }, []);

  // Ask for a reason before rejecting; the note is surfaced to the
  // professional so they know what to fix before resubmitting.
  const [rejectTarget, setRejectTarget] = useState<{ label: string; run: (note?: string) => void } | null>(null);

  const review = async (profileId: string, status: "verified" | "rejected", note?: string) => {
    setBusyId(profileId);
    try {
      await api.reviewVerification(profileId, { status, note });
      toast.success(status === "verified" ? "Approved, professional is now Tier 2" : "Rejected");
      load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not update verification");
    } finally {
      setBusyId(null);
    }
  };

  const reviewAddress = async (profileId: string, status: "verified" | "rejected", note?: string) => {
    setAddressBusyId(profileId);
    try {
      await api.adminReviewAddressVerification(profileId, status, note);
      toast.success(status === "verified" ? "Approved, professional is now Tier 3" : "Rejected");
      loadAddress();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not update address verification");
    } finally {
      setAddressBusyId(null);
    }
  };

  const reviewCert = async (certId: string, status: "verified" | "rejected", note?: string, badgeName?: string) => {
    setCertBusyId(certId);
    try {
      await api.adminReviewCertification(certId, status, note, badgeName);
      toast.success(status === "verified" ? "Badge approved" : "Rejected");
      loadCerts();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not update badge request");
    } finally {
      setCertBusyId(null);
    }
  };

  const reviewBusiness = async (userId: string, status: "verified" | "rejected", note?: string) => {
    setBusinessBusyId(userId);
    try {
      await api.adminReviewBusinessVerification(userId, status, note);
      toast.success(status === "verified" ? "Verified Business badge granted" : "Rejected");
      loadBusiness();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not update business verification");
    } finally {
      setBusinessBusyId(null);
    }
  };

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: "tier2", label: "Tier 2 · Identity", count: items.length },
    { key: "tier3", label: "Tier 3 · Address", count: addressItems.length },
    { key: "certs", label: "Certifications", count: certItems.length },
    { key: "business", label: "Business (CAC)", count: businessItems.length },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Verifications</h1>
        <p className="text-sm text-muted-foreground">
          Review identity documents and proof of address for talent tiers, and certifications for public badges. Click any entry to see the full submission and uploaded evidence.
        </p>
      </div>

      <div className="flex gap-2 flex-wrap border-b">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`text-sm font-medium px-4 py-2.5 -mb-px border-b-2 transition-colors flex items-center gap-2 ${
              tab === t.key ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
            <Badge variant="secondary" className="text-[10px] rounded-full">{t.count}</Badge>
          </button>
        ))}
      </div>

      {tab === "tier2" && (
        <ReviewList
          items={items}
          loading={loading}
          emptyText="No identity verifications pending."
          busyId={busyId}
          keyOf={(p) => p.profile_id}
          onApprove={(p) => review(p.profile_id, "verified")}
          onReject={(p) => setRejectTarget({ label: "Identity Verification", run: (note) => review(p.profile_id, "rejected", note) })}
          renderSummary={(p) => (
            <div className="min-w-0">
              <p className="font-semibold text-sm truncate">{p.name}</p>
              <p className="text-xs text-muted-foreground truncate">{p.title}{p.category ? ` · ${p.category}` : ""}</p>
            </div>
          )}
          renderDetail={(p) => (
            <div className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-x-6 gap-y-1.5">
                <DetailRow icon={Mail}>{p.email}</DetailRow>
                <DetailRow icon={Phone}>{p.phone}</DetailRow>
                <DetailRow icon={MapPin}>{p.location}</DetailRow>
                <DetailRow icon={Briefcase}>{p.years_experience ? `${p.years_experience} experience` : null}</DetailRow>
              </div>
              {p.nin && (
                <p className="text-xs">
                  <span className="text-muted-foreground">Claimed NIN: </span>
                  <span className="font-medium">{p.nin}</span>
                  {p.kyc_status && <span className="text-muted-foreground"> · automated check: {p.kyc_status.replace("_", " ")}</span>}
                </p>
              )}
              {p.license_number && (
                <p className="text-xs"><span className="text-muted-foreground">License / reg. no: </span><span className="font-medium">{p.license_number}</span></p>
              )}
              {p.bio && <p className="text-xs text-muted-foreground">{p.bio}</p>}
              {p.skills && p.skills.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {p.skills.map((s) => <Badge key={s} variant="outline" className="text-[10px] rounded-full">{s}</Badge>)}
                </div>
              )}
              <div className="grid sm:grid-cols-2 gap-3">
                {p.id_document_url && <DocPreview label="ID document" url={p.id_document_url} />}
                {p.license_document_url && <DocPreview label="License" url={p.license_document_url} />}
                {p.insurance_document_url && <DocPreview label="Insurance" url={p.insurance_document_url} />}
              </div>
              {!p.id_document_url && !p.license_document_url && !p.insurance_document_url && (
                <p className="text-xs text-muted-foreground italic">No documents uploaded, this was an automated NIN check only.</p>
              )}
              <Link href={`/admin/users/${p.user_id}`} className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                <User className="h-3.5 w-3.5" /> View full profile & account
              </Link>
            </div>
          )}
        />
      )}

      {tab === "tier3" && (
        <ReviewList
          items={addressItems}
          loading={addressLoading}
          emptyText="No address verifications pending."
          busyId={addressBusyId}
          keyOf={(p) => p.profile_id}
          onApprove={(p) => reviewAddress(p.profile_id, "verified")}
          onReject={(p) => setRejectTarget({ label: "Proof of Address", run: (note) => reviewAddress(p.profile_id, "rejected", note) })}
          renderSummary={(p) => (
            <div className="min-w-0">
              <p className="font-semibold text-sm truncate">{p.name}</p>
              <p className="text-xs text-muted-foreground truncate">{p.title}{p.category ? ` · ${p.category}` : ""}</p>
            </div>
          )}
          renderDetail={(p) => (
            <div className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-x-6 gap-y-1.5">
                <DetailRow icon={Mail}>{p.email}</DetailRow>
                <DetailRow icon={Phone}>{p.phone}</DetailRow>
                <DetailRow icon={MapPin}>{p.location}</DetailRow>
              </div>
              {p.bio && <p className="text-xs text-muted-foreground">{p.bio}</p>}
              <DocPreview label="Address document" url={p.address_document_url} />
              <Link href={`/admin/users/${p.user_id}`} className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                <User className="h-3.5 w-3.5" /> View full profile & account
              </Link>
            </div>
          )}
        />
      )}

      {tab === "certs" && (
        <ReviewList
          items={certItems}
          loading={certLoading}
          emptyText="No badge requests pending."
          busyId={certBusyId}
          keyOf={(c) => c.id}
          onApprove={(c) => reviewCert(c.id, "verified", undefined, (certBadgeNames[c.id] ?? c.badge_name ?? c.name).trim())}
          onReject={(c) => setRejectTarget({ label: "Credential Badge", run: (note) => reviewCert(c.id, "rejected", note) })}
          renderSummary={(c) => (
            <div className="min-w-0">
              <p className="font-semibold text-sm flex items-center gap-1.5 truncate">
                <Award className="h-3.5 w-3.5 text-amber-600 shrink-0" /> {c.name}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {c.professional_name}{c.issuing_body ? ` · ${c.issuing_body}` : ""}
              </p>
            </div>
          )}
          renderDetail={(c) => (
            <div className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-x-6 gap-y-1.5">
                <DetailRow icon={User}>{c.professional_name}{c.professional_title ? ` · ${c.professional_title}` : ""}</DetailRow>
                <DetailRow icon={Mail}>{c.email}</DetailRow>
                <DetailRow icon={Briefcase}>{c.category}</DetailRow>
                <DetailRow icon={FileText}>
                  {c.issued_date ? `Issued ${new Date(c.issued_date).toLocaleDateString()}` : null}
                  {c.expiry_date ? `, expires ${new Date(c.expiry_date).toLocaleDateString()}` : ""}
                </DetailRow>
              </div>
              {c.credential_url ? (
                <DocPreview label="Credential" url={c.credential_url} />
              ) : (
                <p className="text-xs text-muted-foreground italic">No credential document attached, self-reported only.</p>
              )}
              <div className="space-y-1.5">
                <label className="text-xs font-medium">Badge name shown on profile (on approval)</label>
                <Input
                  value={certBadgeNames[c.id] ?? c.badge_name ?? c.name}
                  onChange={(e) => setCertBadgeNames((prev) => ({ ...prev, [c.id]: e.target.value }))}
                  placeholder="e.g. COREN, ARCON, BSc, HND, CERT"
                  className="h-8 max-w-xs"
                />
                <div className="flex flex-wrap gap-1.5">
                  {BADGE_SUGGESTIONS.map((b) => (
                    <button
                      key={b}
                      type="button"
                      onClick={() => setCertBadgeNames((prev) => ({ ...prev, [c.id]: b }))}
                      className="text-[10px] px-2 py-0.5 rounded-full border hover:bg-muted transition-colors"
                    >
                      {b}
                    </button>
                  ))}
                </div>
              </div>
              <Link href={`/admin/users/${c.user_id}`} className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                <User className="h-3.5 w-3.5" /> View full profile & account
              </Link>
            </div>
          )}
        />
      )}

      {tab === "business" && (
        <ReviewList
          items={businessItems}
          loading={businessLoading}
          emptyText="No business verifications pending."
          busyId={businessBusyId}
          keyOf={(b) => b.user_id}
          onApprove={(b) => reviewBusiness(b.user_id, "verified")}
          onReject={(b) => setRejectTarget({ label: "Business Verification", run: (note) => reviewBusiness(b.user_id, "rejected", note) })}
          renderSummary={(b) => (
            <div className="min-w-0">
              <p className="font-semibold text-sm truncate">{b.company_name || b.name}</p>
              <p className="text-xs text-muted-foreground truncate">{b.name}{b.cac_number ? ` · CAC ${b.cac_number}` : ""}</p>
            </div>
          )}
          renderDetail={(b) => (
            <div className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-x-6 gap-y-1.5">
                <DetailRow icon={User}>{b.name}</DetailRow>
                <DetailRow icon={Mail}>{b.email}</DetailRow>
                <DetailRow icon={Phone}>{b.phone}</DetailRow>
                <DetailRow icon={Briefcase}>{b.company_website}</DetailRow>
              </div>
              {b.cac_number && (
                <p className="text-xs"><span className="text-muted-foreground">CAC number: </span><span className="font-medium">{b.cac_number}</span></p>
              )}
              {b.cac_document_url ? (
                <DocPreview label="CAC document" url={b.cac_document_url} />
              ) : (
                <p className="text-xs text-muted-foreground italic">No CAC document attached.</p>
              )}
              <Link href={`/admin/users/${b.user_id}`} className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                <User className="h-3.5 w-3.5" /> View full profile & account
              </Link>
            </div>
          )}
        />
      )}

      {rejectTarget && (
        <RejectDialog
          label={rejectTarget.label}
          onClose={() => setRejectTarget(null)}
          onSubmit={(note) => {
            rejectTarget.run(note);
            setRejectTarget(null);
          }}
        />
      )}
    </div>
  );
}
