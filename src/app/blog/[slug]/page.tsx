import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { BlogPostPage } from "@/components/site/pages/HomePage";

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1">
        <BlogPostPage slug={slug} />
      </main>
      <Footer />
    </div>
  );
}
