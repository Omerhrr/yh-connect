"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/store/auth";
import { api, type ProfessionalOut, type ReviewOut } from "@/lib/api";
import { InviteToProjectDialog } from "@/components/site/pages/DashboardPages";
import { ProfessionalProfileView } from "@/components/site/pages/ProfessionalProfileView";
import { toast } from "sonner";
import { ShieldCheck } from "lucide-react";
import { useFeatures } from "@/lib/features";

export function PublicProfessionalProfile({ profileId }: { profileId: string }) {
  const router = useRouter();
  const { user } = useAuth();
  const [pro, setPro] = useState<ProfessionalOut | null>(null);
  const [reviews, setReviews] = useState<ReviewOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [guarantors, setGuarantors] = useState<{ id: string; name: string | null }[]>([]);
  const { guarantors: guarantorsEnabled } = useFeatures();

  useEffect(() => {
    api.publicGuarantors(profileId).then(setGuarantors).catch(() => setGuarantors([]));
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

      {guarantorsEnabled && guarantors.length > 0 && (
        <div className="mt-6 rounded-xl border bg-background p-5">
          <p className="text-sm font-semibold flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-emerald-600" /> Guaranteed by</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {guarantors.map((g) => (
              <span key={g.id} className="rounded-full border bg-emerald-50 dark:bg-emerald-950/30 px-3 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-300">{g.name}</span>
            ))}
          </div>
        </div>
      )}

      {inviteOpen && (
        <InviteToProjectDialog
          professional={pro}
          onClose={() => setInviteOpen(false)}
        />
      )}
    </div>
  );
}
