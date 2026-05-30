import Image from "next/image";
import Link from "next/link";
import { AlertCircle, ArrowRight, Plus } from "lucide-react";

import { BillProgressCard } from "@/components/bill-progress-card";
import { buttonClassName } from "@/components/button";
import { ReceiptCard, ReceiptDivider } from "@/components/receipt-card";
import { cn } from "@/lib/cn";
import { sumCents } from "@/lib/money";
import { getCurrentSession } from "@/lib/supabase/current-user";
import { createSupabaseServerClient } from "@/lib/supabase/server";

interface BillWithMembers {
  id: string;
  slug: string;
  title: string;
  total_cents: number;
  due_date: string | null;
  status: string;
  created_at: string;
  bill_members: { amount_owed_cents: number; paid: boolean }[];
}

export default async function DashboardPage() {
  // Cached session lookup deduped with the dashboard layout (same render).
  // Layout already redirected if !user, so we can assume it's present here.
  const session = await getCurrentSession();
  const user = session?.user;
  const supabase = await createSupabaseServerClient();

  // RLS scopes both bills and bill_members to the organizer's rows.
  // Profile read in parallel — the layout already verified user is present.
  const [billsResult, profileResult] = await Promise.all([
    supabase
      .from("bills")
      .select(
        "id, slug, title, total_cents, due_date, status, created_at, bill_members(amount_owed_cents, paid)",
      )
      .order("created_at", { ascending: false }),
    supabase
      .from("profiles")
      .select("duitnow_id")
      .eq("id", user?.id ?? "")
      .maybeSingle(),
  ]);

  const bills = (billsResult.data ?? []) as BillWithMembers[];
  const needsDuitnow = !profileResult.data?.duitnow_id;

  if (bills.length === 0) {
    return <EmptyState needsDuitnow={needsDuitnow} />;
  }

  return (
    <div className="mx-auto max-w-3xl">
      {needsDuitnow ? <DuitnowSetupBanner /> : null}

      <div className="mb-6 flex items-end justify-between gap-3">
        <h1 className="font-display text-3xl uppercase tracking-tight text-foreground">
          Your bills
        </h1>
        <Link
          href="/dashboard/new"
          className={buttonClassName({
            size: "md",
            className: "font-display uppercase tracking-widest",
          })}
        >
          <Plus size={16} aria-hidden />
          New bill
        </Link>
      </div>

      <ul className="grid gap-4 sm:grid-cols-2">
        {bills.map((b) => {
          const members = b.bill_members ?? [];
          const paidMembers = members.filter((m) => m.paid);
          const collected = sumCents(paidMembers.map((m) => m.amount_owed_cents));
          return (
            // min-w-0 is load-bearing — grid items default to min-width:auto
            // (= intrinsic content width), which overrides the `truncate` on
            // the title and lets the card overflow the viewport horizontally.
            <li key={b.id} className="min-w-0">
              <BillProgressCard
                slug={b.slug}
                title={b.title}
                totalCents={b.total_cents}
                collectedCents={collected}
                memberCount={members.length}
                paidCount={paidMembers.length}
                dueDate={b.due_date}
              />
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function EmptyState({ needsDuitnow }: { needsDuitnow: boolean }) {
  return (
    <div className="mx-auto max-w-xl">
      {needsDuitnow ? <DuitnowSetupBanner /> : null}
      <ReceiptCard className="p-8 text-center">
        <Image
          src="/empty-bills.svg"
          alt=""
          width={220}
          height={200}
          className="mx-auto h-40 w-auto"
          priority
        />
        <div className="mt-4 font-mono text-[10px] uppercase tracking-widest text-foreground-faint">
          Dashboard · empty
        </div>
        <h1 className="mt-2 font-display text-3xl uppercase tracking-tight text-foreground">
          No bills yet lah
        </h1>
        <p className="mx-auto mt-3 max-w-sm text-sm text-foreground-soft">
          Set up a bill and get one link to drop in the group chat.
        </p>

        <ReceiptDivider />

        <Link
          href="/dashboard/new"
          className={buttonClassName({
            size: "lg",
            className: "font-display uppercase tracking-widest",
          })}
        >
          <Plus size={18} aria-hidden />
          Create your first bill
        </Link>
      </ReceiptCard>
    </div>
  );
}

function DuitnowSetupBanner() {
  return (
    <Link
      href="/dashboard/settings"
      className={cn(
        "mb-6 flex items-center justify-between gap-3 border border-highlighter/60 bg-highlighter/10 px-4 py-3",
        "transition-colors hover:bg-highlighter/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-2 focus-visible:ring-offset-background",
      )}
    >
      <div className="flex items-start gap-3">
        <AlertCircle
          size={18}
          aria-hidden
          className="mt-0.5 shrink-0 text-foreground"
        />
        <div>
          <p className="text-sm font-medium text-foreground">
            Add your DuitNow ID
          </p>
          <p className="mt-0.5 text-[11px] text-foreground-soft">
            Without it, recipients can&apos;t tap-to-copy your account when
            they pay.
          </p>
        </div>
      </div>
      <ArrowRight
        size={16}
        aria-hidden
        className="shrink-0 text-foreground-soft"
      />
    </Link>
  );
}
