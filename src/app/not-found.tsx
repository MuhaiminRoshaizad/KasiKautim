import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { buttonClassName } from "@/components/button";
import { ReceiptCard, ReceiptDivider } from "@/components/receipt-card";
import { ThemeToggle } from "@/components/theme-toggle";
import { APP_NAME } from "@/lib/constants";

/*
 * Branded 404 surfaced when:
 *   - a URL matches no route at all
 *   - a server component calls notFound() (bill detail, public bill,
 *     report — all do this when the slug doesn't resolve)
 *
 * Replaces Next's default plain-text "404 - This page could not be
 * found" with the receipt-card aesthetic so a wrong link still feels
 * like part of the app.
 */
export const metadata = {
  title: "Not found",
};

export default function NotFound() {
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
          <div className="font-mono text-[10px] uppercase tracking-widest text-foreground-faint">
            Page · 404
          </div>
          <h1 className="mt-2 font-display text-3xl uppercase tracking-tight text-foreground sm:text-4xl">
            Bill not found lah
          </h1>
          <p className="mx-auto mt-3 max-w-sm text-sm text-foreground-soft">
            This bill might have been deleted, or the link got mangled
            when someone forwarded it. Double-check the URL with the
            tukang bayar — they can resend the share link.
          </p>

          <ReceiptDivider />

          <Link
            href="/"
            className={buttonClassName({
              size: "lg",
              className: "font-display uppercase tracking-widest",
            })}
          >
            <ArrowLeft size={18} aria-hidden />
            Back to home
          </Link>
        </ReceiptCard>
      </div>
    </main>
  );
}
