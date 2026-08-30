"use client";

import { useEffect, useState } from "react";
import { api, type ContentPageOut } from "@/lib/api";

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
