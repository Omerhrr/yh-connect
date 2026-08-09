"use client";

import { useEffect, useState } from "react";
import { api, type ContentPageOut } from "@/lib/api";

/**
 * Renders admin-edited CMS content for a static page when it exists,
 * falling back to the given hardcoded JSX otherwise (and while loading, so
 * there's never a blank flash). Once an admin creates/edits a page with a
 * matching slug in /admin/content, this swaps to that content automatically.
 */
export function CmsPage({ slug, children }: { slug: string; children: React.ReactNode }) {
  const [content, setContent] = useState<ContentPageOut | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .contentPage(slug)
      .then((c) => {
        if (!cancelled) setContent(c);
      })
      .catch(() => {
        // No CMS override for this slug yet, keep showing the fallback.
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (!content) return <>{children}</>;

  return (
    <div className="container mx-auto px-4 py-16 max-w-3xl prose prose-sm">
      <h1>{content.title}</h1>
      <p className="text-muted-foreground text-sm">
        Last updated: {new Date(content.updated_at).toLocaleDateString()}
      </p>
      <div className="whitespace-pre-wrap">{content.body}</div>
    </div>
  );
}
