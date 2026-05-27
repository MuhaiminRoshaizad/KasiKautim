"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

/**
 * Re-renders the report page when bill_members UPDATE or payment_events INSERT
 * lands. Both filtered to this bill. Two channels because supabase-js filters
 * are per-event-type (not OR-able across tables).
 */
export function RealtimeReportSubscription({ billId }: { billId: string }) {
  const router = useRouter();

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    const channel = supabase
      .channel(`report:${billId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "bill_members",
          filter: `bill_id=eq.${billId}`,
        },
        () => router.refresh(),
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "payment_events",
          filter: "event_type=in.(claimed,paid)",
        },
        () => router.refresh(),
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [billId, router]);

  return null;
}
