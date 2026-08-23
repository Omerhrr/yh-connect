import type { Metadata } from "next";
import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { ForTalentsPage } from "@/components/site/pages/HomePage";

export const metadata: Metadata = {
  title: "For Professionals | YH Connect",
  description: "Create a free professional profile, browse construction projects, and get paid securely on YH Connect.",
};

export default function Page() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1">
        <ForTalentsPage />
      </main>
      <Footer />
    </div>
  );
}
