"use client";

import { useEffect, useState } from "react";
import { BadgeCheck, Building2, Globe, TrendingUp, Calendar, ShieldCheck, Wallet } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { UserAvatar } from "@/components/site/UserAvatar";
import { api, type ClientPublicOut, type ReviewOut } from "@/lib/api";
import { ReviewCard } from "@/components/site/shared/ReviewCard";
import { CATEGORIES } from "@/data/content";
import { Skeleton } from "@/components/ui/skeleton";

function fmtMemberSince(d: string) {
  return new Date(d).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function Loading() {
  return (
    <div className="space-y-3 max-w-2xl">
      <Skeleton className="h-24 w-full rounded-xl" />
      <Skeleton className="h-24 w-full rounded-xl" />
    </div>
  );
}

/**
 * Read-only client profile view, shown to professionals/talent so they can
 * see who they'd be working with before bidding or accepting a job. Mirrors
 * the trust signals shown on ProfessionalProfileView, minus any self-edit
 * actions and minus the client's own project list (no public endpoint for
 * another user's project list exists, nor is it needed here).
 */
export function ClientProfileView({ clientId }: { clientId: string }) {
  const [pub, setPub] = useState<ClientPublicOut | null>(null);
  const [reviews, setReviews] = useState<ReviewOut[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!clientId) return;
    setLoading(true);
    api.getClientPublic(clientId)
      .then((p) => {
        setPub(p);
        return api.reviewsForUser(clientId).then(setReviews).catch(() => {});
      })
      .catch(() => setPub(null))
      .finally(() => setLoading(false));
  }, [clientId]);

  if (loading) return <Loading />;
  if (!pub) return <p className="text-sm text-muted-foreground">Client profile not found.</p>;

  const preferredLabels = (pub.preferred_categories || [])
    .map((id) => CATEGORIES.find((c) => c.id === id)?.label)
    .filter((l): l is string => Boolean(l));

  return (
    <div className="space-y-5 max-w-2xl">
      <div className="rounded-xl border bg-background p-6 space-y-5">
        <div className="flex items-start gap-4">
          {pub.company_logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={pub.company_logo_url} alt={pub.company_name || "Company logo"} className="h-16 w-16 rounded-full object-cover border" />
          ) : (
            <UserAvatar avatarUrl={null} name={`${pub.first_name} ${pub.last_name}`} className="h-16 w-16" />
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <p className="font-bold text-lg">{pub.first_name} {pub.last_name}</p>
              {pub.is_verified_business && (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-100 rounded-full px-2 py-0.5">
                  <BadgeCheck className="h-3 w-3" /> Verified Business
                </span>
              )}
            </div>
            {pub.company_name ? (
              <p className="text-sm text-muted-foreground flex items-center gap-1"><Building2 className="h-3.5 w-3.5" /> {pub.company_name}{pub.industry ? ` · ${pub.industry}` : ""}</p>
            ) : (
              <p className="text-sm text-muted-foreground">Individual client</p>
            )}
            {pub.company_website && (
              <a href={pub.company_website} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline flex items-center gap-1 mt-0.5">
                <Globe className="h-3 w-3" /> {pub.company_website}
              </a>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-lg border bg-muted/30 p-3 text-center">
            <p className="text-lg font-bold flex items-center justify-center gap-1">
              {pub.hire_rate !== null && pub.hire_rate !== undefined ? (
                <><TrendingUp className="h-3.5 w-3.5 text-emerald-600" /> {pub.hire_rate}%</>
              ) : "New"}
            </p>
            <p className="text-xs text-muted-foreground">Hire rate</p>
          </div>
          <div className="rounded-lg border bg-muted/30 p-3 text-center">
            <p className="text-lg font-bold">{pub.completed_project_count}</p>
            <p className="text-xs text-muted-foreground">Completed projects</p>
          </div>
          <div className="rounded-lg border bg-muted/30 p-3 text-center">
            <p className="text-lg font-bold">{pub.open_project_count}</p>
            <p className="text-xs text-muted-foreground">Open jobs</p>
          </div>
          <div className="rounded-lg border bg-muted/30 p-3 text-center">
            <p className="text-xs font-semibold flex items-center justify-center gap-1"><Calendar className="h-3 w-3" /> {fmtMemberSince(pub.member_since)}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Member since</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-3 text-xs">
          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 ${pub.kyc_verified ? "text-emerald-700 bg-emerald-100" : "text-muted-foreground bg-muted"}`}>
            <ShieldCheck className="h-3.5 w-3.5" /> {pub.kyc_verified ? "Identity verified" : "Identity not verified"}
          </span>
          {pub.payment_verified && (
            <span className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-emerald-700 bg-emerald-100" title="Has successfully funded a project before">
              <Wallet className="h-3.5 w-3.5" /> Payment verified
            </span>
          )}
        </div>

        {pub.company_description && (
          <div>
            <h2 className="text-sm font-semibold mb-1">About</h2>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{pub.company_description}</p>
          </div>
        )}

        {preferredLabels.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold mb-2">Typically Hires For</h2>
            <div className="flex flex-wrap gap-1.5">
              {preferredLabels.map((l) => <Badge key={l} variant="secondary" className="text-xs rounded-full">{l}</Badge>)}
            </div>
          </div>
        )}
      </div>

      <div className="rounded-xl border bg-background p-6 space-y-3">
        <h2 className="text-sm font-semibold">Reviews from Professionals ({reviews.length})</h2>
        {reviews.length === 0 && <p className="text-sm text-muted-foreground">No reviews yet. Professionals who've worked with this client can leave a review once a project completes.</p>}
        {reviews.map((r) => <ReviewCard key={r.id} review={r} />)}
      </div>
    </div>
  );
}
