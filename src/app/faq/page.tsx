import type { Metadata } from "next";
import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { FaqPage } from "@/components/site/pages/HomePage";

export const metadata: Metadata = {
  title: "FAQ | YH Connect",
  description: "Answers to common questions about posting projects, getting hired, payments, and escrow on YH Connect.",
};

export default function Page() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1">
        <FaqPage />
      </main>
      <Footer />
    </div>
  );
}
