"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { toast } from "sonner";

import { formatMYR } from "@/lib/money";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

interface RealtimeBillSubscriptionProps {
  billId: string;
}

interface BillMemberPayload {
  id: string;
  name: string;
  amount_owed_cents: number;
  paid: boolean;
}

/*
 * Subscribes to bill_members UPDATE events for the given bill_id.
 * RLS gates which events the client actually receives — only the organizer
 * (authenticated, owns the bill) gets payloads through. Anon never sees anything.
 *
 * On a paid=false -> paid=true transition we fire a sonner toast and call
 * router.refresh() so the Server Component re-fetches the bill data and the
 * progress bar + member badges update without a page reload.
 */
export function RealtimeBillSubscription({
  billId,
}: RealtimeBillSubscriptionProps) {
  const router = useRouter();

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    const channel = supabase
      .channel(`bill-members:${billId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "bill_members",
          filter: `bill_id=eq.${billId}`,
        },
        (payload) => {
          const prev = payload.old as Partial<BillMemberPayload>;
          const next = payload.new as BillMemberPayload;
          if (next.paid && !prev.paid) {
            toast.success(`${next.name} just paid ${formatMYR(next.amount_owed_cents)}`, {
              description: "Bill updated.",
            });
            router.refresh();
          }
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [billId, router]);

  return null;
}
