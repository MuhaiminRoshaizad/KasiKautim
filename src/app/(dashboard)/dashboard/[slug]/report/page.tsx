import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { AmountDisplay } from "@/components/amount-display";
import {
  ActivityTimeline,
  type TimelineEvent,
} from "@/components/activity-timeline";
import { buttonClassName } from "@/components/button";
import { InkStamp } from "@/components/ink-stamp";
import { KpiCard } from "@/components/kpi-card";
import { PaymentMethodBadge } from "@/components/payment-method-badge";
import { ProgressBar } from "@/components/progress-bar";
import { ProofThumbnail } from "@/components/proof-thumbnail";
import { ReceiptCard, ReceiptDivider } from "@/components/receipt-card";
import { cn } from "@/lib/cn";
import { unclaimedItems } from "@/lib/item-split";
import { formatMYR, sumCents } from "@/lib/money";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { BillItem, PaymentEventType, PaymentMethodDb } from "@/types/db";

import { RealtimeReportSubscription } from "./realtime-report-subscription";
import { PrintButton } from "./print-button";

interface ReportPageProps {
  params: Promise<{ slug: string }>;
}

const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24; // 24h — covers print-later scenarios

interface MemberRecord {
  id: string;
  name: string;
  amount_owed_cents: number;
  paid: boolean;
  paid_at: string | null;
  paid_amount_cents: number | null;
  payment_method: PaymentMethodDb | null;
  payment_note: string | null;
  payment_proof_url: string | null;
  last_viewed_at: string | null;
  claimed_item_ids: string[];
  created_at: string;
}

export default async function ReportPage({ params }: ReportPageProps) {
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
      "id, name, amount_owed_cents, paid, paid_at, paid_amount_cents, payment_method, payment_note, payment_proof_url, last_viewed_at, claimed_item_ids, created_at",
    )
    .eq("bill_id", bill.id)
    .order("created_at", { ascending: true });
  const memberList = (members as MemberRecord[] | null) ?? [];

  // payment_events for the timeline. We only surface high-signal events
  // (claimed + paid) — `viewed` is captured per-member by `last_viewed_at`
  // and would otherwise spam the timeline on every page refresh.
  const { data: rawEvents } = await supabase
    .from("payment_events")
    .select("id, event_type, occurred_at, bill_member_id")
    .in("bill_member_id", memberList.map((m) => m.id))
    .in("event_type", ["claimed", "paid"])
    .order("occurred_at", { ascending: false })
    .limit(100);

  const memberById = new Map(memberList.map((m) => [m.id, m]));
  const events: TimelineEvent[] = (rawEvents ?? []).map((e) => {
    const m = memberById.get(e.bill_member_id);
    const detail =
      e.event_type === "paid" && m
        ? `${formatMYR(m.paid_amount_cents ?? m.amount_owed_cents)}${
            m.payment_method ? ` via ${m.payment_method}` : ""
          }`
        : undefined;
    return {
      id: e.id,
      occurredAt: e.occurred_at,
      memberName: m?.name ?? "Someone",
      eventType: e.event_type as PaymentEventType,
      detail,
    };
  });

  // Pre-generate 24h signed URLs for every proof image so the report renders
  // them without an extra client roundtrip. Long enough TTL that printing
  // later still works.
  const admin = createSupabaseAdminClient();
  const signedUrlByMemberId = new Map<string, string>();
  await Promise.all(
    memberList.map(async (m) => {
      if (!m.payment_proof_url) return;
      const { data } = await admin.storage
        .from("payment-proofs")
        .createSignedUrl(m.payment_proof_url, SIGNED_URL_TTL_SECONDS);
      if (data?.signedUrl) signedUrlByMemberId.set(m.id, data.signedUrl);
    }),
  );

  // KPIs
  const totalCents = bill.total_cents;
  const collectedCents = sumCents(
    memberList
      .filter((m) => m.paid)
      .map((m) => m.paid_amount_cents ?? m.amount_owed_cents),
  );
  const outstandingCents = Math.max(0, totalCents - collectedCents);
  const paidCount = memberList.filter((m) => m.paid).length;
  const allPaid = memberList.length > 0 && paidCount === memberList.length;
  const progress = totalCents > 0 ? collectedCents / totalCents : 0;

  // Open-for / settled-in metric
  const created = new Date(bill.created_at).getTime();
  const lastPaidAt = memberList
    .filter((m) => m.paid_at)
    .map((m) => new Date(m.paid_at!).getTime())
    .sort((a, b) => b - a)[0];
  const settleMs = allPaid && lastPaidAt ? lastPaidAt - created : null;
  // Per-request server render — Date.now() is fine here despite the
  // react-hooks/purity rule which assumes client renders. Each request to
  // a Server Component is fresh, so re-render instability doesn't apply.
  // eslint-disable-next-line react-hooks/purity
  const openMs = !allPaid ? Date.now() - created : null;

  const isItemMode = bill.split_mode === "item";
  const items: BillItem[] = isItemMode ? (bill.items as BillItem[]) : [];
  const unclaimed = isItemMode
    ? unclaimedItems(
        items,
        memberList.map((m) => ({
          memberId: m.id,
          claimedItemIds: m.claimed_item_ids ?? [],
        })),
      )
    : [];

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <RealtimeReportSubscription billId={bill.id} />

      <div className="flex items-center justify-between print-hide">
        <Link
          href={`/dashboard/${bill.slug}`}
          className={cn(
            buttonClassName({ variant: "ghost", size: "sm" }),
            "!h-9 !px-2 text-foreground-soft",
          )}
        >
          <ArrowLeft size={16} aria-hidden />
          Back to bill
        </Link>
        <PrintButton />
      </div>

      <ReceiptCard className="p-6 sm:p-8">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-foreground-faint">
              <span>Report · {bill.slug}</span>
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
              <p className="mt-2 text-sm text-foreground-soft">{bill.description}</p>
            ) : null}
          </div>
          {allPaid ? (
            <InkStamp label="Settled" variant="paid" rotate={-7} />
          ) : null}
        </div>

        <ReceiptDivider />

        <div className="grid gap-3 sm:grid-cols-3">
          <KpiCard
            label="Total"
            value={<AmountDisplay cents={totalCents} size="lg" />}
            sublabel={
              collectedCents > totalCents ? (
                <span className="text-foreground">
                  Collected{" "}
                  <AmountDisplay
                    cents={collectedCents}
                    size="sm"
                    className="text-foreground"
                  />{" "}
                  · <span className="text-highlighter">overpaid by</span>{" "}
                  <AmountDisplay
                    cents={collectedCents - totalCents}
                    size="sm"
                    className="text-foreground"
                  />
                </span>
              ) : (
                <>
                  Collected{" "}
                  <AmountDisplay
                    cents={collectedCents}
                    size="sm"
                    className="text-foreground"
                  />{" "}
                  · outstanding{" "}
                  <AmountDisplay
                    cents={outstandingCents}
                    size="sm"
                    className="text-foreground"
                  />
                </>
              )
            }
          />
          <KpiCard
            label="Members"
            value={`${memberList.length}`}
            sublabel={`${paidCount} paid · ${memberList.length - paidCount} pending`}
          />
          <KpiCard
            label={allPaid ? "Settled in" : "Open for"}
            value={
              settleMs != null
                ? formatDuration(settleMs)
                : openMs != null
                  ? formatDuration(openMs)
                  : "—"
            }
            sublabel={
              allPaid
                ? `Since ${new Date(bill.created_at).toLocaleDateString("en-MY")}`
                : "Since bill created"
            }
          />
        </div>

        <div className="mt-4">
          <ProgressBar value={Math.min(progress, 1)} label="Collection progress" />
        </div>
      </ReceiptCard>

      <ReceiptCard className="p-6 sm:p-8">
        <h2 className="font-display text-2xl uppercase tracking-tight text-foreground">
          Member breakdown
        </h2>
        <p className="mt-1 text-xs text-foreground-soft">
          Fair share is what they owe right now based on the latest claims.
          Paid is what they actually sent. Difference flags over- or
          under-payments when more people claim items after someone paid.
        </p>

        <ReceiptDivider />

        <ul className="space-y-3">
          {memberList.map((m) => {
            const claimedItems = items.filter((it) =>
              (m.claimed_item_ids ?? []).includes(it.id),
            );
            const fairShare = m.amount_owed_cents;
            const paidAmount = m.paid_amount_cents ?? 0;
            const delta = m.paid ? paidAmount - fairShare : 0;
            const signedUrl = signedUrlByMemberId.get(m.id) ?? null;
            return (
              <li
                key={m.id}
                className="flex flex-col gap-3 border border-border bg-surface p-4 sm:flex-row sm:items-start sm:gap-4"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-sm font-medium text-foreground">
                      {m.name}
                    </span>
                    <StatusBadge paid={m.paid} lastViewedAt={m.last_viewed_at} />
                    {m.paid ? (
                      <PaymentMethodBadge method={m.payment_method} />
                    ) : null}
                  </div>
                  {isItemMode && claimedItems.length > 0 ? (
                    <div className="mt-2 flex flex-wrap gap-1 text-[10px]">
                      {claimedItems.map((it) => (
                        <span
                          key={it.id}
                          className="border border-border bg-paper px-1.5 py-0.5 font-mono text-foreground-faint"
                        >
                          {it.name}
                        </span>
                      ))}
                    </div>
                  ) : isItemMode && !m.paid ? (
                    <p className="mt-2 text-[10px] text-foreground-faint">
                      No items tapped yet
                    </p>
                  ) : null}
                  {m.payment_note ? (
                    <p className="mt-2 truncate text-[11px] text-foreground-soft" title={m.payment_note}>
                      Note: {m.payment_note}
                    </p>
                  ) : null}
                  <p className="mt-2 font-mono text-[10px] text-foreground-faint">
                    {m.paid && m.paid_at
                      ? `Paid · ${new Date(m.paid_at).toLocaleString("en-MY")}`
                      : m.last_viewed_at
                        ? `Last viewed · ${new Date(m.last_viewed_at).toLocaleString("en-MY")}`
                        : "Not opened yet"}
                  </p>
                </div>

                <dl className="flex flex-col gap-1 text-sm sm:grid sm:grid-cols-3 sm:gap-3 sm:text-right sm:w-72 sm:shrink-0">
                  <ColumnFigure label="Fair share">
                    <AmountDisplay cents={fairShare} size="sm" muted={!m.paid} />
                  </ColumnFigure>
                  <ColumnFigure label="Paid">
                    {m.paid ? (
                      <AmountDisplay cents={paidAmount} size="sm" />
                    ) : (
                      <span className="text-foreground-faint">—</span>
                    )}
                  </ColumnFigure>
                  <ColumnFigure label="Difference">
                    {m.paid ? <DeltaCell cents={delta} /> : (
                      <span className="text-foreground-faint">—</span>
                    )}
                  </ColumnFigure>
                </dl>

                {signedUrl ? (
                  <div className="shrink-0">
                    <ProofThumbnail
                      signedUrl={signedUrl}
                      alt={`${m.name}'s payment proof`}
                    />
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      </ReceiptCard>

      {isItemMode ? (
        <ReceiptCard className="p-6 sm:p-8">
          <h2 className="font-display text-2xl uppercase tracking-tight text-foreground">
            Items
          </h2>
          {unclaimed.length > 0 ? (
            <p className="mt-1 text-xs text-stamp">
              ⚠ {unclaimed.length} unclaimed: {unclaimed.map((it) => it.name).join(", ")}
            </p>
          ) : null}

          <ReceiptDivider />

          <ul className="space-y-2">
            {items.map((it) => {
              const claimers = memberList.filter((m) =>
                (m.claimed_item_ids ?? []).includes(it.id),
              );
              const isUnclaimed = claimers.length === 0;
              return (
                <li
                  key={it.id}
                  className={cn(
                    "flex flex-wrap items-center justify-between gap-2 border px-3 py-2 font-mono text-xs",
                    isUnclaimed
                      ? "border-stamp/40 bg-stamp-soft/40"
                      : "border-border bg-surface",
                  )}
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="truncate text-foreground">{it.name}</span>
                    <AmountDisplay cents={it.price_cents} size="sm" muted />
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {isUnclaimed ? (
                      <span className="text-[10px] uppercase tracking-widest text-stamp">
                        Unclaimed
                      </span>
                    ) : (
                      claimers.map((c) => (
                        <span
                          key={c.id}
                          className="border border-border bg-paper px-1.5 py-0.5 text-[10px] text-foreground-soft"
                        >
                          {c.name}
                        </span>
                      ))
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </ReceiptCard>
      ) : null}

      <ReceiptCard className="p-6 sm:p-8">
        <h2 className="font-display text-2xl uppercase tracking-tight text-foreground">
          Activity
        </h2>
        <p className="mt-1 text-xs text-foreground-soft">
          Newest first. Live-updates from realtime.
        </p>

        <ReceiptDivider />

        <ActivityTimeline events={events} emptyLabel="No views or payments yet." />
      </ReceiptCard>
    </div>
  );
}

// ---------- Bits ----------

function ColumnFigure({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  // Mobile (<sm): horizontal label : value row so the 3 figures stack
  // vertically inside the parent dl — readable at 375px instead of
  // squeezing label + amount into a ~95px column.
  // Tablet+ (sm:): original stacked label-above-value, right-aligned, so
  // the dl can sit beside the member's name block as a compact 3-col.
  return (
    <div className="flex items-baseline justify-between gap-3 sm:flex-col sm:items-end sm:justify-start sm:gap-0">
      <dt className="text-[10px] uppercase tracking-widest text-foreground-soft sm:text-[9px] sm:text-foreground-faint">
        {label}
      </dt>
      <dd className="font-mono tabular">{children}</dd>
    </div>
  );
}

function StatusBadge({
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

/*
 * Difference cell colour signals are intentional:
 *   - settled (0)        → ringgit green: nothing to do
 *   - overpaid (> 0)     → highlighter yellow: organizer owes this
 *                          person a refund (good outcome, attention-
 *                          worthy but not bad)
 *   - underpaid (< 0)    → stamp red: this person still owes more
 *                          (bad outcome, organizer needs to chase)
 */
function DeltaCell({ cents }: { cents: number }) {
  if (cents === 0) {
    return (
      <span className="text-ringgit">
        <AmountDisplay cents={0} size="sm" className="text-ringgit" />
      </span>
    );
  }
  if (cents > 0) {
    return (
      <span className="text-highlighter" title="Overpaid — refund expected">
        +<AmountDisplay cents={cents} size="sm" className="text-highlighter" />
      </span>
    );
  }
  return (
    <span className="text-stamp" title="Underpaid — still owed">
      <AmountDisplay cents={cents} size="sm" className="text-stamp" />
    </span>
  );
}

function formatDuration(ms: number): string {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ${minutes % 60}m`;
  const days = Math.floor(hours / 24);
  return `${days}d ${hours % 24}h`;
}
