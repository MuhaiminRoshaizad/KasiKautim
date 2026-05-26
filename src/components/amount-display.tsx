import { cn } from "@/lib/cn";
import { formatAmount, formatMYR } from "@/lib/money";

type Size = "sm" | "md" | "lg" | "xl";

interface AmountDisplayProps {
  cents: number;
  size?: Size;
  withSymbol?: boolean;
  className?: string;
  muted?: boolean;
}

const sizes: Record<Size, string> = {
  sm: "text-sm",
  md: "text-base",
  lg: "text-2xl",
  xl: "text-5xl",
};

export function AmountDisplay({
  cents,
  size = "md",
  withSymbol = true,
  className,
  muted = false,
}: AmountDisplayProps) {
  return (
    <span
      className={cn(
        "font-mono tabular tracking-tight",
        muted ? "text-foreground-soft" : "text-foreground",
        sizes[size],
        className,
      )}
    >
      {withSymbol ? formatMYR(cents) : formatAmount(cents)}
    </span>
  );
}
