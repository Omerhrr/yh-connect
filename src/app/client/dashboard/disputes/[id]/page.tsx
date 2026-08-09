import { DisputeCaseView } from "@/components/site/pages/DashboardPages";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <DisputeCaseView disputeId={id} backHref="/client/dashboard/disputes" />;
}
