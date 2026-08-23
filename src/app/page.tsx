import type { Metadata } from "next";
import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { HomePage } from "@/components/site/pages/HomePage";

export const metadata: Metadata = {
  title: "YH Connect | Hire Verified Construction Professionals in Nigeria",
  description:
    "Post construction projects and hire verified Nigerian architects, engineers, contractors, and trades. Compare proposals, track milestones, and pay securely via escrow.",
};

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1">
        <HomePage />
      </main>
      <Footer />
    </div>
  );
}
