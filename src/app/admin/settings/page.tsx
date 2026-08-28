"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Check, FileText, Image as ImageIcon, Loader2, Lock, Percent, RotateCcw, Save, ShieldAlert, Sparkles, Tags, Type, Users, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  api,
  ApiError,
  type CategoryOut,
  type PlatformSettingOut,
  type ProjectMediaSettingsOut,
  type ReceiptFont,
  type ReceiptSettingsOut,
  type ReceiptTemplate,
} from "@/lib/api";
import { toast } from "sonner";

const NUMERIC_KEYS = new Set([
  "platform_fee_percent",
  "milestone_auto_release_days",
  "tier1_daily_proposal_limit",
  "tier1_concurrent_project_limit",
  "tier2_daily_proposal_limit",
  "tier2_concurrent_project_limit",
  "profile_name_change_cooldown_hours",
  "payment_withholding_percent",
  "payment_withholding_release_days",
]);

// Every persisted key this page can write, so Save only ever sends fields
// the admin can actually see and edit (never a blind full-table write).
const ALL_KEYS = [
  "platform_fee_percent",
  "milestone_auto_release_days",
  "featured_category_ids",
  "tier1_daily_proposal_limit",
  "tier1_concurrent_project_limit",
  "tier2_daily_proposal_limit",
  "tier2_concurrent_project_limit",
  "profile_name_change_cooldown_hours",
  "payment_withholding_percent",
  "payment_withholding_release_days",
];

function SectionCard({ icon: Icon, title, description, children }: { icon: React.ElementType; title: string; description: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border bg-background p-6 space-y-5">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-4.5 w-4.5" />
        </div>
        <div>
          <h2 className="font-semibold">{title}</h2>
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

function NumberField({
  label, help, value, onChange, min = 0, max, suffix, dirty,
}: {
  label: string; help: string; value: string; onChange: (v: string) => void;
  min?: number; max?: number; suffix?: string; dirty: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5">
        <label className="text-sm font-medium">{label}</label>
        {dirty && <span className="h-1.5 w-1.5 rounded-full bg-amber-500" title="Unsaved change" />}
      </div>
      <div className="relative max-w-[180px]">
        <Input
          type="number"
          inputMode="numeric"
          min={min}
          max={max}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={suffix ? "pr-8" : undefined}
        />
        {suffix && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">{suffix}</span>}
      </div>
      <p className="text-xs text-muted-foreground">{help}</p>
    </div>
  );
}

function ToggleField({ label, help, checked, onChange }: { label: string; help: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="space-y-0.5">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{help}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${checked ? "bg-primary" : "bg-muted"}`}
      >
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-5" : "translate-x-0.5"}`} />
      </button>
    </div>
  );
}

function ProjectMediaSection() {
  const [settings, setSettings] = useState<ProjectMediaSettingsOut | null>(null);
  const [draft, setDraft] = useState<ProjectMediaSettingsOut | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    api.adminProjectMediaSettings()
      .then((s) => { setSettings(s); setDraft(s); })
      .catch(() => toast.error("Could not load project media settings"))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  if (loading || !draft) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-40 rounded-xl" />)}
      </div>
    );
  }

  const dirty = JSON.stringify(draft) !== JSON.stringify(settings);
  const setField = <K extends keyof ProjectMediaSettingsOut>(key: K, value: ProjectMediaSettingsOut[K]) =>
    setDraft((d) => (d ? { ...d, [key]: value } : d));

  const save = async () => {
    if (draft.image_max_mb <= 0 || draft.video_max_mb <= 0) {
      toast.error("Size limits must be greater than 0");
      return;
    }
    setSaving(true);
    try {
      const updated = await api.updateAdminProjectMediaSettings(draft);
      setSettings(updated);
      setDraft(updated);
      toast.success("Project media settings saved");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not save project media settings");
    } finally {
      setSaving(false);
    }
  };

  const discard = () => setDraft(settings);

  return (
    <div className="space-y-5 pb-24">
      <SectionCard icon={ImageIcon} title="Project Images" description="Let clients attach photos when posting a project so professionals get more context at a glance.">
        <ToggleField
          label="Allow image uploads"
          help="Enabled by default. When on, clients see an optional photo uploader in the post-a-project flow."
          checked={draft.images_enabled}
          onChange={(v) => setField("images_enabled", v)}
        />
        <NumberField
          label="Max Image Size"
          help="Applies per image. Clients can attach up to 8 images per project."
          value={String(draft.image_max_mb)}
          onChange={(v) => setField("image_max_mb", Number(v) || 0)}
          min={1}
          suffix="MB"
          dirty={draft.image_max_mb !== settings?.image_max_mb}
        />
      </SectionCard>

      <SectionCard icon={Video} title="Project Video" description="Let clients attach a video (upload or link) when posting a project. Off by default.">
        <ToggleField
          label="Allow video"
          help="Disabled by default. When on, clients see a video upload/link field, and it also appears on their posted project for professionals to view."
          checked={draft.video_enabled}
          onChange={(v) => setField("video_enabled", v)}
        />
        <NumberField
          label="Max Video Size"
          help="Applies to uploaded video files (links aren't size-limited)."
          value={String(draft.video_max_mb)}
          onChange={(v) => setField("video_max_mb", Number(v) || 0)}
          min={1}
          suffix="MB"
          dirty={draft.video_max_mb !== settings?.video_max_mb}
        />
      </SectionCard>

      {dirty && (
        <div className="sticky bottom-4 z-20 border bg-background shadow-lg rounded-xl px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">Unsaved changes</p>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={discard} disabled={saving}>
                <RotateCcw className="h-3.5 w-3.5 mr-1.5" /> Discard
              </Button>
              <Button size="sm" onClick={save} disabled={saving}>
                <Save className="h-3.5 w-3.5 mr-1.5" /> {saving ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const TEMPLATE_OPTIONS: { value: ReceiptTemplate; label: string; description: string }[] = [
  { value: "modern", label: "Modern", description: "Full-width colored header band, large amount card." },
  { value: "classic", label: "Classic", description: "Traditional letterhead style with a zebra-striped detail table." },
  { value: "minimal", label: "Minimal", description: "Clean and understated — small logo line, no color band." },
];

const FONT_OPTIONS: { value: ReceiptFont; label: string }[] = [
  { value: "sans", label: "Sans-serif (Helvetica)" },
  { value: "serif", label: "Serif (Times)" },
  { value: "mono", label: "Monospace (Courier)" },
];

function ReceiptBrandingSection() {
  const [settings, setSettings] = useState<ReceiptSettingsOut | null>(null);
  const [draft, setDraft] = useState<ReceiptSettingsOut | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  const load = () => {
    setLoading(true);
    api.receiptSettings()
      .then((s) => { setSettings(s); setDraft(s); })
      .catch(() => toast.error("Could not load receipt settings"))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  if (loading || !draft) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-40 rounded-xl" />)}
      </div>
    );
  }

  const dirty = JSON.stringify(draft) !== JSON.stringify(settings);
  const setField = <K extends keyof ReceiptSettingsOut>(key: K, value: ReceiptSettingsOut[K]) =>
    setDraft((d) => (d ? { ...d, [key]: value } : d));

  const save = async () => {
    setSaving(true);
    try {
      const updated = await api.updateReceiptSettings(draft);
      setSettings(updated);
      setDraft(updated);
      toast.success("Receipt branding saved");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not save receipt settings");
    } finally {
      setSaving(false);
    }
  };

  const discard = () => setDraft(settings);

  const preview = async () => {
    setPreviewing(true);
    try {
      // Preview always reflects what's currently saved (not the unsaved
      // draft) — save first if you want to preview a change.
      if (dirty) {
        toast.message("Save your changes first to preview them.");
      } else {
        await api.previewReceipt();
      }
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not generate preview");
    } finally {
      setPreviewing(false);
    }
  };

  const uploadLogo = async (file: File) => {
    setUploadingLogo(true);
    try {
      const { url } = await api.uploadFile(file);
      setField("logo_url", url);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not upload logo");
    } finally {
      setUploadingLogo(false);
    }
  };

  return (
    <div className="space-y-5 pb-24">
      <SectionCard icon={FileText} title="Receipt Template" description="Chosen layout used for every downloadable wallet-transaction receipt, for both clients and talent.">
        <div className="grid sm:grid-cols-3 gap-3">
          {TEMPLATE_OPTIONS.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => setField("template", t.value)}
              className={`text-left rounded-lg border p-3 transition-colors ${
                draft.template === t.value ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-input hover:bg-muted/50"
              }`}
            >
              <p className="text-sm font-medium flex items-center gap-1.5">
                {draft.template === t.value && <Check className="h-3.5 w-3.5 text-primary" />} {t.label}
              </p>
              <p className="text-xs text-muted-foreground mt-1">{t.description}</p>
            </button>
          ))}
        </div>
      </SectionCard>

      <SectionCard icon={ImageIcon} title="Brand Identity" description="Logo and company name shown at the top of every receipt.">
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Logo</label>
          <div className="flex items-center gap-3">
            {draft.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={draft.logo_url} alt="Logo" className="h-12 w-12 rounded-md border object-contain bg-white p-1" />
            ) : (
              <div className="h-12 w-12 rounded-md border border-dashed flex items-center justify-center text-muted-foreground">
                <ImageIcon className="h-4 w-4" />
              </div>
            )}
            <input
              type="file"
              accept="image/*"
              onChange={(e) => e.target.files?.[0] && uploadLogo(e.target.files[0])}
              disabled={uploadingLogo}
              className="text-xs"
            />
            {draft.logo_url && (
              <button type="button" onClick={() => setField("logo_url", null)} className="text-xs text-muted-foreground underline hover:text-foreground">
                Remove
              </button>
            )}
          </div>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Company Name</label>
            <Input value={draft.company_name} onChange={(e) => setField("company_name", e.target.value)} maxLength={60} />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Tagline</label>
            <Input value={draft.tagline} onChange={(e) => setField("tagline", e.target.value)} maxLength={80} />
          </div>
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Footer Note</label>
          <Input value={draft.footer_note} onChange={(e) => setField("footer_note", e.target.value)} maxLength={160} />
          <p className="text-xs text-muted-foreground">Small print at the bottom of every receipt (disclaimer, tax note, etc).</p>
        </div>
      </SectionCard>

      <SectionCard icon={Type} title="Theme" description="Colors and typeface applied across the chosen template.">
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Primary Color</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={draft.primary_color}
                onChange={(e) => setField("primary_color", e.target.value)}
                className="h-9 w-9 rounded border cursor-pointer"
              />
              <Input value={draft.primary_color} onChange={(e) => setField("primary_color", e.target.value)} className="max-w-[120px]" />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Text / Accent Color</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={draft.accent_color}
                onChange={(e) => setField("accent_color", e.target.value)}
                className="h-9 w-9 rounded border cursor-pointer"
              />
              <Input value={draft.accent_color} onChange={(e) => setField("accent_color", e.target.value)} className="max-w-[120px]" />
            </div>
          </div>
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Font</label>
          <select
            value={draft.font}
            onChange={(e) => setField("font", e.target.value as ReceiptFont)}
            className="flex h-10 w-full max-w-xs rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            {FONT_OPTIONS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
          </select>
        </div>
      </SectionCard>

      <div className="flex items-center gap-2">
        <Button variant="outline" onClick={preview} disabled={previewing}>
          {previewing ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <FileText className="h-3.5 w-3.5 mr-1.5" />}
          Preview PDF
        </Button>
      </div>

      {dirty && (
        <div className="sticky bottom-4 z-20 border bg-background shadow-lg rounded-xl px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">Unsaved changes</p>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={discard} disabled={saving}>
                <RotateCcw className="h-3.5 w-3.5 mr-1.5" /> Discard
              </Button>
              <Button size="sm" onClick={save} disabled={saving}>
                <Save className="h-3.5 w-3.5 mr-1.5" /> {saving ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminSettingsPage() {
  const [tab, setTab] = useState<"platform" | "receipts" | "project-media">("platform");
  const [settings, setSettings] = useState<PlatformSettingOut[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [categories, setCategories] = useState<CategoryOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    Promise.all([api.adminSettings(), api.categories()])
      .then(([data, cats]) => {
        setSettings(data);
        setDrafts(Object.fromEntries(data.map((s) => [s.key, s.value])));
        setCategories(cats);
      })
      .catch(() => toast.error("Could not load settings"))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const originalFor = (key: string) => settings.find((s) => s.key === key)?.value ?? "";
  const valueFor = (key: string) => drafts[key] ?? originalFor(key);
  const isDirty = (key: string) => valueFor(key) !== originalFor(key);
  const dirtyKeys = ALL_KEYS.filter(isDirty);
  const anyDirty = dirtyKeys.length > 0;

  const setField = (key: string, v: string) => setDrafts((prev) => ({ ...prev, [key]: v }));

  const featuredIds = useMemo(
    () => valueFor("featured_category_ids").split(",").map((s) => s.trim()).filter(Boolean),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [drafts.featured_category_ids, settings]
  );
  const toggleCategory = (id: string) => {
    const next = featuredIds.includes(id) ? featuredIds.filter((c) => c !== id) : [...featuredIds, id];
    setField("featured_category_ids", next.join(","));
  };

  const feeValue = Number(valueFor("platform_fee_percent"));
  const feeChangedALot = isDirty("platform_fee_percent") && Math.abs(feeValue - Number(originalFor("platform_fee_percent"))) >= 3;

  const discard = () => setDrafts(Object.fromEntries(settings.map((s) => [s.key, s.value])));

  const save = async () => {
    // Basic sanity checks before anything goes over the wire.
    if (valueFor("platform_fee_percent") !== "" && (isNaN(feeValue) || feeValue < 0 || feeValue > 100)) {
      toast.error("Platform fee must be a number between 0 and 100");
      return;
    }
    for (const key of ["tier1_daily_proposal_limit", "tier1_concurrent_project_limit", "tier2_daily_proposal_limit", "tier2_concurrent_project_limit"]) {
      const v = valueFor(key);
      if (v !== "" && (isNaN(Number(v)) || Number(v) < 0)) {
        toast.error("Tier limits must be zero or a positive number");
        return;
      }
    }
    if (feeChangedALot) {
      const ok = confirm(
        `You're changing the platform fee from ${originalFor("platform_fee_percent")}% to ${feeValue}%. This applies to all future milestone releases. Continue?`
      );
      if (!ok) return;
    }
    const withholdPercent = Number(valueFor("payment_withholding_percent"));
    if (valueFor("payment_withholding_percent") !== "" && (isNaN(withholdPercent) || withholdPercent < 0 || withholdPercent > 100)) {
      toast.error("Payment withholding must be a number between 0 and 100");
      return;
    }
    const withholdDays = Number(valueFor("payment_withholding_release_days"));
    if (valueFor("payment_withholding_release_days") !== "" && (isNaN(withholdDays) || withholdDays < 0)) {
      toast.error("Withholding release delay must be zero or a positive number");
      return;
    }

    setSaving(true);
    try {
      const changed = Object.fromEntries(dirtyKeys.map((key) => [key, valueFor(key)]));
      const updated = await api.updateAdminSettings(changed);
      setSettings(updated);
      setDrafts(Object.fromEntries(updated.map((s) => [s.key, s.value])));
      toast.success(`Saved ${dirtyKeys.length} setting${dirtyKeys.length === 1 ? "" : "s"}`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not save settings");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5 max-w-2xl pb-20">
      <div>
        <h1 className="text-2xl font-bold">Platform Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">Configure marketplace fees, homepage highlights, professional tier limits, and receipt branding.</p>
      </div>

      <div className="flex items-center gap-1 border-b">
        <button
          onClick={() => setTab("platform")}
          className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${tab === "platform" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
        >
          Platform
        </button>
        <button
          onClick={() => setTab("receipts")}
          className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${tab === "receipts" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
        >
          Receipt Branding
        </button>
        <button
          onClick={() => setTab("project-media")}
          className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${tab === "project-media" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
        >
          Project Media
        </button>
      </div>

      {tab === "receipts" && <ReceiptBrandingSection />}
      {tab === "project-media" && <ProjectMediaSection />}

      {tab === "platform" && (
      <>
      {loading && (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-40 rounded-xl" />)}
        </div>
      )}

      {!loading && (
        <div className="space-y-5">
          <SectionCard icon={Percent} title="Marketplace Fees" description="The take rate applied when a milestone payout is released to a professional.">
            <NumberField
              label="Platform Fee"
              help="Deducted from every successful milestone release. Changing this only affects future payouts, not past ones."
              value={valueFor("platform_fee_percent")}
              onChange={(v) => setField("platform_fee_percent", v)}
              min={0}
              max={100}
              suffix="%"
              dirty={isDirty("platform_fee_percent")}
            />
            <NumberField
              label="Milestone Auto-Release"
              help="If a client doesn't approve or dispute a submitted, funded milestone within this many days, it releases to the professional automatically. Set to 0 to disable."
              value={valueFor("milestone_auto_release_days")}
              onChange={(v) => setField("milestone_auto_release_days", v)}
              min={0}
              suffix="days"
              dirty={isDirty("milestone_auto_release_days")}
            />
            {feeChangedALot && (
              <p className="flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 rounded-md px-2.5 py-1.5">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> That&apos;s a large change, you&apos;ll be asked to confirm before it saves.
              </p>
            )}
          </SectionCard>

          <SectionCard icon={Lock} title="Payment Protection Holdback" description="Withhold a portion of every milestone payout for a set number of days after release, giving a window to catch issues before it's fully in the professional's wallet.">
            <NumberField
              label="Withholding Percentage"
              help="Portion of each payout kept back from the professional's wallet at release time. Set to 0 to disable — the full amount then releases instantly as before."
              value={valueFor("payment_withholding_percent")}
              onChange={(v) => setField("payment_withholding_percent", v)}
              min={0}
              max={100}
              suffix="%"
              dirty={isDirty("payment_withholding_percent")}
            />
            <NumberField
              label="Withholding Release Delay"
              help="How many days after release the withheld portion automatically lands in the professional's wallet. Professionals see this on every milestone payout, so it's never a surprise."
              value={valueFor("payment_withholding_release_days")}
              onChange={(v) => setField("payment_withholding_release_days", v)}
              min={0}
              suffix="days"
              dirty={isDirty("payment_withholding_release_days")}
            />
          </SectionCard>

          <SectionCard icon={ShieldAlert} title="Account Security" description="Guardrails that slow down account takeover attempts.">
            <NumberField
              label="Profile Name-Change Cooldown"
              help="How long a user must wait before changing their first/last name again. Mainly protects payouts: if an account is compromised, an intruder's first move is often renaming the profile to match a bank account they control — this cooldown blunts that. Set to 0 to disable."
              value={valueFor("profile_name_change_cooldown_hours")}
              onChange={(v) => setField("profile_name_change_cooldown_hours", v)}
              min={0}
              suffix="hours"
              dirty={isDirty("profile_name_change_cooldown_hours")}
            />
          </SectionCard>

          <SectionCard icon={Sparkles} title="Homepage Highlights" description="Pin categories to the front of Browse by Category on the homepage with a Featured badge.">
            <div className="space-y-2">
              <div className="flex items-center gap-1.5">
                <label className="text-sm font-medium flex items-center gap-1.5"><Tags className="h-3.5 w-3.5 text-muted-foreground" /> Featured Categories</label>
                {isDirty("featured_category_ids") && <span className="h-1.5 w-1.5 rounded-full bg-amber-500" title="Unsaved change" />}
              </div>
              {categories.length === 0 && <p className="text-xs text-muted-foreground">No categories found.</p>}
              <div className="flex flex-wrap gap-2">
                {categories.map((c) => {
                  const active = featuredIds.includes(c.id);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => toggleCategory(c.id)}
                      className={`flex items-center gap-1 text-xs rounded-full border px-3 py-1.5 transition-colors ${
                        active ? "bg-primary text-primary-foreground border-primary" : "bg-background text-muted-foreground hover:bg-muted border-input"
                      }`}
                    >
                      {active && <Check className="h-3 w-3" />} {c.label}
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground">{featuredIds.length} categor{featuredIds.length === 1 ? "y" : "ies"} featured.</p>
            </div>
          </SectionCard>

          <SectionCard icon={Users} title="Professional Tiers" description="Daily bid and concurrent-project caps by verification tier. Tier 3 (fully verified) has no cap and isn't configurable.">
            <div className="grid sm:grid-cols-2 gap-x-6 gap-y-5">
              <div className="sm:col-span-2 flex items-center gap-2">
                <Badge variant="outline" className="text-xs rounded-full">Tier 1</Badge>
                <span className="text-xs text-muted-foreground">Unverified professionals</span>
              </div>
              <NumberField
                label="Daily Bid Limit"
                help="Max bids a Tier 1 professional can send per day."
                value={valueFor("tier1_daily_proposal_limit")}
                onChange={(v) => setField("tier1_daily_proposal_limit", v)}
                dirty={isDirty("tier1_daily_proposal_limit")}
              />
              <NumberField
                label="Concurrent Project Limit"
                help="Max active projects a Tier 1 professional can work on at once."
                value={valueFor("tier1_concurrent_project_limit")}
                onChange={(v) => setField("tier1_concurrent_project_limit", v)}
                dirty={isDirty("tier1_concurrent_project_limit")}
              />

              <div className="sm:col-span-2 flex items-center gap-2 pt-2 border-t">
                <Badge className="text-xs rounded-full bg-blue-100 text-blue-700">Tier 2</Badge>
                <span className="text-xs text-muted-foreground">NIN-verified professionals</span>
              </div>
              <NumberField
                label="Daily Bid Limit"
                help="Max bids a Tier 2 professional can send per day."
                value={valueFor("tier2_daily_proposal_limit")}
                onChange={(v) => setField("tier2_daily_proposal_limit", v)}
                dirty={isDirty("tier2_daily_proposal_limit")}
              />
              <NumberField
                label="Concurrent Project Limit"
                help="Max active projects a Tier 2 professional can work on at once."
                value={valueFor("tier2_concurrent_project_limit")}
                onChange={(v) => setField("tier2_concurrent_project_limit", v)}
                dirty={isDirty("tier2_concurrent_project_limit")}
              />

              <div className="sm:col-span-2 flex items-center gap-2 pt-2 border-t">
                <Badge className="text-xs rounded-full bg-emerald-100 text-emerald-700">Tier 3</Badge>
                <span className="text-xs text-muted-foreground">Identity + address verified — no caps</span>
              </div>
            </div>
          </SectionCard>
        </div>
      )}

      {anyDirty && (
        <div className="sticky bottom-4 z-20 border bg-background shadow-lg rounded-xl px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              {dirtyKeys.length} unsaved change{dirtyKeys.length === 1 ? "" : "s"}
            </p>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={discard} disabled={saving}>
                <RotateCcw className="h-3.5 w-3.5 mr-1.5" /> Discard
              </Button>
              <Button size="sm" onClick={save} disabled={saving}>
                <Save className="h-3.5 w-3.5 mr-1.5" /> {saving ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </div>
        </div>
      )}
      </>
      )}
    </div>
  );
}
