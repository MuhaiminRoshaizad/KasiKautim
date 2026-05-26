import { forwardRef } from "react";
import type { ButtonHTMLAttributes } from "react";

import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "stamp";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

const variants: Record<Variant, string> = {
  primary:
    "bg-ringgit text-paper hover:bg-ringgit/90 active:bg-ringgit/95 focus-visible:ring-ringgit",
  secondary:
    "bg-surface text-foreground border border-border hover:bg-surface-deep focus-visible:ring-foreground",
  ghost:
    "bg-transparent text-foreground hover:bg-surface-deep focus-visible:ring-foreground",
  stamp:
    "bg-stamp text-paper hover:bg-stamp/90 active:bg-stamp/95 focus-visible:ring-stamp",
};

const sizes: Record<Size, string> = {
  sm: "h-9 px-3 text-sm",
  md: "h-11 px-5 text-base",
  lg: "h-14 px-7 text-lg",
};

/**
 * Returns the class string used by Button. Exported so Link / anchor elements
 * can adopt button styling without needing a Slot/asChild pattern.
 */
export function buttonClassName({
  variant = "primary",
  size = "md",
  className,
}: {
  variant?: Variant;
  size?: Size;
  className?: string;
} = {}): string {
  return cn(
    "inline-flex items-center justify-center gap-2 font-medium tracking-tight",
    "transition-colors duration-150 ease-out",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
    "disabled:opacity-50 disabled:cursor-not-allowed",
    "rounded-sm shadow-[0_1px_0_rgba(0,0,0,0.04)]",
    variants[variant],
    sizes[size],
    className,
  );
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    { variant = "primary", size = "md", className, type = "button", ...rest },
    ref,
  ) {
    return (
      <button
        ref={ref}
        type={type}
        className={buttonClassName({ variant, size, className })}
        {...rest}
      />
    );
  },
);
