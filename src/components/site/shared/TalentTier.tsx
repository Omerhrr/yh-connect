"use client";

import { Award } from "lucide-react";
import type { CertificationOut } from "@/lib/api";

const TIER_STYLES: Record<1 | 2 | 3, string> = {
  1: "bg-muted text-muted-foreground border-muted-foreground/20",
  2: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900",
  3: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900",
};

const TIER_TITLES: Record<1 | 2 | 3, string> = {
  1: "Tier 1: not yet identity-verified",
  2: "Tier 2: identity (NIN) verified",
  3: "Tier 3: identity and address fully verified",
};

/** Small pill showing a professional's talent tier (1/2/3). */
export function TierTag({ tier, className = "" }: { tier: 1 | 2 | 3; className?: string }) {
  return (
    <span
      title={TIER_TITLES[tier]}
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${TIER_STYLES[tier]} ${className}`}
    >
      Tier {tier}
    </span>
  );
}

/**
 * Admin-approved credential badges (COREN, ARCON, etc). Only certifications
 * with verification_status "verified" render, each is its own hoverable
 * badge showing that credential's name (and issuing body, if any) on hover.
 */
export function CertificationBadges({ certifications, className = "" }: { certifications: CertificationOut[]; className?: string }) {
  const verified = certifications.filter((c) => c.verification_status === "verified");
  if (verified.length === 0) return null;
  return (
    <div className={`flex flex-wrap items-center gap-1 ${className}`}>
      {verified.map((c) => (
        <span
          key={c.id}
          title={c.issuing_body ? `${c.name}, ${c.issuing_body}` : c.name}
          className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900 px-2 py-0.5 text-[11px] font-medium"
        >
          <Award className="h-3 w-3" />
          {c.badge_name || c.name}
        </span>
      ))}
    </div>
  );
}
