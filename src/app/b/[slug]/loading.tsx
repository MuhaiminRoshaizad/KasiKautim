import Link from "next/link";

import { ReceiptCard, ReceiptDivider } from "@/components/receipt-card";
import { Skeleton } from "@/components/skeleton";
import { ThemeToggle } from "@/components/theme-toggle";
import { APP_NAME } from "@/lib/constants";

/*
 * Suspense fallback for /b/[slug]. Without this the recipient tap-
 * through from WhatsApp shows a blank flicker between cold-start and
 * first render — long enough on mobile that users wonder if the link
 * is broken. Matches the dashboard loading patterns: receipt-card
 * skeleton with a stamp-shaped header placeholder.
 */
export default function PublicBillLoading() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-6 pt-6 pb-12 sm:px-8">
      <header className="flex items-center justify-between">
        <Link
          href="/"
          className="font-display text-2xl uppercase tracking-[0.18em] text-foreground"
        >
          {APP_NAME}
        </Link>
        <ThemeToggle />
      </header>

      <div className="mt-6">
        <ReceiptCard tissue className="p-6 sm:p-8">
          <Skeleton className="h-3 w-32" />
          <Skeleton className="mt-3 h-10 w-3/4" />

          <ReceiptDivider />

          <div className="flex items-baseline justify-between gap-3">
            <Skeleton className="h-3 w-12" />
            <Skeleton className="h-7 w-24" />
          </div>
          <Skeleton className="mt-3 h-2 w-full" />

          <ReceiptDivider label="Pick your name" />

          <ul className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <li
                key={i}
                className="flex items-center justify-between gap-3 border border-border bg-surface px-3 py-3"
              >
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-7 w-16" />
              </li>
            ))}
          </ul>
        </ReceiptCard>
      </div>
    </main>
  );
}
