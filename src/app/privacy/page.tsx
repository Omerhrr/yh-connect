import type { Metadata } from "next";
import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { PrivacyPage } from "@/components/site/pages/HomePage";

export const metadata: Metadata = {
  title: "Privacy Policy | YH Connect",
  description: "Read how YH Connect collects, uses, and protects your personal information.",
};

export default function Page() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1">
        <PrivacyPage />
      </main>
      <Footer />
    </div>
  );
}
