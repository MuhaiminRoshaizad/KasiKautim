import { ReceiptCard, ReceiptDivider } from "@/components/receipt-card";
import { Skeleton } from "@/components/skeleton";

export default function SettingsLoading() {
  return (
    <div className="mx-auto max-w-xl">
      <ReceiptCard className="p-6 sm:p-8">
        <Skeleton className="h-9 w-24" />
        <Skeleton className="mt-4 h-8 w-40" />
        <Skeleton className="mt-2 h-4 w-64" />
        <ReceiptDivider />
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="mb-4">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="mt-2 h-12 w-full" />
          </div>
        ))}
        <Skeleton className="mt-2 h-12 w-full" />
      </ReceiptCard>
    </div>
  );
}
