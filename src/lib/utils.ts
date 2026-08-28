import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatNaira(n: number): string {
  return `₦${n.toLocaleString()}`;
}

/**
 * Renders a budget range, collapsing equal min/max into a single figure.
 * Projects created through the onboarding wizard only capture one budget
 * number (posted as min === max), which would otherwise render as the
 * awkward "₦500,000 – ₦500,000" across every listing.
 */
export function formatBudgetRange(min: number, max: number, hourly = false): string {
  // 0/0 means the client didn't set a budget — they want talent to send a quote.
  if (min === 0 && max === 0) return "Budget Not Set";
  const suffix = hourly ? "/day" : "";
  if (min === max) return `${formatNaira(min)}${suffix}`;
  return `${formatNaira(min)} – ${formatNaira(max)}${suffix}`;
}
