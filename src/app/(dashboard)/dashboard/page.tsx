import Link from "next/link";
import { Plus } from "lucide-react";

import { buttonClassName } from "@/components/button";
import { ReceiptCard, ReceiptDivider } from "@/components/receipt-card";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function DashboardPage() {
  const supabase = await createSupabaseServerClient();

  // RLS scopes this to bills the current user organizes.
  const { data: bills } = await supabase
    .from("bills")
    .select("id, slug, title, total_cents, status, created_at")
    .order("created_at", { ascending: false });

  if (!bills || bills.length === 0) {
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

  // Real list lands D3. Placeholder for D1.
  return (
    <div>
      <h1 className="font-display text-3xl uppercase tracking-tight text-foreground">
        Your bills
      </h1>
      <ul className="mt-6 space-y-3">
        {bills.map((b) => (
          <li key={b.id} className="border border-border bg-surface px-4 py-3">
            <div className="font-mono text-xs uppercase tracking-widest text-foreground-faint">
              {b.slug}
            </div>
            <div className="mt-1 font-display text-lg uppercase tracking-tight text-foreground">
              {b.title}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
