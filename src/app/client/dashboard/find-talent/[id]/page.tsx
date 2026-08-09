import { ProfessionalPreview } from "@/components/site/pages/DashboardPages";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ProfessionalPreview profileId={id} backHref="/client/dashboard/find-talent" />;
}
