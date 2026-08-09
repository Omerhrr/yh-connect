"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api, ApiError, type PlatformSettingOut } from "@/lib/api";
import { toast } from "sonner";

const KNOWN_SETTINGS: { key: string; label: string; help: string }[] = [
  { key: "platform_fee_percent", label: "Platform Fee (%)", help: "Take rate applied on milestone releases." },
  { key: "featured_category_ids", label: "Featured Category IDs", help: "Comma-separated category ids (e.g. architecture,electrical) to pin to the front of Browse by Category on the homepage, with a Featured badge." },
];

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<PlatformSettingOut[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    api
      .adminSettings()
      .then((data) => {
        setSettings(data);
        setDrafts(Object.fromEntries(data.map((s) => [s.key, s.value])));
      })
      .catch(() => toast.error("Could not load settings"))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const save = async () => {
    setSaving(true);
    try {
      const changed = Object.fromEntries(
        KNOWN_SETTINGS.map((k) => k.key).map((key) => [key, drafts[key] ?? ""])
      );
      const updated = await api.updateAdminSettings(changed);
      setSettings(updated);
      toast.success("Settings saved");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not save settings");
    } finally {
      setSaving(false);
    }
  };

  const valueFor = (key: string) => drafts[key] ?? settings.find((s) => s.key === key)?.value ?? "";

  return (
    <div className="space-y-5 max-w-lg">
      <h1 className="text-2xl font-bold">Platform Settings</h1>
      {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {!loading && (
        <div className="rounded-xl border bg-background p-6 space-y-4">
          {KNOWN_SETTINGS.map((s) => (
            <div key={s.key} className="space-y-1.5">
              <label className="text-sm font-medium">{s.label}</label>
              <Input value={valueFor(s.key)} onChange={(e) => setDrafts((prev) => ({ ...prev, [s.key]: e.target.value }))} />
              <p className="text-xs text-muted-foreground">{s.help}</p>
            </div>
          ))}
          <Button onClick={save} disabled={saving}>{saving ? "Saving..." : "Save Settings"}</Button>
        </div>
      )}
    </div>
  );
}
