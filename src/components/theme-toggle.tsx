"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

import { THEME_STORAGE_KEY } from "@/lib/constants";
import { cn } from "@/lib/cn";

type Resolved = "light" | "dark";

function readInitial(): Resolved {
  if (typeof document === "undefined") return "light";
  const attr = document.documentElement.getAttribute("data-theme");
  return attr === "dark" ? "dark" : "light";
}

export function ThemeToggle({ className }: { className?: string }) {
  const [resolved, setResolved] = useState<Resolved>("light");

  useEffect(() => {
    setResolved(readInitial());
  }, []);

  const toggle = () => {
    const next: Resolved = resolved === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Storage blocked — keep the in-memory toggle working anyway.
    }
    setResolved(next);
  };

  const Icon = resolved === "dark" ? Sun : Moon;
  const label = resolved === "dark" ? "Switch to light mode" : "Switch to dark mode";

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex h-10 w-10 items-center justify-center",
        "border border-border bg-surface text-foreground",
        "transition-colors hover:bg-surface-deep",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        className,
      )}
    >
      <Icon size={18} aria-hidden />
    </button>
  );
}
