import Link from "next/link";
import { Plus } from "lucide-react";

import { BillProgressCard } from "@/components/bill-progress-card";
import { buttonClassName } from "@/components/button";
import { ReceiptCard, ReceiptDivider } from "@/components/receipt-card";
import { sumCents } from "@/lib/money";
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
  const supabase = await createSupabaseServerClient();

  // RLS scopes both bills and bill_members to the organizer's rows.
  const { data } = await supabase
    .from("bills")
    .select(
      "id, slug, title, total_cents, due_date, status, created_at, bill_members(amount_owed_cents, paid)",
    )
    .order("created_at", { ascending: false });

  const bills = (data ?? []) as BillWithMembers[];

  if (bills.length === 0) {
    return <EmptyState />;
  }

  return (
    <div className="mx-auto max-w-3xl">
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
            <li key={b.id}>
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

function EmptyState() {
  return (
    <div className="mx-auto max-w-xl">
      <ReceiptCard className="p-8 text-center">
        <div className="font-mono text-[10px] uppercase tracking-widest text-foreground-faint">
          Dashboard · empty
        </div>
        <h1 className="mt-2 font-display text-3xl uppercase tracking-tight text-foreground">
          No bills yet lah
        </h1>
        <p className="mx-auto mt-3 max-w-sm text-sm text-foreground-soft">
          Create your first bill and we&apos;ll mint a shareable link you can
          drop straight into the group chat.
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
