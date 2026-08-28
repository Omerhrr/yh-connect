"use client";

import { use } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ClientProfileView } from "@/components/site/pages/ClientProfileView";

export default function TalentClientProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  return (
    <div className="space-y-4">
      <Link href="/talent/dashboard/find-work" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back
      </Link>
      <ClientProfileView clientId={id} />
    </div>
  );
}
