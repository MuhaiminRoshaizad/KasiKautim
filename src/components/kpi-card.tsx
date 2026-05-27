import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

interface KpiCardProps {
  label: string;
  value: ReactNode;
  sublabel?: ReactNode;
  className?: string;
}

/**
 * Small stat card for the per-bill report KPI strip.
 * Big value, small label above, optional sublabel below.
 */
export function KpiCard({ label, value, sublabel, className }: KpiCardProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-1 border border-border bg-surface p-4",
        className,
      )}
    >
      <div className="text-[10px] font-medium uppercase tracking-widest text-foreground-faint">
        {label}
      </div>
      <div className="font-display text-2xl uppercase leading-tight tracking-tight text-foreground sm:text-3xl">
        {value}
      </div>
      {sublabel ? (
        <div className="text-xs text-foreground-soft">{sublabel}</div>
      ) : null}
    </div>
  );
}
