import type { HTMLAttributes, ReactNode } from "react";

import { cn } from "@/lib/cn";

interface ReceiptCardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  /** Apply the torn-bottom mask for that paper-receipt feel. */
  torn?: boolean;
  /** Use the kopitiam-tissue brown background instead of paper white. */
  tissue?: boolean;
}

export function ReceiptCard({
  children,
  torn = true,
  tissue = false,
  className,
  ...rest
}: ReceiptCardProps) {
  return (
    <div
      className={cn(
        "relative isolate w-full",
        // Slightly off-white paper, soft drop-shadow imitating receipt curl.
        tissue ? "bg-tissue" : "bg-surface",
        "border border-border",
        "shadow-[0_2px_0_rgba(0,0,0,0.04),0_12px_24px_-12px_rgba(0,0,0,0.18)]",
        // Subtle paper grain via the utility from globals.css.
        "paper-grain",
        torn ? "torn-bottom pb-3" : "",
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

interface ReceiptDividerProps {
  className?: string;
  label?: string;
}

export function ReceiptDivider({ className, label }: ReceiptDividerProps) {
  return (
    <div
      role="separator"
      className={cn(
        "my-3 flex items-center gap-3 text-[10px] font-medium uppercase tracking-widest text-foreground-faint",
        className,
      )}
    >
      <span className="h-px flex-1 bg-border" />
      {label ? <span>{label}</span> : null}
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}
