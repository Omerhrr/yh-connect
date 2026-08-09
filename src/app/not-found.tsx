"use client";

import Link from "next/link";
import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1">
        <div className="container mx-auto flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
          <p className="text-7xl font-bold text-primary">404</p>
          <h1 className="mt-4 text-2xl font-semibold">Page Not Found</h1>
          <p className="mt-2 text-muted-foreground">
            Sorry, we couldn&apos;t find the page you were looking for.
          </p>
          <Link
            href="/"
            className="mt-6 rounded-md bg-primary px-6 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Back to Home
          </Link>
        </div>
      </main>
      <Footer />
    </div>
  );
}
