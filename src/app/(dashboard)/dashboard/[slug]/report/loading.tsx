import { ReceiptCard, ReceiptDivider } from "@/components/receipt-card";
import { Skeleton } from "@/components/skeleton";

export default function ReportLoading() {
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-9 w-32" />
        <Skeleton className="h-9 w-24" />
      </div>

      <ReceiptCard className="p-6 sm:p-8">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="mt-2 h-10 w-3/4" />
        <ReceiptDivider />
        <div className="grid gap-3 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="border border-border bg-surface p-3">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="mt-2 h-7 w-24" />
              <Skeleton className="mt-2 h-3 w-32" />
            </div>
          ))}
        </div>
        <Skeleton className="mt-4 h-2 w-full" />
      </ReceiptCard>

      <ReceiptCard className="p-6 sm:p-8">
        <Skeleton className="h-6 w-48" />
        <ReceiptDivider />
        <ul className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <li
              key={i}
              className="flex flex-col gap-3 border border-border bg-surface p-4 sm:flex-row"
            >
              <Skeleton className="h-5 w-32 sm:flex-1" />
              <div className="grid grid-cols-3 gap-2 sm:w-72">
                {Array.from({ length: 3 }).map((__, j) => (
                  <Skeleton key={j} className="h-8" />
                ))}
              </div>
            </li>
          ))}
        </ul>
      </ReceiptCard>
    </div>
  );
}
