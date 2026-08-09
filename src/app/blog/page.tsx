import type { Metadata } from "next";
import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { BlogPage } from "@/components/site/pages/HomePage";

export const metadata: Metadata = {
  title: "Blog | YH Connect",
  description: "News, guides, and updates from YH Connect, Nigeria's construction talent marketplace.",
};

export default function Page() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1">
        <BlogPage />
      </main>
      <Footer />
    </div>
  );
}
