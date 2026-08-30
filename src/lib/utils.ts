import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatNaira(n: number): string {
  return `₦${n.toLocaleString()}`;
}

export function formatBudgetRange(min: number, max: number, hourly = false): string {
  if (min === 0 && max === 0) return "Budget Not Set";
  const suffix = hourly ? "/day" : "";
  if (min === max) return `${formatNaira(min)}${suffix}`;
  return `${formatNaira(min)} – ${formatNaira(max)}${suffix}`;
}
