import { cn } from "@/lib/cn";

interface InkStampProps {
  label: string;
  variant?: "paid" | "overdue" | "draft";
  className?: string;
  /** Rotation in degrees. Receipts feel hand-stamped when slightly off-axis. */
  rotate?: number;
}

const variants: Record<NonNullable<InkStampProps["variant"]>, string> = {
  paid: "text-ringgit border-ringgit",
  overdue: "text-stamp border-stamp",
  draft: "text-foreground-soft border-foreground-soft",
};

export function InkStamp({
  label,
  variant = "paid",
  className,
  rotate = -8,
}: InkStampProps) {
  return (
    <span
      className={cn(
        "inline-block select-none border-2 px-3 py-1",
        "font-display text-lg uppercase tracking-[0.18em]",
        "opacity-90",
        variants[variant],
        className,
      )}
      style={{ transform: `rotate(${rotate}deg)` }}
    >
      {label}
    </span>
  );
}
