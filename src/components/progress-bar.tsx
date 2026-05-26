import { cn } from "@/lib/cn";

interface ProgressBarProps {
  /** 0..1 */
  value: number;
  label?: string;
  className?: string;
}

export function ProgressBar({ value, label, className }: ProgressBarProps) {
  const pct = Math.max(0, Math.min(1, value));
  const percentText = `${Math.round(pct * 100)}%`;

  return (
    <div className={cn("w-full", className)}>
      {label != null ? (
        <div className="mb-2 flex items-baseline justify-between text-xs font-medium uppercase tracking-widest text-foreground-soft">
          <span>{label}</span>
          <span className="font-mono tabular text-foreground">{percentText}</span>
        </div>
      ) : null}
      <div
        role="progressbar"
        aria-valuenow={Math.round(pct * 100)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label ?? "Progress"}
        className="relative h-2 w-full overflow-hidden border border-border bg-surface"
      >
        <div
          className="h-full bg-ringgit transition-[width] duration-500 ease-out"
          style={{ width: `${pct * 100}%` }}
        />
      </div>
    </div>
  );
}
