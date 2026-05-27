import { ReceiptCard, ReceiptDivider } from "@/components/receipt-card";
import { Skeleton } from "@/components/skeleton";

export default function BillDetailLoading() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div className="flex items-center justify-between gap-2">
        <Skeleton className="h-9 w-24" />
        <Skeleton className="h-9 w-32" />
      </div>

      <ReceiptCard className="p-6 sm:p-8">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="mt-3 h-10 w-3/4" />
        <ReceiptDivider />
        <div className="flex items-baseline justify-between">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-8 w-32" />
        </div>
        <Skeleton className="mt-4 h-2 w-full" />

        <ReceiptDivider label="Share" />
        <div className="flex flex-col gap-2 sm:flex-row">
          <Skeleton className="h-11 flex-1" />
          <Skeleton className="h-11 flex-1" />
        </div>

        <ReceiptDivider label="Members" />
        <ul className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <li key={i} className="border border-border bg-surface px-3 py-3">
              <Skeleton className="h-4 w-32" />
              <div className="mt-2 grid grid-cols-2 gap-2">
                <Skeleton className="h-9" />
                <Skeleton className="h-9" />
              </div>
            </li>
          ))}
        </ul>
      </ReceiptCard>
    </div>
  );
}
