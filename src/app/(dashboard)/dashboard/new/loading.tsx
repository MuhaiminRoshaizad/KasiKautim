import { ReceiptCard, ReceiptDivider } from "@/components/receipt-card";
import { Skeleton } from "@/components/skeleton";

export default function NewBillLoading() {
  return (
    <div className="mx-auto max-w-2xl">
      <Skeleton className="mb-6 h-8 w-40" />
      <ReceiptCard className="p-6 sm:p-8">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="mb-5">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="mt-2 h-12 w-full" />
          </div>
        ))}
        <ReceiptDivider />
        <Skeleton className="h-12 w-full" />
      </ReceiptCard>
    </div>
  );
}
