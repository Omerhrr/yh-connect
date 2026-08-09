import { Suspense } from "react";
import type { Metadata } from "next";
import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { FindTalentPage } from "@/components/site/pages/HomePage";

export const metadata: Metadata = {
  title: "Find Construction Professionals | YH Connect",
  description: "Browse verified Nigerian architects, engineers, contractors, and construction trades on YH Connect.",
};

export default function Page() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1">
        <Suspense>
          <FindTalentPage />
        </Suspense>
      </main>
      <Footer />
    </div>
  );
}
