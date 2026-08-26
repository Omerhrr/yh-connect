import type { Metadata } from "next";
import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { ProjectPreview } from "@/components/site/dashboard/ProjectPreview";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") || "http://localhost:8000/api/v1";

async function fetchProject(id: string) {
  try {
    const res = await fetch(`${API_BASE}/projects/${id}`, { next: { revalidate: 300 } });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const project = await fetchProject(id);
  if (!project) {
    return { title: "Project | YH Connect" };
  }
  const title = `${project.title} | YH Connect`;
  const description = project.description
    ? project.description.slice(0, 155)
    : `${project.title} is an open construction project on YH Connect${project.location ? `, based in ${project.location}` : ""}. View details and submit a bid.`;
  return {
    title,
    description,
    openGraph: { title, description, type: "website" },
  };
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1 container mx-auto px-4 py-12 max-w-5xl">
        <ProjectPreview projectId={id} />
      </main>
      <Footer />
    </div>
  );
}
