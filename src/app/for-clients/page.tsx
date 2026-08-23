import type { Metadata } from "next";
import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { ForClientsPage } from "@/components/site/pages/HomePage";

export const metadata: Metadata = {
  title: "For Clients | YH Connect",
  description: "Post a project and hire verified construction professionals in Nigeria, pay securely via escrow.",
};

export default function Page() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1">
        <ForClientsPage />
      </main>
      <Footer />
    </div>
  );
}
