import { cn } from "@/lib/cn";

interface SkeletonProps {
  className?: string;
}

/*
 * Subtle pulsing rectangle for loading.tsx fallbacks. Receipt-styled —
 * uses the surface-deep token + paper-grain stripe instead of the
 * default Tailwind animate-pulse-on-gray pattern that screams "this is
 * a generic shadcn site". Same shape every time; consumers vary size
 * via className.
 */
export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      aria-hidden
      className={cn(
        "animate-pulse bg-surface-deep",
        className,
      )}
    />
  );
}
