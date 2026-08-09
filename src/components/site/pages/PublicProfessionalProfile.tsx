"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/store/auth";
import { api, type ProfessionalOut, type ReviewOut } from "@/lib/api";
import { InviteToProjectDialog } from "@/components/site/pages/DashboardPages";
import { ProfessionalProfileView } from "@/components/site/pages/ProfessionalProfileView";
import { toast } from "sonner";

/**
 * Public (no-login-required) professional profile, reached from the public
 * Find Professionals directory. Anyone can browse this. Reaching out (Invite)
 * is where we ask an anonymous visitor to register, and where a registered
 * but not-yet-KYC'd client is prompted to verify their identity first.
 */
export function PublicProfessionalProfile({ profileId }: { profileId: string }) {
  const router = useRouter();
  const { user } = useAuth();
  const [pro, setPro] = useState<ProfessionalOut | null>(null);
  const [reviews, setReviews] = useState<ReviewOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);

  useEffect(() => {
    api
      .professional(profileId)
      .then((p) => {
        setPro(p);
        return api.reviewsForUser(p.user_id).then(setReviews).catch(() => {});
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [profileId]);

  const handleHire = () => {
    if (!user) {
      router.push(`/client/register?next=${encodeURIComponent(`/find-talent/${profileId}`)}`);
      return;
    }
    if (user.role !== "client") {
      toast.error("Only client accounts can invite professionals to a project.");
      return;
    }
    if (user.kyc_status !== "verified") {
      toast.error("Please verify your identity before contacting professionals.", {
        description: "Head to Settings to submit your NIN, it only takes a moment.",
        action: { label: "Verify now", onClick: () => router.push("/client/dashboard/settings") },
      });
      return;
    }
    setInviteOpen(true);
  };

  if (loading) return <div className="container mx-auto px-4 py-12 text-sm text-muted-foreground">Loading…</div>;
  if (!pro) return <div className="container mx-auto px-4 py-12 text-sm text-muted-foreground">Professional not found.</div>;

  return (
    <div className="container mx-auto px-4 py-12 max-w-2xl">
      <ProfessionalProfileView
        pro={pro}
        reviews={reviews}
        hireAction={
          <Button className="w-full bg-emerald-600 hover:bg-emerald-700" onClick={handleHire}>
            Hire {pro.first_name}
          </Button>
        }
      />

      {inviteOpen && (
        <InviteToProjectDialog
          professional={pro}
          onClose={() => setInviteOpen(false)}
        />
      )}
    </div>
  );
}
