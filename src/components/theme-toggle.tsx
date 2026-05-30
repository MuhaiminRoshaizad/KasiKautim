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
    // Sync with the <html data-theme> the ThemeBootstrap script set before
    // hydration. The new react-hooks/set-state-in-effect rule flags this, but
    // there's no clean alternative: server can't know the user's preference,
    // and useSyncExternalStore would need a MutationObserver for one read.
    // eslint-disable-next-line react-hooks/set-state-in-effect
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
        // Visual + interaction parity with the dashboard layout's
        // ICON_BTN (settings, sign-out) - same height/width, rounded
        // corners, press feedback. The two were drifting because each
        // file owned its own class string.
        "inline-flex h-11 w-11 sm:h-10 sm:w-10 items-center justify-center rounded-lg",
        "border border-border bg-surface text-foreground",
        "transition-[color,background-color,transform] duration-150 hover:bg-surface-deep active:scale-95",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        className,
      )}
    >
      <Icon size={18} aria-hidden />
    </button>
  );
}
