"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/store/theme";

export function ThemeToggle({ className = "" }: { className?: string }) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      onClick={toggleTheme}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className={`relative p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors ${className}`}
    >
      <Sun className={`h-5 w-5 transition-all ${isDark ? "scale-0 -rotate-90 absolute" : "scale-100 rotate-0"}`} />
      <Moon className={`h-5 w-5 transition-all ${isDark ? "scale-100 rotate-0" : "scale-0 rotate-90 absolute"}`} />
    </button>
  );
}
