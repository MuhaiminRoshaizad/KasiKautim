import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { AmountDisplay } from "@/components/amount-display";
import { buttonClassName } from "@/components/button";
import { InkStamp } from "@/components/ink-stamp";
import { ProgressBar } from "@/components/progress-bar";
import { ReceiptCard, ReceiptDivider } from "@/components/receipt-card";
import { ThemeToggle } from "@/components/theme-toggle";
import { APP_NAME } from "@/lib/constants";

import { AmbientReceipts } from "./ambient-receipts";

export default function HomePage() {
  return (
    <>
      <AmbientReceipts />
      <main className="relative z-10 mx-auto flex min-h-dvh w-full max-w-5xl flex-col px-5 pt-6 pb-12 sm:px-8">
      <header className="flex items-center justify-between">
        <Link
          href="/"
          className="font-display text-2xl uppercase tracking-[0.18em] text-foreground"
        >
          {APP_NAME}
        </Link>
        <ThemeToggle />
      </header>

      <section className="mt-12 flex flex-col gap-8 sm:mt-20 sm:gap-12 lg:mt-28 lg:flex-row lg:items-center lg:gap-16">
        <div className="flex-1">
          <p className="text-xs font-medium uppercase tracking-[0.22em] text-foreground-faint">
            Split bills · Malaysia · 2026
          </p>
          <h1 className="mt-4 font-display text-5xl uppercase leading-[0.95] tracking-tight text-foreground sm:text-6xl lg:text-7xl">
            Kasi kautim.
            <br />
            No awkward
            <br />
            chasing.
          </h1>
          <p className="mt-6 max-w-md text-base leading-relaxed text-foreground-soft sm:text-lg">
            Create a bill. Share one link in the group chat. Members tap
            their name, pay, mark settled. You see who&apos;s paid and
            who&apos;s still ghosting.
          </p>

          <div className="mt-8">
            <Link
              href="/login"
              className={buttonClassName({
                size: "lg",
                className: "font-display uppercase tracking-widest",
              })}
            >
              Create a bill
              <ArrowRight size={18} aria-hidden />
            </Link>
          </div>

          <p className="mt-4 text-xs text-foreground-faint">
            Sign in with Google. No app install. Link works in WhatsApp.
          </p>
        </div>

        <div className="flex-1">
          <SampleReceipt />
        </div>
      </section>

      {/* "Real receipt" panel — gives the moody Unsplash receipt closeup
          its own moment instead of awkwardly stacking it behind the hero
          sample card. Framed as the problem KasiKautim solves: a real
          paper receipt sitting around waiting to be split. */}
      <section className="mt-24 lg:mt-32">
        <div className="grid gap-8 lg:grid-cols-2 lg:items-center lg:gap-16">
          <figure className="relative overflow-hidden border border-border bg-paper-deep">
            <Image
              src="/landing-receipt.jpg"
              alt="Closeup of a thermal-printed paper receipt"
              width={1600}
              height={1067}
              className="h-full w-full object-cover"
            />
          </figure>
          <div>
            <p className="font-mono text-[10px] uppercase tracking-widest text-foreground-faint">
              Behind every awkward group chat
            </p>
            <p className="mt-3 font-display text-3xl uppercase leading-[1.05] tracking-tight text-foreground sm:text-4xl">
              a forgotten receipt.
            </p>
            <p className="mt-5 max-w-md text-sm leading-relaxed text-foreground-soft sm:text-base">
              Every Malaysian has a paper receipt sitting in a wallet, a
              car cupholder, or somewhere in their photo roll, waiting to
              be split. {APP_NAME} turns that receipt into one share link
              your group chat can actually settle — no chasing, no awkward
              calculations.
            </p>
          </div>
        </div>
      </section>

      <footer className="mt-auto pt-16 text-xs text-foreground-faint">
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-6">
          <span className="font-mono">© 2026 {APP_NAME}</span>
          <nav className="flex items-center gap-4">
            <Link href="/privacy" className="hover:text-foreground">
              Privacy
            </Link>
            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground"
            >
              GitHub
            </a>
          </nav>
        </div>
      </footer>
      </main>
    </>
  );
}

function SampleReceipt() {
  const total = 12_000;
  const collected = 8_000;
  return (
    <ReceiptCard className="mx-auto max-w-sm p-6 sm:p-8 lg:ml-auto lg:mr-0">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-widest text-foreground-faint">
            Bill · MAKAN-PJ-22
          </div>
          <h2 className="mt-1 font-display text-2xl uppercase tracking-tight text-foreground">
            Friday lunch · Restoran Ali
          </h2>
        </div>
        <InkStamp label="Live" variant="paid" rotate={-6} />
      </div>

      <ReceiptDivider label="Members" />

      <ul className="space-y-2 text-sm">
        {SAMPLE_MEMBERS.map((m) => (
          <li
            key={m.name}
            className="flex items-center justify-between gap-3 font-mono"
          >
            <span className="flex items-center gap-2 text-foreground">
              <span
                className={`inline-block h-1.5 w-1.5 ${m.paid ? "bg-ringgit" : "bg-foreground-faint"}`}
                aria-hidden
              />
              {m.name}
            </span>
            <span className="flex items-center gap-3">
              <AmountDisplay cents={m.amount} size="sm" muted={!m.paid} />
              <span
                className={`text-[10px] uppercase tracking-widest ${m.paid ? "text-ringgit" : "text-foreground-faint"}`}
              >
                {m.paid ? "paid" : "—"}
              </span>
            </span>
          </li>
        ))}
      </ul>

      <ReceiptDivider />

      <div className="flex items-baseline justify-between">
        <span className="text-xs uppercase tracking-widest text-foreground-soft">
          Total
        </span>
        <AmountDisplay cents={total} size="lg" />
      </div>

      <div className="mt-4">
        <ProgressBar value={collected / total} label="Collected" />
      </div>
    </ReceiptCard>
  );
}

const SAMPLE_MEMBERS = [
  { name: "Aisha",  amount: 3_000, paid: true },
  { name: "Faiz",   amount: 3_000, paid: true },
  { name: "Wani",   amount: 3_000, paid: false },
  { name: "Hafiz",  amount: 3_000, paid: false },
];
