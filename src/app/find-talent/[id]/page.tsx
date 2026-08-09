import type { Metadata } from "next";
import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { PublicProfessionalProfile } from "@/components/site/pages/PublicProfessionalProfile";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") || "http://localhost:8000/api/v1";

async function fetchProfessional(id: string) {
  try {
    const res = await fetch(`${API_BASE}/professionals/${id}`, { next: { revalidate: 300 } });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const pro = await fetchProfessional(id);
  if (!pro) {
    return { title: "Professional Profile, YH Connect" };
  }
  const name = `${pro.first_name} ${pro.last_name}`;
  const title = `${name}, ${pro.title} | YH Connect`;
  const description = pro.bio
    ? pro.bio.slice(0, 155)
    : `${name} is a ${pro.title} on YH Connect${pro.location ? `, based in ${pro.location}` : ""}. View their profile, portfolio, and reviews.`;
  return {
    title,
    description,
    openGraph: { title, description, type: "profile" },
  };
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1">
        <PublicProfessionalProfile profileId={id} />
      </main>
      <Footer />
    </div>
  );
}
