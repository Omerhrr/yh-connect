import type { Metadata } from "next";
import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { FindWorkPage } from "@/components/site/pages/HomePage";

export const metadata: Metadata = {
  title: "Find Construction Projects | YH Connect",
  description: "Browse open construction projects in Nigeria and submit proposals as a verified professional on YH Connect.",
};

export default function Page() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1">
        <FindWorkPage />
      </main>
      <Footer />
    </div>
  );
}
