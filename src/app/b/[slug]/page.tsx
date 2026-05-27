import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink } from "lucide-react";

import { AmountDisplay } from "@/components/amount-display";
import { CopyButton } from "@/components/copy-button";
import { ProgressBar } from "@/components/progress-bar";
import { ReceiptCard, ReceiptDivider } from "@/components/receipt-card";
import { ThemeToggle } from "@/components/theme-toggle";
import { APP_NAME } from "@/lib/constants";
import { siteUrl } from "@/lib/site-url";
import { touchMemberViewed } from "@/actions/members";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type {
  MemberByTokenRpc,
  PublicBillMemberRpc,
  PublicBillRpc,
} from "@/types/db";

import { ClaimRow } from "./claim-row";
import { ItemPicker } from "./item-picker";
import { MarkPaidPanel } from "./mark-paid-panel";
import { UnclaimBanner } from "./unclaim-banner";

interface PublicBillPageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ m?: string }>;
}

export async function generateMetadata({ params }: PublicBillPageProps) {
  const { slug } = await params;
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .rpc("get_public_bill", { p_slug: slug })
    .maybeSingle<PublicBillRpc>();

  const base = siteUrl();
  const ogImage = `${base}/api/og/${slug}`;
  const title = data?.title ?? APP_NAME;
  const description = data
    ? `Split bill on ${APP_NAME}. Tap your name to settle.`
    : `${APP_NAME} — split bills without the awkward chasing.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: `${base}/b/${slug}`,
      siteName: APP_NAME,
      images: [{ url: ogImage, width: 1200, height: 630 }],
      type: "website",
      locale: "en_MY",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImage],
    },
  };
}

export default async function PublicBillPage({
  params,
  searchParams,
}: PublicBillPageProps) {
  const [{ slug }, { m: token }] = await Promise.all([params, searchParams]);

  const supabase = await createSupabaseServerClient();

  const { data: bill } = await supabase
    .rpc("get_public_bill", { p_slug: slug })
    .maybeSingle<PublicBillRpc>();
  if (!bill) notFound();

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

      <div className="mt-6">
        {token ? (
          <MemberView slug={slug} token={token} bill={bill} />
        ) : (
          <ClaimView slug={slug} bill={bill} />
        )}
      </div>
    </main>
  );
}

// ---------- Claim-your-name view ----------

async function ClaimView({ slug, bill }: { slug: string; bill: PublicBillRpc }) {
  const supabase = await createSupabaseServerClient();
  const { data: members } = await supabase.rpc("get_public_bill_members", {
    p_slug: slug,
  });

  const list = (members as PublicBillMemberRpc[] | null) ?? [];
  const collectedCents = list
    .filter((m) => m.paid)
    .reduce((acc, m) => acc + (m.paid_amount_cents ?? m.amount_owed_cents), 0);
  const progress = bill.total_cents > 0 ? collectedCents / bill.total_cents : 0;

  return (
    <ReceiptCard tissue className="p-6 sm:p-8">
      <BillHeader bill={bill} />

      <ReceiptDivider />

      <div className="flex items-baseline justify-between gap-3">
        <span className="text-xs uppercase tracking-widest text-foreground-soft">
          Total
        </span>
        <AmountDisplay cents={bill.total_cents} size="lg" />
      </div>
      <div className="mt-3">
        <ProgressBar value={progress} label="Collected" />
      </div>

      <ReceiptDivider label="Pick your name" />

      {list.length === 0 ? (
        <p className="text-sm text-foreground-soft">
          No members on this bill yet.
        </p>
      ) : (
        <ul className="space-y-2">
          {list.map((m) => (
            <ClaimRow
              key={m.member_id}
              slug={slug}
              memberId={m.member_id}
              name={m.name}
              amountOwedCents={m.amount_owed_cents}
              paid={m.paid}
              claimed={m.claimed}
            />
          ))}
        </ul>
      )}

      <p className="mt-4 text-center text-[11px] text-foreground-faint">
        Bookmark your name once claimed — link saves on this device.
      </p>
    </ReceiptCard>
  );
}

// ---------- Single-member (already claimed) view ----------

async function MemberView({
  slug,
  token,
  bill,
}: {
  slug: string;
  token: string;
  bill: PublicBillRpc;
}) {
  const supabase = await createSupabaseServerClient();
  const { data: member } = await supabase
    .rpc("get_member_by_token", { p_token: token })
    .maybeSingle<MemberByTokenRpc>();

  if (!member || member.bill_slug !== slug) {
    return <ClaimView slug={slug} bill={bill} />;
  }

  await touchMemberViewed(token);

  // Item-mode bills need the full members list for co-claimer chips + math.
  const isItemMode = bill.split_mode === "item";
  let allMembers: PublicBillMemberRpc[] = [];
  if (isItemMode) {
    const { data } = await supabase.rpc("get_public_bill_members", {
      p_slug: slug,
    });
    allMembers = (data as PublicBillMemberRpc[] | null) ?? [];
  }

  return (
    <ReceiptCard tissue className="p-6 sm:p-8">
      <UnclaimBanner
        slug={slug}
        token={token}
        name={member.name}
        paid={member.paid}
      />

      <BillHeader bill={bill} />

      <ReceiptDivider />

      {isItemMode ? (
        <ItemPicker
          billId={bill.bill_id}
          token={token}
          meId={member.member_id}
          items={bill.items}
          members={allMembers.map((m) => ({
            id: m.member_id,
            name: m.name,
            claimedItemIds: m.claimed_item_ids ?? [],
            paid: m.paid,
          }))}
          taxCents={bill.tax_cents}
          discountCents={bill.discount_cents}
        />
      ) : (
        <div className="text-center">
          <div className="font-mono text-[10px] uppercase tracking-widest text-foreground-faint">
            Your share, {member.name}
          </div>
          <div className="mt-2">
            <AmountDisplay cents={member.amount_owed_cents} size="xl" />
          </div>
          {bill.due_date ? (
            <p className="mt-2 font-mono text-xs uppercase tracking-widest text-foreground-faint">
              Due {bill.due_date}
            </p>
          ) : null}
        </div>
      )}

      {bill.organizer_duitnow_id ? (
        <>
          <ReceiptDivider label="Transfer to" />
          <div className="flex items-center justify-between gap-3 border border-border bg-surface px-3 py-3">
            <div className="min-w-0">
              <div className="font-mono text-[10px] uppercase tracking-widest text-foreground-faint">
                DuitNow ID
              </div>
              <div className="mt-0.5 truncate font-mono text-base text-foreground">
                {bill.organizer_duitnow_id}
              </div>
            </div>
            <CopyButton
              value={bill.organizer_duitnow_id}
              label="Copy"
              size="sm"
            />
          </div>
          <BankDeepLinks />
          <p className="mt-2 text-[11px] text-foreground-faint">
            Transfer{" "}
            <AmountDisplay
              cents={member.amount_owed_cents}
              size="sm"
              className="text-foreground"
            />{" "}
            to the DuitNow ID above, then tap &quot;I&apos;ve paid&quot;.
          </p>
        </>
      ) : null}

      <ReceiptDivider />

      <MarkPaidPanel
        token={token}
        initiallyPaid={member.paid}
        initialPaidAt={member.paid_at}
        organizerName={bill.organizer_display_name}
        canPay={!isItemMode || (member.claimed_item_ids?.length ?? 0) > 0}
        amountOwedCents={member.amount_owed_cents}
      />
    </ReceiptCard>
  );
}

// ---------- Bank-app deep links ----------

/*
 * Open-the-app shortcuts for common MY payment channels.
 *   - TNG eWallet: official tngd:// scheme
 *   - Maybank MAE: mae:// scheme (newer; the Maybank2u website is the
 *     desktop fallback so we link to the universal one).
 * Browsers without the scheme installed will show a "can't open" warning
 * but it's harmless — they just stay on our page.
 */
function BankDeepLinks() {
  const links: { label: string; href: string }[] = [
    { label: "Open TNG eWallet", href: "tngd://" },
    { label: "Open Maybank2u", href: "https://www.maybank2u.com.my/" },
  ];
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {links.map((l) => (
        <a
          key={l.label}
          href={l.href}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 border border-border bg-surface px-3 text-xs font-medium text-foreground-soft transition-colors hover:bg-surface-deep focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:flex-none"
        >
          <ExternalLink size={12} aria-hidden />
          {l.label}
        </a>
      ))}
    </div>
  );
}

// ---------- Shared bill header (kopitiam tissue + handwritten title) ----------

function BillHeader({ bill }: { bill: PublicBillRpc }) {
  return (
    <>
      <div className="font-mono text-[10px] uppercase tracking-widest text-foreground-faint">
        {bill.organizer_display_name
          ? `Bill from ${bill.organizer_display_name}`
          : "Shared bill"}
      </div>
      <h1 className="mt-1 font-handwritten text-4xl leading-tight tracking-tight text-foreground sm:text-5xl">
        {bill.title}
      </h1>
      {bill.description ? (
        <p className="mt-2 text-sm text-foreground-soft">{bill.description}</p>
      ) : null}
      {bill.due_date ? (
        <p className="mt-2 font-mono text-xs uppercase tracking-widest text-foreground-faint">
          Due {bill.due_date}
        </p>
      ) : null}
    </>
  );
}
