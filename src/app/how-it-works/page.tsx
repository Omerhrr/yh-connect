import type { Metadata } from "next";
import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { HowItWorksPage } from "@/components/site/pages/HomePage";

export const metadata: Metadata = {
  title: "How It Works | YH Connect",
  description: "See how YH Connect connects clients with verified construction professionals, from posting a project to paying securely via escrow.",
};

export default function Page() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1">
        <HowItWorksPage />
      </main>
      <Footer />
    </div>
  );
}
