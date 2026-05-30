import { ReceiptCard } from "@/components/receipt-card";
import { Skeleton } from "@/components/skeleton";

export default function DashboardLoading() {
  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex items-end justify-between gap-3">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-11 w-32" />
      </div>
      <ul className="grid gap-4 sm:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <li key={i} className="min-w-0">
            <ReceiptCard flat className="p-5">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="mt-3 h-6 w-3/4" />
              <Skeleton className="mt-4 h-3 w-1/2" />
              <Skeleton className="mt-2 h-2 w-full" />
            </ReceiptCard>
          </li>
        ))}
      </ul>
    </div>
  );
}
