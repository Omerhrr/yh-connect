import { ProjectDetailFetcher } from "@/components/site/dashboard/ProjectDetailFetcher";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ProjectDetailFetcher projectId={id} backHref="/client/dashboard/projects" />;
}
