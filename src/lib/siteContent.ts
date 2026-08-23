"use client";

// Admin-editable structured content for the site header, footer, and
// homepage sections. Every shape here has a hardcoded DEFAULT matching the
// original copy exactly, so the site looks identical until an admin
// actually customizes a section in /admin/content -> Site Content. This
// mirrors the CmsPage.tsx pattern (override falls back to default), just
// for structured sections instead of a single title+body page.

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

export type NavLink = { label: string; href: string };

export type HeaderContent = {
  nav_links: NavLink[];
};

export type FooterLinkColumn = { title: string; links: NavLink[] };

export type FooterContent = {
  tagline: string;
  social: { twitter: string; linkedin: string; instagram: string; email: string };
  columns: FooterLinkColumn[];
  copyright: string;
};

export type HeroContent = {
  heading: string;
  subheading: string;
  search_placeholder: string;
  cta_label: string;
  popular_searches: string[];
  // Optional background photos, admin-uploaded in CMS. Empty by default, so
  // the hero renders exactly as it always has (gradient + blobs, no photo)
  // until an admin adds at least one. With 2+, they cross-fade as a subtle
  // blurred slideshow behind the existing content.
  background_images: string[];
};

export type StepItem = { title: string; description: string };

export type HowItWorksContent = {
  badge: string;
  title: string;
  subtitle: string;
  steps: StepItem[];
  primary_cta_label: string;
  secondary_cta_label: string;
};

export type WhyChooseItem = { title: string; description: string };

export type WhyChooseContent = {
  badge: string;
  title: string;
  subtitle: string;
  items: WhyChooseItem[];
};

export type CtaBannerContent = {
  title: string;
  subtitle: string;
  primary_label: string;
  secondary_label: string;
};

export const SITE_CONTENT_DEFAULTS = {
  "header": {
    nav_links: [
      { label: "For Clients", href: "/for-clients" },
      { label: "For Professionals", href: "/for-talents" },
      { label: "How It Works", href: "/how-it-works" },
      { label: "Find Professionals", href: "/find-talent" },
      { label: "Find Projects", href: "/find-work" },
    ],
  } satisfies HeaderContent,

  "footer": {
    tagline: "Connecting Nigerian clients with verified architects, engineers, contractors, and construction trades.",
    social: { twitter: "https://twitter.com", linkedin: "https://linkedin.com", instagram: "https://instagram.com", email: "mailto:hello@yhconnect.ng" },
    columns: [
      {
        title: "For Clients",
        links: [
          { label: "For Clients", href: "/for-clients" },
          { label: "Find Professionals", href: "/find-talent" },
          { label: "How It Works", href: "/how-it-works" },
          { label: "Post a Project", href: "/client/register" },
          { label: "Client Login", href: "/client/login" },
        ],
      },
      {
        title: "For Professionals",
        links: [
          { label: "For Professionals", href: "/for-talents" },
          { label: "Find Projects", href: "/find-work" },
          { label: "Create Profile", href: "/talent/register" },
          { label: "Professional Login", href: "/talent/login" },
        ],
      },
      {
        title: "Company",
        links: [
          { label: "Blog", href: "/blog" },
          { label: "FAQ", href: "/faq" },
          { label: "Privacy Policy", href: "/privacy" },
          { label: "Terms of Service", href: "/terms" },
          { label: "← Back to Yahya Hub", href: "https://yhub.ng" },
        ],
      },
    ],
    copyright: "YH Connect · A product of Yahya Hub, Abuja, Nigeria. All rights reserved.",
  } satisfies FooterContent,

  "homepage.hero": {
    heading: "Hire Verified Construction Professionals. Build with Confidence.",
    subheading: "YH Connect bridges ambitious clients with verified Nigerian architects, engineers, contractors and construction trades. Post projects, review proposals, track site progress, and pay securely via escrow, all in one place.",
    search_placeholder: "What do you need built or designed?",
    cta_label: "Get Started",
    popular_searches: ["Structural Engineer", "Architect", "General Contractor", "Quantity Surveyor"],
    background_images: [],
  } satisfies HeroContent,

  "homepage.how_it_works": {
    badge: "Simple Process",
    title: "How YH Connect Works",
    subtitle: "Get your project done in three simple steps: post, review, and pay.",
    steps: [
      { title: "Post Your Project", description: "Describe what you need, set a budget, and post it free, in minutes." },
      { title: "Review Proposals", description: "Compare bids from verified professionals and pick the right fit for your project." },
      { title: "Pay Securely via Escrow", description: "Funds are held safely and released as milestones are approved, so both sides are protected." },
    ],
    primary_cta_label: "Post a Project Free",
    secondary_cta_label: "Become a Talent",
  } satisfies HowItWorksContent,

  "homepage.why_choose": {
    badge: "Why YH Connect",
    title: "Built for the Construction Industry",
    subtitle: "We understand the unique needs of Nigerian architects, engineers, contractors and clients.",
    items: [
      { title: "Verified Professionals", description: "Every professional is identity-checked, so you know who you're hiring." },
      { title: "Escrow Protection", description: "Payments are held securely and released only when work is approved." },
      { title: "Local Expertise", description: "Built specifically for the Nigerian construction market and its trades." },
      { title: "Transparent Pricing", description: "See budgets and proposals up front, no hidden fees or surprises." },
    ],
  } satisfies WhyChooseContent,

  "homepage.cta_banner": {
    title: "Ready to Get Started?",
    subtitle: "Join thousands of clients and professionals already using YH Connect to collaborate and grow.",
    primary_label: "Hire a Professional",
    secondary_label: "Offer Your Services",
  } satisfies CtaBannerContent,
};

export type SiteContentKey = keyof typeof SITE_CONTENT_DEFAULTS;

// Fetch-once, shared across every useSiteContent() caller on the page so N
// components each editing a different section don't fire N requests.
let cachePromise: Promise<Record<string, unknown>> | null = null;
function fetchAll(): Promise<Record<string, unknown>> {
  if (!cachePromise) {
    cachePromise = api.siteContent().catch(() => ({}));
  }
  return cachePromise;
}

/** Invalidate the shared cache, call after an admin saves a section so the
 * next mount (e.g. reopening the editor, or a live preview) refetches. */
export function invalidateSiteContentCache() {
  cachePromise = null;
}

export function useSiteContent<K extends SiteContentKey>(key: K): (typeof SITE_CONTENT_DEFAULTS)[K] {
  const fallback = SITE_CONTENT_DEFAULTS[key];
  const [data, setData] = useState(fallback);

  useEffect(() => {
    let cancelled = false;
    fetchAll().then((all) => {
      if (cancelled) return;
      const override = all[key];
      if (override && typeof override === "object") {
        setData({ ...fallback, ...override } as typeof fallback);
      }
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return data;
}
