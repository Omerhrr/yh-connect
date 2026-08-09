"use client";

import { useEffect, useState } from "react";
import {
  BadgeCheck,
  Star,
  MapPin,
  Briefcase,
  GraduationCap,
  Award,
  Languages,
  Clock,
  TrendingUp,
  CheckCircle2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { api, type ProfessionalOut, type ReviewOut, type WorkHistoryItem } from "@/lib/api";
import { ReviewCard } from "@/components/site/shared/ReviewCard";

function fmtDate(d?: string | null) {
  if (!d) return "Present";
  return new Date(d).toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

function fmtMemberSince(d: string) {
  return new Date(d).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

// ─── Stats bar: real platform-derived numbers, not placeholders ──────────────
function StatsBar({ pro }: { pro: ProfessionalOut }) {
  const stats = pro.stats;
  if (!stats) return null;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <div className="rounded-lg border bg-background p-3 text-center">
        <p className="text-lg font-bold">{stats.total_projects}</p>
        <p className="text-xs text-muted-foreground">Total projects</p>
      </div>
      <div className="rounded-lg border bg-background p-3 text-center">
        <p className="text-lg font-bold flex items-center justify-center gap-1">
          {stats.job_success_rate !== null && stats.job_success_rate !== undefined ? (
            <>
              <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />
              {stats.job_success_rate}%
            </>
          ) : (
            "New"
          )}
        </p>
        <p className="text-xs text-muted-foreground">Job success</p>
      </div>
      <div className="rounded-lg border bg-background p-3 text-center">
        <p className="text-sm font-semibold">{fmtMemberSince(stats.member_since)}</p>
        <p className="text-xs text-muted-foreground">Member since</p>
      </div>
      <div className="rounded-lg border bg-background p-3 text-center">
        <p className="text-xs font-semibold flex items-center justify-center gap-1">
          <Clock className="h-3 w-3" /> {stats.response_time_label}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">Response time</p>
      </div>
    </div>
  );
}

// ─── Work history: real completed/active YH Connect projects with this pro ───
function WorkHistoryFeed({ profileId }: { profileId: string }) {
  const [items, setItems] = useState<WorkHistoryItem[] | null>(null);

  useEffect(() => {
    api.workHistory(profileId).then(setItems).catch(() => setItems([]));
  }, [profileId]);

  if (items === null) return null;
  if (items.length === 0) return null;

  return (
    <div className="rounded-xl border bg-background p-6 space-y-3">
      <h2 className="text-sm font-semibold">Work History ({items.length})</h2>
      {items.map((w) => (
        <div key={w.project_id} className="border-t pt-3 first:border-t-0 first:pt-0 space-y-1">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-medium">{w.project_title}</p>
            <span className="text-xs text-muted-foreground shrink-0">{w.amount_range_label}</span>
          </div>
          <p className="text-xs text-muted-foreground">
            {w.client_company || w.client_name} · {fmtDate(w.created_at)} - {w.completed_at ? fmtDate(w.completed_at) : "Ongoing"}
          </p>
          {w.review_rating != null && (
            <div className="flex items-center gap-1 mt-1">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className={`h-3 w-3 ${i < w.review_rating! ? "fill-amber-400 text-amber-400" : "text-muted-foreground"}`} />
              ))}
              {w.review_comment && <span className="text-xs text-muted-foreground ml-1 line-clamp-1">&quot;{w.review_comment}&quot;</span>}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/**
 * Full richer profile view shared by the public (unauthenticated) professional
 * profile page and the client-dashboard preview, so both stay in sync. Only
 * the hire/contact action differs between the two call sites.
 */
export function ProfessionalProfileView({
  pro,
  reviews,
  hireAction,
}: {
  pro: ProfessionalOut;
  reviews: ReviewOut[];
  hireAction: React.ReactNode;
}) {
  return (
    <div className="space-y-5">
      <div className="rounded-xl border bg-background p-6 space-y-4">
        <div className="flex items-start gap-4">
          <div className="h-16 w-16 shrink-0 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-2xl">
            {pro.first_name.charAt(0)}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-1.5">
              <h1 className="text-xl font-bold">{pro.first_name} {pro.last_name}</h1>
              {pro.verification_status === "verified" && <BadgeCheck className="h-4 w-4 text-emerald-600" />}
            </div>
            <p className="text-sm text-muted-foreground">{pro.title}</p>
            {pro.location && (
              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                <MapPin className="h-3 w-3" /> {pro.location}
              </p>
            )}
            <div className="flex items-center gap-1 mt-1">
              <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
              <span className="text-xs">{pro.rating || "New"} ({pro.review_count} review{pro.review_count === 1 ? "" : "s"})</span>
            </div>
          </div>
          {pro.hourly_rate && <span className="text-lg font-semibold text-primary shrink-0">₦{pro.hourly_rate}/hr</span>}
        </div>

        <StatsBar pro={pro} />

        {pro.bio && (
          <div>
            <h2 className="text-sm font-semibold mb-1">About</h2>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{pro.bio}</p>
          </div>
        )}

        {pro.years_experience && (
          <div>
            <h2 className="text-sm font-semibold mb-1">Experience</h2>
            <p className="text-sm text-muted-foreground">{pro.years_experience} years</p>
          </div>
        )}

        {pro.skills.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold mb-2">Skills</h2>
            <div className="flex flex-wrap gap-1.5">
              {pro.skills.map((sk) => <Badge key={sk} variant="secondary" className="text-xs rounded-full">{sk}</Badge>)}
            </div>
          </div>
        )}

        {pro.languages.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold mb-2 flex items-center gap-1.5"><Languages className="h-3.5 w-3.5" /> Languages</h2>
            <div className="flex flex-wrap gap-1.5">
              {pro.languages.map((l) => (
                <Badge key={l.name} variant="outline" className="text-xs rounded-full">{l.name} · {l.level}</Badge>
              ))}
            </div>
          </div>
        )}

        {pro.portfolio_items.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold mb-2">Portfolio</h2>
            <div className="grid grid-cols-2 gap-2">
              {pro.portfolio_items.map((item) => (
                <div key={item.id} className="rounded-lg border p-3">
                  <p className="text-xs font-medium">{item.title}</p>
                  {item.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{item.description}</p>}
                </div>
              ))}
            </div>
          </div>
        )}

        {hireAction}
      </div>

      {pro.employment_history.length > 0 && (
        <div className="rounded-xl border bg-background p-6 space-y-3">
          <h2 className="text-sm font-semibold flex items-center gap-1.5"><Briefcase className="h-3.5 w-3.5" /> Employment History</h2>
          {pro.employment_history.map((e) => (
            <div key={e.id} className="border-t pt-3 first:border-t-0 first:pt-0">
              <p className="text-sm font-medium">{e.title} · {e.employer}</p>
              <p className="text-xs text-muted-foreground">{fmtDate(e.start_date)} - {fmtDate(e.end_date)}</p>
              {e.description && <p className="text-sm text-muted-foreground mt-1">{e.description}</p>}
            </div>
          ))}
        </div>
      )}

      {pro.education.length > 0 && (
        <div className="rounded-xl border bg-background p-6 space-y-3">
          <h2 className="text-sm font-semibold flex items-center gap-1.5"><GraduationCap className="h-3.5 w-3.5" /> Education</h2>
          {pro.education.map((e) => (
            <div key={e.id} className="border-t pt-3 first:border-t-0 first:pt-0">
              <p className="text-sm font-medium">{e.school}</p>
              {(e.degree || e.field_of_study) && (
                <p className="text-xs text-muted-foreground">{[e.degree, e.field_of_study].filter(Boolean).join(", ")}</p>
              )}
              {(e.start_year || e.end_year) && (
                <p className="text-xs text-muted-foreground">{e.start_year || ""}{e.start_year && e.end_year ? " - " : ""}{e.end_year || ""}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {pro.certifications.length > 0 && (
        <div className="rounded-xl border bg-background p-6 space-y-3">
          <h2 className="text-sm font-semibold flex items-center gap-1.5"><Award className="h-3.5 w-3.5" /> Certifications</h2>
          {pro.certifications.map((c) => (
            <div key={c.id} className="border-t pt-3 first:border-t-0 first:pt-0">
              <p className="text-sm font-medium flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> {c.name}</p>
              {c.issuing_body && <p className="text-xs text-muted-foreground">{c.issuing_body}</p>}
              {(c.issued_date || c.expiry_date) && (
                <p className="text-xs text-muted-foreground">
                  Issued {fmtDate(c.issued_date)}{c.expiry_date ? ` · Expires ${fmtDate(c.expiry_date)}` : ""}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      <WorkHistoryFeed profileId={pro.id} />

      <div className="rounded-xl border bg-background p-6 space-y-3">
        <h2 className="text-sm font-semibold">Reviews ({reviews.length})</h2>
        {reviews.length === 0 && <p className="text-sm text-muted-foreground">No reviews yet.</p>}
        {reviews.map((r) => (
          <ReviewCard key={r.id} review={r} />
        ))}
      </div>
    </div>
  );
}
