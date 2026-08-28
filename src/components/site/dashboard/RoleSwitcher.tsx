"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Repeat, Briefcase } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CATEGORIES } from "@/data/content";
import { useAuth } from "@/store/auth";
import { api, ApiError } from "@/lib/api";
import { toast } from "sonner";

/**
 * Quick professional-profile setup shown inline when a client without a
 * talent profile tries to switch into talent mode. Deliberately short,
 * the rest can be filled in later from Talent Settings.
 */
function BecomeTalentDialog({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [title, setTitle] = useState("");
  const [categoryId, setCategoryId] = useState(CATEGORIES[0]?.id || "");
  const [hourlyRate, setHourlyRate] = useState("");
  const [yearsExperience, setYearsExperience] = useState("");
  const [skillsInput, setSkillsInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const setSession = useAuth((s) => s.setSession);

  const submit = async () => {
    if (!title.trim()) return toast.error("Add a professional title, e.g. \"Structural Engineer\"");
    if (!categoryId) return toast.error("Choose a category");
    setSubmitting(true);
    try {
      const res = await api.becomeTalent({
        title: title.trim(),
        category_id: categoryId,
        hourly_rate: hourlyRate ? Number(hourlyRate) : undefined,
        years_experience: yearsExperience || undefined,
        skills: skillsInput.split(",").map((s) => s.trim()).filter(Boolean),
      });
      setSession(res.user, res.access_token);
      toast.success("Talent profile created, you're now in talent mode");
      onDone();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not set up your talent profile");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-xl border bg-background p-6 space-y-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2"><Briefcase className="h-4 w-4" /> Set up your talent profile</h2>
          <p className="text-sm text-muted-foreground mt-1">Quick setup, you can add more (portfolio, employment, education) later in Talent Settings. Your client account and history stay exactly as they are.</p>
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Professional Title *</label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Structural Engineer" />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Category *</label>
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Daily Rate (₦)</label>
            <Input type="number" value={hourlyRate} onChange={(e) => setHourlyRate(e.target.value)} placeholder="15000" />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Years Experience</label>
            <Input value={yearsExperience} onChange={(e) => setYearsExperience(e.target.value)} placeholder="5" />
          </div>
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Skills (comma-separated)</label>
          <Input value={skillsInput} onChange={(e) => setSkillsInput(e.target.value)} placeholder="AutoCAD, Structural Analysis, ETABS" />
        </div>
        <div className="flex gap-2 pt-1">
          <Button variant="outline" className="flex-1" onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button className="flex-1" onClick={submit} disabled={submitting}>{submitting ? "Setting up..." : "Create Talent Profile"}</Button>
        </div>
      </div>
    </div>
  );
}

/**
 * Lets an account flip between client mode and talent mode without a new
 * registration. Both sides of the account (client fields, professional
 * profile) coexist independently, switching just changes which dashboard
 * and gating currently applies.
 */
export function RoleSwitcher({ className = "", onSwitched }: { className?: string; onSwitched?: () => void }) {
  const user = useAuth((s) => s.user);
  const setSession = useAuth((s) => s.setSession);
  const router = useRouter();
  const [setupOpen, setSetupOpen] = useState(false);
  const [switching, setSwitching] = useState(false);

  if (!user || user.role === "admin") return null;

  const targetRole = user.role === "client" ? "professional" : "client";
  const targetLabel = targetRole === "professional" ? "Talent" : "Client";
  const targetHref = targetRole === "professional" ? "/talent/dashboard" : "/client/dashboard";

  const performSwitch = async () => {
    setSwitching(true);
    try {
      const res = await api.switchRole(targetRole);
      setSession(res.user, res.access_token);
      toast.success(`Switched to ${targetLabel} mode`);
      onSwitched?.();
      // Client-side navigation, not a hard reload: setSession above has
      // already updated the in-memory store synchronously, so the new
      // layout's auth guard sees the correct role on its very first render.
      // A hard reload (window.location.href) forces the store to rehydrate
      // from localStorage from scratch, which can lose the race against the
      // guard's redirect and dead-end back on the login page.
      router.push(targetHref);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not switch modes");
    } finally {
      setSwitching(false);
    }
  };

  const handleClick = (e: React.MouseEvent) => {
    // Prevent this from bubbling into the dropdown's outside-click handling,
    // which would close (and unmount) this component before the inline
    // setup dialog below ever gets a chance to render.
    e.stopPropagation();
    if (targetRole === "professional" && !user.has_professional_profile) {
      setSetupOpen(true);
      return;
    }
    performSwitch();
  };

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        disabled={switching}
        className={`flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-accent text-left disabled:opacity-60 ${className}`}
      >
        <Repeat className="h-3.5 w-3.5" />
        {switching ? "Switching..." : `Switch to ${targetLabel} Mode`}
      </button>
      {setupOpen && (
        <BecomeTalentDialog
          onClose={() => setSetupOpen(false)}
          onDone={() => {
            setSetupOpen(false);
            onSwitched?.();
            router.push("/talent/dashboard");
          }}
        />
      )}
    </>
  );
}
