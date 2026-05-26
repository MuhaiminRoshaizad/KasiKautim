import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { AmountDisplay } from "@/components/amount-display";
import { buttonClassName } from "@/components/button";
import { InkStamp } from "@/components/ink-stamp";
import { ProgressBar } from "@/components/progress-bar";
import { ReceiptCard, ReceiptDivider } from "@/components/receipt-card";
import { ThemeToggle } from "@/components/theme-toggle";
import { APP_NAME } from "@/lib/constants";

export default function HomePage() {
  return (
    <main className="relative mx-auto flex min-h-dvh w-full max-w-5xl flex-col px-5 pt-6 pb-12 sm:px-8">
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
            Jom split.
            <br />
            No awkward
            <br />
            chasing.
          </h1>
          <p className="mt-6 max-w-md text-base leading-relaxed text-foreground-soft sm:text-lg">
            Create a bill, share one link in the group chat, and watch it settle
            on its own. Members tap their name, pay, done. You see who&apos;s in
            and who&apos;s ghosting — in real time.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
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
            <Link
              href="#how"
              className={buttonClassName({ variant: "ghost", size: "lg" })}
            >
              See how it works
            </Link>
          </div>

          <p className="mt-4 text-xs text-foreground-faint">
            Free during the bounty. No app install needed.
          </p>
        </div>

        <div className="flex-1">
          <SampleReceipt />
        </div>
      </section>

      <section id="how" className="mt-24 grid gap-6 sm:grid-cols-3 sm:gap-4">
        {STEPS.map((step, i) => (
          <article
            key={step.title}
            className="border border-border bg-surface p-5"
          >
            <div className="font-mono tabular text-xs uppercase tracking-widest text-foreground-faint">
              Step {String(i + 1).padStart(2, "0")}
            </div>
            <h3 className="mt-3 font-display text-2xl uppercase tracking-tight text-foreground">
              {step.title}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-foreground-soft">
              {step.body}
            </p>
          </article>
        ))}
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
  );
}

const STEPS = [
  {
    title: "Create the bill",
    body: "Name it, set the total, list the squad. We split equally and mint a single shareable link.",
  },
  {
    title: "Drop the link",
    body: "Paste once into the group chat. Members tap their name on the receipt — no signup, no app.",
  },
  {
    title: "Watch it settle",
    body: "See paid / unpaid / viewed-but-ghosting in real time. Last payment triggers a satisfying stamp.",
  },
];

function SampleReceipt() {
  const total = 12_000;
  const collected = 8_000;
  return (
    <ReceiptCard className="mx-auto max-w-sm p-6 sm:p-8">
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
