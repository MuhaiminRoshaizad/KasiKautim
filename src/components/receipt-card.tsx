import type { HTMLAttributes, ReactNode } from "react";

import { cn } from "@/lib/cn";

interface ReceiptCardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  /** Apply the torn-bottom mask for that paper-receipt feel. */
  torn?: boolean;
  /** Use the kopitiam-tissue brown background instead of paper white. */
  tissue?: boolean;
  /**
   * Flat tile variant for in-list cards (dashboard, repeating grids).
   * Drops the torn-bottom mask, rounds corners, and softens the shadow
   * so a list of cards reads as an app tile stack instead of a stack
   * of overlapping paper receipts. Use the default (torn + sharp) for
   * standalone hero cards on bill detail / public / report pages
   * where the receipt aesthetic carries the page.
   */
  flat?: boolean;
}

export function ReceiptCard({
  children,
  torn = true,
  tissue = false,
  flat = false,
  className,
  ...rest
}: ReceiptCardProps) {
  const showTorn = torn && !flat;
  return (
    <div
      className={cn(
        // `receipt-card` is referenced by the print stylesheet to tighten
        // padding for the saved PDF. Keep it on every variant.
        "receipt-card",
        "relative isolate w-full",
        // Slightly off-white paper, soft drop-shadow imitating receipt curl.
        tissue ? "bg-tissue" : "bg-surface",
        "border border-border",
        flat
          ? "rounded-xl shadow-[0_1px_0_rgba(0,0,0,0.03),0_6px_14px_-10px_rgba(0,0,0,0.16)]"
          : "shadow-[0_2px_0_rgba(0,0,0,0.04),0_12px_24px_-12px_rgba(0,0,0,0.18)]",
        // Subtle paper grain via the utility from globals.css. Skip on
        // flat tiles - grain reads as receipt texture and we want these
        // to look like app surfaces.
        flat ? "" : "paper-grain",
        showTorn ? "torn-bottom pb-6" : "",
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
