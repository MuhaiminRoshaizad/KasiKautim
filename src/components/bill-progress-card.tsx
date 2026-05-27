import Link from "next/link";
import { Users } from "lucide-react";

import { AmountDisplay } from "@/components/amount-display";
import { InkStamp } from "@/components/ink-stamp";
import { ProgressBar } from "@/components/progress-bar";
import { ReceiptCard, ReceiptDivider } from "@/components/receipt-card";
import { cn } from "@/lib/cn";

export interface BillProgressCardProps {
  slug: string;
  title: string;
  totalCents: number;
  collectedCents: number;
  memberCount: number;
  paidCount: number;
  dueDate?: string | null;
}

export function BillProgressCard({
  slug,
  title,
  totalCents,
  collectedCents,
  memberCount,
  paidCount,
  dueDate,
}: BillProgressCardProps) {
  const settled = memberCount > 0 && paidCount === memberCount;
  const progress = totalCents > 0 ? collectedCents / totalCents : 0;

  return (
    <Link
      href={`/dashboard/${slug}`}
      className={cn(
        "group block focus-visible:outline-none",
        "[&>*]:transition-shadow [&>*]:duration-150",
        "focus-visible:[&>*]:ring-2 focus-visible:[&>*]:ring-foreground",
        "hover:[&>*]:shadow-[0_2px_0_rgba(0,0,0,0.04),0_18px_28px_-12px_rgba(0,0,0,0.22)]",
      )}
    >
      <ReceiptCard className="p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-foreground-faint">
              <span>{slug}</span>
              {dueDate ? (
                <>
                  <span aria-hidden>·</span>
                  <span>Due {dueDate}</span>
                </>
              ) : null}
            </div>
            <h2 className="mt-1 truncate font-display text-2xl uppercase tracking-tight text-foreground">
              {title}
            </h2>
          </div>
          {settled ? (
            <InkStamp label="Settled" variant="paid" rotate={-6} />
          ) : null}
        </div>

        <ReceiptDivider />

        <div className="flex items-center justify-between gap-3 text-xs text-foreground-soft">
          <span className="inline-flex items-center gap-1.5 font-mono tabular">
            <Users size={12} aria-hidden />
            {memberCount} {memberCount === 1 ? "member" : "members"}
          </span>
          <span className="font-mono tabular">
            {paidCount} / {memberCount} paid
          </span>
        </div>

        <div className="mt-3 flex items-baseline justify-between gap-3">
          <AmountDisplay cents={collectedCents} size="lg" />
          <span className="font-mono text-sm text-foreground-faint tabular">
            / <AmountDisplay cents={totalCents} size="sm" muted />
          </span>
        </div>
        <div className="mt-3">
          <ProgressBar value={progress} />
        </div>
      </ReceiptCard>
    </Link>
  );
}
