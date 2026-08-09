import { ProjectPreview } from "@/components/site/dashboard/ProjectPreview";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ProjectPreview projectId={id} backHref="/talent/dashboard/find-work" />;
}
