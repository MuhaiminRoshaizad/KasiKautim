import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, ArrowLeft, FileText, MessageCircle, Send } from "lucide-react";

import { AmountDisplay } from "@/components/amount-display";
import { buttonClassName } from "@/components/button";
import { CopyButton } from "@/components/copy-button";
import { InkStamp } from "@/components/ink-stamp";
import { ProgressBar } from "@/components/progress-bar";
import { ReceiptCard, ReceiptDivider } from "@/components/receipt-card";
import { cn } from "@/lib/cn";
import { unclaimedItems } from "@/lib/item-split";
import {
  genericShareMessage,
  privateItemModeShareMessage,
  privateShareMessage,
  whatsappShareUrl,
} from "@/lib/share-messages";
import { sumCents } from "@/lib/money";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { BillItem } from "@/types/db";

import { RealtimeBillSubscription } from "./realtime-bill-subscription";

interface BillDetailPageProps {
  params: Promise<{ slug: string }>;
}

export default async function BillDetailPage({ params }: BillDetailPageProps) {
  const { slug } = await params;
  const supabase = await createSupabaseServerClient();

  const { data: bill, error } = await supabase
    .from("bills")
    .select(
      "id, slug, title, description, total_cents, currency, due_date, status, created_at, split_mode, items, tax_cents, discount_cents",
    )
    .eq("slug", slug)
    .single();

  if (error || !bill) notFound();

  const { data: members } = await supabase
    .from("bill_members")
    .select(
      "id, name, amount_owed_cents, member_token, paid, paid_at, paid_amount_cents, last_viewed_at, claimed_item_ids, created_at",
    )
    .eq("bill_id", bill.id)
    .order("created_at", { ascending: true });

  const memberList = members ?? [];
  // For paid members, the "collected" total is what they actually transferred
  // (paid_amount_cents). For non-paid, no contribution yet.
  const collectedCents = sumCents(
    memberList
      .filter((m) => m.paid)
      .map((m) => m.paid_amount_cents ?? m.amount_owed_cents),
  );
  const totalCents = bill.total_cents;
  const progress = totalCents > 0 ? collectedCents / totalCents : 0;
  const allPaid = memberList.length > 0 && memberList.every((m) => m.paid);

  const isItemMode = bill.split_mode === "item";
  const items: BillItem[] = isItemMode ? (bill.items as BillItem[]) : [];
  const unclaimed = isItemMode
    ? unclaimedItems(
        items,
        memberList.map((m) => ({
          memberId: m.id,
          claimedItemIds: (m.claimed_item_ids as string[]) ?? [],
        })),
      )
    : [];

  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const publicLink = `${siteUrl}/b/${bill.slug}`;
  const genericWaUrl = whatsappShareUrl(
    genericShareMessage({ title: bill.title, link: publicLink }),
  );

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <RealtimeBillSubscription billId={bill.id} />
      <div className="flex items-center justify-between gap-2">
        <Link
          href="/dashboard"
          className={cn(
            buttonClassName({ variant: "ghost", size: "sm" }),
            "!h-9 !px-2 text-foreground-soft",
          )}
        >
          <ArrowLeft size={16} aria-hidden />
          All bills
        </Link>
        <div className="flex items-center gap-3">
          <Link
            href={`/dashboard/${bill.slug}/report`}
            className={cn(
              buttonClassName({ variant: "secondary", size: "sm" }),
              "!h-9",
            )}
            title="Per-bill audit report with KPIs, member breakdown, payment proof, and timeline"
          >
            <FileText size={14} aria-hidden />
            View report
          </Link>
          <span className="font-mono text-[10px] uppercase tracking-widest text-foreground-faint">
            {bill.slug}
          </span>
        </div>
      </div>

      <ReceiptCard className="p-6 sm:p-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-foreground-faint">
              <span>Bill</span>
              <span
                className={cn(
                  "border px-1.5 py-0.5 text-[9px]",
                  isItemMode
                    ? "border-ringgit text-ringgit"
                    : "border-border text-foreground-faint",
                )}
              >
                {isItemMode ? "By items" : "Equal split"}
              </span>
            </div>
            <h1 className="mt-1 font-display text-3xl uppercase leading-tight tracking-tight text-foreground sm:text-4xl">
              {bill.title}
            </h1>
            {bill.description ? (
              <p className="mt-2 text-sm text-foreground-soft">
                {bill.description}
              </p>
            ) : null}
            {bill.due_date ? (
              <p className="mt-2 font-mono text-xs uppercase tracking-widest text-foreground-faint">
                Due {bill.due_date}
              </p>
            ) : null}
          </div>
          {allPaid ? (
            <InkStamp label="Settled" variant="paid" rotate={-7} />
          ) : null}
        </div>

        {unclaimed.length > 0 ? (
          <UnclaimedWarning items={unclaimed} />
        ) : null}

        <ReceiptDivider />

        <div className="flex items-baseline justify-between gap-3">
          <span className="text-xs uppercase tracking-widest text-foreground-soft">
            Collected
          </span>
          <div className="text-right">
            <AmountDisplay cents={collectedCents} size="lg" />
            <span className="ml-2 font-mono text-sm text-foreground-faint tabular">
              / <AmountDisplay cents={totalCents} size="sm" muted />
            </span>
          </div>
        </div>
        <div className="mt-3">
          <ProgressBar value={progress} label="Progress" />
        </div>

        <ReceiptDivider label="Share" />

        <div className="flex flex-col gap-2 sm:flex-row">
          <a
            href={genericWaUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonClassName({
              size: "md",
              className: "flex-1 font-display uppercase tracking-widest",
            })}
          >
            <MessageCircle size={16} aria-hidden />
            Send to group chat
          </a>
          <CopyButton value={publicLink} label="Copy link" className="flex-1" />
        </div>
        <p className="mt-2 text-[11px] text-foreground-faint">
          {isItemMode
            ? "Drop the link once. Each person taps their items to compute their share."
            : "Drop the link once. Recipients tap their name on the bill page."}
        </p>

        <ReceiptDivider
          label={`${memberList.length} member${memberList.length === 1 ? "" : "s"}`}
        />

        <ul className="space-y-2">
          {memberList.map((m) => {
            const memberLink = `${publicLink}?m=${m.member_token}`;
            const claimed = (m.claimed_item_ids as string[]) ?? [];
            const claimedItems = items.filter((it) => claimed.includes(it.id));
            const privateWaUrl = isItemMode
              ? whatsappShareUrl(
                  privateItemModeShareMessage({
                    name: m.name,
                    title: bill.title,
                    link: memberLink,
                    dueDate: bill.due_date,
                  }),
                )
              : whatsappShareUrl(
                  privateShareMessage({
                    name: m.name,
                    title: bill.title,
                    amountCents: m.amount_owed_cents,
                    link: memberLink,
                    dueDate: bill.due_date,
                  }),
                );

            // Paid members show their snapshotted paid amount; non-paid show
            // the live computed share (or 0 in item-mode before claims).
            const displayCents = m.paid
              ? (m.paid_amount_cents ?? m.amount_owed_cents)
              : m.amount_owed_cents;

            return (
              <li
                key={m.id}
                className="flex flex-wrap items-center justify-between gap-3 border border-border bg-surface px-3 py-3"
              >
                <div className="flex min-w-0 flex-col gap-1">
                  <div className="flex items-center gap-3">
                    <span
                      aria-hidden
                      className={cn(
                        "inline-block h-2 w-2",
                        m.paid
                          ? "bg-ringgit"
                          : m.last_viewed_at
                            ? "bg-highlighter"
                            : "bg-foreground-faint",
                      )}
                    />
                    <span className="truncate font-mono text-sm text-foreground">
                      {m.name}
                    </span>
                  </div>
                  {isItemMode && claimedItems.length > 0 ? (
                    <div className="ml-5 flex flex-wrap gap-1 text-[10px] text-foreground-faint">
                      {claimedItems.map((it) => (
                        <span
                          key={it.id}
                          className="border border-border px-1.5 py-0.5 font-mono"
                          title={`${it.name} · RM ${(it.price_cents / 100).toFixed(2)}`}
                        >
                          {it.name}
                        </span>
                      ))}
                    </div>
                  ) : isItemMode && !m.paid ? (
                    <span className="ml-5 text-[10px] text-foreground-faint">
                      No items tapped yet
                    </span>
                  ) : null}
                </div>
                <div className="flex items-center gap-3">
                  <AmountDisplay
                    cents={displayCents}
                    size="sm"
                    muted={!m.paid}
                  />
                  <MemberBadge
                    paid={m.paid}
                    lastViewedAt={m.last_viewed_at}
                  />
                </div>
                <div className="flex w-full flex-wrap gap-2 sm:w-auto sm:flex-nowrap">
                  <a
                    href={privateWaUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Send ${m.name}'s link to WhatsApp`}
                    className={cn(
                      buttonClassName({
                        variant: "secondary",
                        size: "sm",
                      }),
                      "flex-1 sm:flex-none",
                    )}
                  >
                    <Send size={14} aria-hidden />
                    Send privately
                  </a>
                  <CopyButton
                    value={memberLink}
                    label="Copy"
                    size="sm"
                    className="flex-1 sm:flex-none"
                  />
                </div>
              </li>
            );
          })}
        </ul>
      </ReceiptCard>
    </div>
  );
}

function UnclaimedWarning({ items }: { items: BillItem[] }) {
  const totalCents = items.reduce((a, it) => a + it.price_cents, 0);
  return (
    <div className="mt-4 flex items-start gap-2 border border-highlighter/60 bg-highlighter/10 p-3 text-xs">
      <AlertTriangle
        size={14}
        className="mt-0.5 shrink-0 text-foreground"
        aria-hidden
      />
      <div>
        <p className="font-medium text-foreground">
          {items.length} item{items.length === 1 ? "" : "s"} unclaimed (
          <AmountDisplay cents={totalCents} size="sm" className="text-foreground" />
          )
        </p>
        <p className="mt-1 text-foreground-soft">
          {items.map((it) => it.name).join(", ")} — nobody has tapped these yet.
          Nudge the squad or claim them yourself by visiting the share link.
        </p>
      </div>
    </div>
  );
}

function MemberBadge({
  paid,
  lastViewedAt,
}: {
  paid: boolean;
  lastViewedAt: string | null;
}) {
  if (paid) {
    return (
      <span className="border border-ringgit px-2 py-0.5 text-[10px] font-medium uppercase tracking-widest text-ringgit">
        Paid
      </span>
    );
  }
  if (lastViewedAt) {
    return (
      <span className="border border-highlighter px-2 py-0.5 text-[10px] font-medium uppercase tracking-widest text-foreground">
        Seen
      </span>
    );
  }
  return (
    <span className="border border-border px-2 py-0.5 text-[10px] font-medium uppercase tracking-widest text-foreground-faint">
      Not yet
    </span>
  );
}
