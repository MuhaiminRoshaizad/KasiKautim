"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

import { cn } from "@/lib/cn";

interface CopyButtonProps {
  value: string;
  label?: string;
  className?: string;
  /** Optional aria-label override; defaults to a sensible "Copy <label>". */
  ariaLabel?: string;
  /** Visual size — mirrors Button sizing. */
  size?: "sm" | "md" | "lg";
}

const SIZES = {
  // Mobile bumps sm to 44px to match the Button component's tap-target
  // floor; tightens at sm+ for mouse-precise contexts.
  sm: "h-11 sm:h-9 px-3 text-sm gap-1.5",
  md: "h-11 px-4 text-base gap-2",
  lg: "h-14 px-6 text-lg gap-2",
} as const;

export function CopyButton({
  value,
  label = "Copy",
  className,
  ariaLabel,
  size = "md",
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const onClick = async () => {
    try {
      await navigator.clipboard.writeText(value);
      if ("vibrate" in navigator) navigator.vibrate(8);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard blocked — silently fail; user can long-press to copy text.
    }
  };

  const Icon = copied ? Check : Copy;

  return (
    <>
      <button
        type="button"
        onClick={onClick}
        aria-label={ariaLabel ?? `Copy ${label.toLowerCase()}`}
        className={cn(
          "inline-flex items-center justify-center border border-border bg-surface font-medium tracking-tight text-foreground",
          "transition-[color,background-color,transform] duration-150 hover:bg-surface-deep active:scale-[0.97]",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          SIZES[size],
          copied && "border-ringgit text-ringgit",
          className,
        )}
      >
        <Icon size={16} aria-hidden />
        <span>{copied ? "Copied" : label}</span>
      </button>
      {/*
       * Screen-reader-only live region. The button's visible label flips
       * from Copy -> Copied, but most screen readers don't re-announce
       * button text on activation unless focus changes. role=status +
       * aria-live=polite ensures the success is spoken without stealing
       * focus.
       */}
      <span role="status" aria-live="polite" className="sr-only">
        {copied ? "Copied to clipboard" : ""}
      </span>
    </>
  );
}
