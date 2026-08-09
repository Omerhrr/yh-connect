"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/store/auth";
import {
  BadgeCheck,
  MapPin,
  Clock,
  Flag,
  Link2,
  ShieldCheck,
  Mail,
  Calendar,
  Briefcase,
  Check,
  Heart,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ApplyDialog } from "@/components/site/pages/DashboardPages";
import { api, ApiError, type ProjectOut, type BidStatus } from "@/lib/api";
import { BID_STATUS_COLORS } from "@/lib/statusColors";
import { toast } from "sonner";

const BID_STATUS_LABELS: Record<BidStatus, string> = {
  pending: "Applied",
  shortlisted: "Shortlisted",
  accepted: "Accepted",
  rejected: "Not selected",
  withdrawn: "Withdrawn",
};

const REPORT_REASONS = [
  "Spam or scam",
  "Misleading or fake listing",
  "Discriminatory or offensive",
  "Duplicate posting",
  "Other",
];

function fmtNaira(n: number) {
  return `₦${n.toLocaleString()}`;
}

function fmtMemberSince(d?: string | null) {
  if (!d) return null;
  return new Date(d).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function fmtPostedAgo(d: string) {
  const diffMs = Date.now() - new Date(d).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} minute${mins === 1 ? "" : "s"} ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? "" : "s"} ago`;
  const months = Math.floor(days / 30);
  return `${months} month${months === 1 ? "" : "s"} ago`;
}

// ─── Save (favorite) toggle, styled as a full-width sidebar row ──────────────
function SaveJobButton({ projectId, saved, onToggle, guard }: { projectId: string; saved: boolean; onToggle: (next: boolean) => void; guard: (action: () => void) => void }) {
  const [busy, setBusy] = useState(false);

  const toggle = async () => {
    if (busy) return;
    setBusy(true);
    const next = !saved;
    try {
      if (next) await api.addFavorite("project", projectId);
      else await api.removeFavorite("project", projectId);
      onToggle(next);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not update saved items");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button variant="outline" size="sm" className="w-full justify-start gap-2" onClick={() => guard(toggle)} disabled={busy}>
      <Heart className={`h-3.5 w-3.5 ${saved ? "fill-rose-500 text-rose-500" : ""}`} />
      {saved ? "Saved" : "Save job"}
    </Button>
  );
}

// ─── Copy job link ─────────────────────────────────────────────────────────
function CopyLinkButton({ projectId }: { projectId: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      const url = `${window.location.origin}/find-work/${projectId}`;
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Link copied");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Could not copy link");
    }
  };

  return (
    <Button variant="outline" size="sm" className="w-full justify-start gap-2" onClick={copy}>
      {copied ? <Check className="h-3.5 w-3.5" /> : <Link2 className="h-3.5 w-3.5" />}
      {copied ? "Link copied" : "Copy job link"}
    </Button>
  );
}

// ─── Flag as inappropriate ────────────────────────────────────────────────
function FlagProjectDialog({ projectId, onClose }: { projectId: string; onClose: () => void }) {
  const [reason, setReason] = useState(REPORT_REASONS[0]);
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const submit = async () => {
    setSubmitting(true);
    try {
      await api.reportProject(projectId, reason, details.trim() || undefined);
      setSubmitted(true);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not submit report");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-xl border bg-background p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
        {submitted ? (
          <>
            <h2 className="text-sm font-semibold">Report submitted</h2>
            <p className="text-sm text-muted-foreground">Thanks, our team will review this listing.</p>
            <Button className="w-full" onClick={onClose}>Close</Button>
          </>
        ) : (
          <>
            <h2 className="text-sm font-semibold flex items-center gap-1.5"><Flag className="h-4 w-4" /> Flag as inappropriate</h2>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Reason</label>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {REPORT_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Additional details (optional)</label>
              <textarea
                rows={3}
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                className="mt-1 flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none"
                placeholder="Tell us more..."
              />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={onClose} disabled={submitting}>Cancel</Button>
              <Button className="flex-1" onClick={submit} disabled={submitting}>{submitting ? "Submitting..." : "Submit report"}</Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── About the client trust panel ─────────────────────────────────────────
function AboutClientPanel({ project }: { project: ProjectOut }) {
  return (
    <div className="rounded-xl border bg-background p-4 space-y-3">
      <h2 className="text-sm font-semibold">About the client</h2>
      <div className="space-y-2 text-xs">
        <div className="flex items-center gap-1.5">
          <ShieldCheck className={`h-3.5 w-3.5 ${project.client_kyc_verified ? "text-emerald-600" : "text-muted-foreground"}`} />
          <span className={project.client_kyc_verified ? "" : "text-muted-foreground"}>
            {project.client_kyc_verified ? "Identity verified" : "Identity not verified"}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <Mail className={`h-3.5 w-3.5 ${project.client_email_verified ? "text-emerald-600" : "text-muted-foreground"}`} />
          <span className={project.client_email_verified ? "" : "text-muted-foreground"}>
            {project.client_email_verified ? "Email verified" : "Email not verified"}
          </span>
        </div>
        {project.client_is_verified_business && (
          <div className="flex items-center gap-1.5">
            <BadgeCheck className="h-3.5 w-3.5 text-emerald-600" />
            <span>Verified business</span>
          </div>
        )}
        {fmtMemberSince(project.client_member_since) && (
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Calendar className="h-3.5 w-3.5" />
            <span>Member since {fmtMemberSince(project.client_member_since)}</span>
          </div>
        )}
      </div>
      <div className="border-t pt-3 grid grid-cols-2 gap-2 text-center">
        <div>
          <p className="text-sm font-bold">{project.client_hire_rate !== null && project.client_hire_rate !== undefined ? `${project.client_hire_rate}%` : "New"}</p>
          <p className="text-[11px] text-muted-foreground">Hire rate</p>
        </div>
        <div>
          <p className="text-sm font-bold">{project.client_open_project_count}</p>
          <p className="text-[11px] text-muted-foreground">Open jobs</p>
        </div>
      </div>
      {project.client_completed_project_count > 0 && (
        <p className="text-xs text-muted-foreground border-t pt-2">
          {project.client_completed_project_count} completed project{project.client_completed_project_count === 1 ? "" : "s"} on YH Connect
        </p>
      )}
    </div>
  );
}

/**
 * Job detail page for a talent browsing Find Work or reviewing a client
 * invite, before deciding to apply. Two-column layout modeled on how a
 * job listing reads to talent on Upwork: brief + requirements on the left,
 * apply/save/flag/client-trust actions in a sticky sidebar on the right.
 */
export function ProjectPreview({ projectId }: { projectId: string; backHref?: string }) {
  const router = useRouter();
  const { user } = useAuth();
  const [project, setProject] = useState<ProjectOut | null>(null);
  const [loading, setLoading] = useState(true);
  const [applyOpen, setApplyOpen] = useState(false);
  const [flagOpen, setFlagOpen] = useState(false);
  const [bidStatus, setBidStatus] = useState<BidStatus | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api
      .project(projectId)
      .then(setProject)
      .catch(() => {})
      .finally(() => setLoading(false));
    if (!user) return;
    api
      .myBids()
      .then((bids) => {
        const mine = bids.find((b) => b.project_id === projectId);
        if (mine) setBidStatus(mine.status);
      })
      .catch(() => {});
    api
      .favorites()
      .then((favs) => setSaved(favs.some((f) => f.target_type === "project" && f.target_id === projectId)))
      .catch(() => {});
  }, [projectId, user]);

  // Anonymous visitors and clients can view this page (register-on-intent),
  // but only logged-in professionals can actually apply, save, or flag.
  const requireProfessional = (action: () => void) => {
    if (!user) {
      router.push(`/talent/register?next=${encodeURIComponent(`/find-work/${projectId}`)}`);
      return;
    }
    if (user.role !== "professional") {
      toast.error("Only professional accounts can apply to projects.");
      return;
    }
    action();
  };

  if (loading) return <p className="p-6 text-sm text-muted-foreground">Loading…</p>;
  if (!project) return <p className="p-6 text-sm text-muted-foreground">Project not found.</p>;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
      {/* Left: job brief */}
      <div className="lg:col-span-2 space-y-5">
        <div className="rounded-xl border bg-background p-6 space-y-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="outline" className="text-xs rounded-full">{project.category.label}</Badge>
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" /> Posted {fmtPostedAgo(project.created_at)}
              </span>
            </div>
            <h1 className="text-2xl font-bold">{project.title}</h1>
            {project.location && (
              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                <MapPin className="h-3 w-3" /> {project.location}
              </p>
            )}
          </div>

          <div className="flex flex-wrap gap-4 text-sm border-y py-3">
            <div>
              <p className="text-xs text-muted-foreground">Budget</p>
              <p className="font-semibold text-emerald-600">{fmtNaira(project.budget_min)} – {fmtNaira(project.budget_max)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Project type</p>
              <p className="font-medium capitalize flex items-center gap-1"><Briefcase className="h-3.5 w-3.5" /> {project.budget_type === "hourly" ? "Ongoing project" : "One-off project"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Proposals</p>
              <p className="font-medium">{project.bid_count}</p>
            </div>
          </div>

          <div>
            <h2 className="text-sm font-semibold mb-1">Description</h2>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{project.description}</p>
          </div>

          {project.skills.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold mb-1">Skills and Expertise</h2>
              <p className="text-xs text-muted-foreground mb-2">Mandatory skills</p>
              <div className="flex flex-wrap gap-1.5">
                {project.skills.map((sk) => <Badge key={sk} variant="secondary" className="text-xs rounded-full">{sk}</Badge>)}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right: apply / save / flag / client trust sidebar */}
      <div className="space-y-4 lg:sticky lg:top-4">
        <div className="rounded-xl border bg-background p-4 space-y-3">
          {project.status === "open" && bidStatus && (
            <Badge className={`w-full justify-center py-1.5 text-xs rounded-full ${BID_STATUS_COLORS[bidStatus]}`}>
              {BID_STATUS_LABELS[bidStatus]}
            </Badge>
          )}
          {project.status === "open" && !bidStatus && (
            <Button className="w-full bg-emerald-600 hover:bg-emerald-700" onClick={() => requireProfessional(() => setApplyOpen(true))}>
              Apply now
            </Button>
          )}
          {project.status !== "open" && (
            <p className="text-xs text-muted-foreground">This project is no longer accepting proposals.</p>
          )}

          <SaveJobButton projectId={project.id} saved={saved} onToggle={setSaved} guard={requireProfessional} />

          <CopyLinkButton projectId={project.id} />

          <Button variant="ghost" size="sm" className="w-full justify-start gap-2 text-muted-foreground" onClick={() => requireProfessional(() => setFlagOpen(true))}>
            <Flag className="h-3.5 w-3.5" /> Flag as inappropriate
          </Button>
        </div>

        <AboutClientPanel project={project} />
      </div>

      {applyOpen && (
        <ApplyDialog
          project={project}
          onClose={() => setApplyOpen(false)}
          onApplied={() => setBidStatus("pending")}
        />
      )}
      {flagOpen && <FlagProjectDialog projectId={project.id} onClose={() => setFlagOpen(false)} />}
    </div>
  );
}
