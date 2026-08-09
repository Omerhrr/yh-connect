import type { Metadata } from "next";
import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { TermsPage } from "@/components/site/pages/HomePage";

export const metadata: Metadata = {
  title: "Terms of Service | YH Connect",
  description: "The terms that govern your use of YH Connect.",
};

export default function Page() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1">
        <TermsPage />
      </main>
      <Footer />
    </div>
  );
}
