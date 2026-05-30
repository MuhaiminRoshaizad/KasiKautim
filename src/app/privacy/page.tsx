import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { buttonClassName } from "@/components/button";
import { ReceiptCard, ReceiptDivider } from "@/components/receipt-card";
import { ThemeToggle } from "@/components/theme-toggle";
import { APP_NAME } from "@/lib/constants";
import { cn } from "@/lib/cn";

export const metadata = {
  title: "Privacy",
  description: `How ${APP_NAME} handles your data under PDPA 2010 (Malaysia).`,
};

const CONTACT_EMAIL = "aminmuhaimin192@gmail.com";

export default function PrivacyPage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col px-6 pt-6 pb-12 sm:px-8">
      <header className="flex items-center justify-between gap-2">
        <Link
          href="/"
          className={cn(
            buttonClassName({ variant: "ghost", size: "sm" }),
            "!h-9 !px-2 text-foreground-soft",
          )}
        >
          <ArrowLeft size={16} aria-hidden />
          Home
        </Link>
        <ThemeToggle />
      </header>

      <div className="mt-6">
        <ReceiptCard className="p-6 sm:p-8">
          <div className="font-mono text-[10px] uppercase tracking-widest text-foreground-faint">
            {APP_NAME} · Privacy
          </div>
          <h1 className="mt-2 font-display text-3xl uppercase tracking-tight text-foreground sm:text-4xl">
            Privacy notice
          </h1>
          <p className="mt-2 text-sm text-foreground-soft">
            Plain-language summary of how {APP_NAME} handles your data. Written for
            Malaysian users under the Personal Data Protection Act 2010 (PDPA).
          </p>

          <ReceiptDivider />

          <Section title="What we collect">
            <ul className="ml-4 list-disc space-y-1 text-foreground">
              <li>
                Your Google account email + display name (delivered by Google during
                &quot;Sign in with Google&quot;). We don&apos;t see your Google password.
              </li>
              <li>Display name and optional DuitNow ID you set in Settings.</li>
              <li>Bills you create — title, description, total amount, member names, due date.</li>
              <li>
                Payment metadata your recipients submit — method (cash, online transfer,
                DuitNow QR, e-wallet, or &quot;other&quot;), an optional 120-character note,
                and the image they upload as proof of transfer.
              </li>
              <li>
                Anonymous read receipts — a timestamp when a recipient opens the bill link, so
                you can see who&apos;s ghosting.
              </li>
            </ul>
          </Section>

          <Section title="What we don&rsquo;t do">
            <ul className="ml-4 list-disc space-y-1 text-foreground">
              <li>No third-party analytics, no Google Analytics, no Facebook Pixel.</li>
              <li>No advertising network. No data sold or shared with advertisers.</li>
              <li>No EXIF retained on uploaded payment proofs — stripped server-side before storage.</li>
              <li>No login required for recipients — they tap the link and claim a name, no account.</li>
            </ul>
          </Section>

          <Section title="Where it lives">
            <p className="text-foreground">
              All data is stored in Supabase (Postgres + Storage) on infrastructure with row-level
              security. Recipients see only the bill they have the link for. Tukang bayar sees
              only bills they created. Service-role access is restricted to the server runtime —
              never exposed to browser code.
            </p>
          </Section>

          <Section title="Retention">
            <p className="text-foreground">
              Bills and payment proofs are kept until you delete them. There is no automatic
              purge yet. To remove your data, email{" "}
              <a href={`mailto:${CONTACT_EMAIL}`} className="underline">
                {CONTACT_EMAIL}
              </a>{" "}
              and we&rsquo;ll delete your account, bills, members, and uploaded proofs.
            </p>
          </Section>

          <Section title="Your PDPA rights">
            <p className="text-foreground">
              You have the right to access, correct, and delete your personal data. You can also
              withdraw consent at any time by emailing us — we&rsquo;ll delete your data within 14
              days. {APP_NAME} only processes data for the purpose stated above (running the
              split-bill service).
            </p>
          </Section>

          <Section title="Cookies & local storage">
            <p className="text-foreground">
              {APP_NAME} stores a signed session cookie (Supabase Auth) so the tukang bayar
              stays signed in, a claim cookie (30-day) so recipients keep their member identity
              on their phone, and a theme preference in localStorage. No tracking cookies.
            </p>
          </Section>

          <Section title="Contact">
            <p className="text-foreground">
              Questions, deletion requests, or PDPA complaints —{" "}
              <a href={`mailto:${CONTACT_EMAIL}`} className="underline">
                {CONTACT_EMAIL}
              </a>
              .
            </p>
          </Section>

          <ReceiptDivider />

          <p className="font-mono text-[10px] uppercase tracking-widest text-foreground-faint">
            Last updated · 2026-05-27
          </p>
        </ReceiptCard>
      </div>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-6">
      <h2 className="font-display text-xl uppercase tracking-tight text-foreground">
        {title}
      </h2>
      <div className="mt-2 text-sm leading-relaxed">{children}</div>
    </section>
  );
}
