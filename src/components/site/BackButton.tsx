"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

/**
 * Shared back button dropped into dashboard sub-page headers. Uses real
 * browser history (`router.back()`) so it works with the browser/gesture
 * back button too, falls back to `fallbackHref` when there's no history to
 * pop to (e.g. someone lands directly on a deep link).
 */
export function BackButton({
  fallbackHref,
  label = "Back",
  className = "",
}: {
  fallbackHref: string;
  label?: string;
  className?: string;
}) {
  const router = useRouter();

  const handleClick = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push(fallbackHref);
    }
  };

  return (
    <button
      onClick={handleClick}
      className={`inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors ${className}`}
    >
      <ArrowLeft className="h-4 w-4" />
      {label}
    </button>
  );
}
