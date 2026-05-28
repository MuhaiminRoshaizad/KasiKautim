"use client";

import { useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, RotateCcw } from "lucide-react";

import { Button, buttonClassName } from "@/components/button";
import { ReceiptCard, ReceiptDivider } from "@/components/receipt-card";
import { ThemeToggle } from "@/components/theme-toggle";
import { APP_NAME } from "@/lib/constants";
import { logger } from "@/lib/logger";

/*
 * Branded error boundary. Next routes any uncaught render error from
 * the route segment (and its children) through this component, passing
 * a `reset` function the user can click to re-attempt rendering.
 *
 * Must be a client component (Next requirement — the boundary catches
 * errors thrown during client render). Logged server-side via our
 * logger so the message gets PII-redacted before it hits the console.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Digest is Next's per-error correlation ID, safe to surface in
    // logs. Stack/message aren't logged here — they're already in
    // Next's server logs and might contain bill slugs / tokens.
    logger.error("route-level error", { digest: error.digest });
  }, [error]);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 pt-6 pb-12 sm:px-8">
      <header className="flex items-center justify-between">
        <Link
          href="/"
          className="font-display text-2xl uppercase tracking-[0.18em] text-foreground"
        >
          {APP_NAME}
        </Link>
        <ThemeToggle />
      </header>

      <div className="mt-16 flex flex-1 flex-col justify-center">
        <ReceiptCard className="p-6 text-center sm:p-8">
          <div className="font-mono text-[10px] uppercase tracking-widest text-stamp">
            Something tersangkut
          </div>
          <h1 className="mt-2 font-display text-3xl uppercase tracking-tight text-foreground sm:text-4xl">
            Page hit an error
          </h1>
          <p className="mx-auto mt-3 max-w-sm text-sm text-foreground-soft">
            Could be a one-off hiccup — try again. If it keeps
            happening, the tukang bayar can recreate the bill, or you
            can head back home and start fresh.
          </p>
          {error.digest ? (
            <p className="mt-4 font-mono text-[10px] uppercase tracking-widest text-foreground-faint">
              Ref · {error.digest}
            </p>
          ) : null}

          <ReceiptDivider />

          <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
            <Button
              type="button"
              onClick={reset}
              size="lg"
              className="font-display uppercase tracking-widest"
            >
              <RotateCcw size={18} aria-hidden />
              Try again
            </Button>
            <Link
              href="/"
              className={buttonClassName({
                variant: "ghost",
                size: "lg",
                className: "font-display uppercase tracking-widest",
              })}
            >
              <ArrowLeft size={18} aria-hidden />
              Back to home
            </Link>
          </div>
        </ReceiptCard>
      </div>
    </main>
  );
}
