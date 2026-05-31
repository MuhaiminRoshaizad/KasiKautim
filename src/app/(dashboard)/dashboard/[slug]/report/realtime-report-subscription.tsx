"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { toast } from "sonner";

import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

/**
 * Re-renders the report page when bill_members UPDATE or payment_events INSERT
 * lands. Both filtered to this bill. Two channels because supabase-js filters
 * are per-event-type (not OR-able across tables).
 *
 * Subscribe callback flags CHANNEL_ERROR / TIMED_OUT so the user knows
 * the report stopped auto-updating (tracker blocker, VPN, etc.) and can
 * refresh manually rather than trust stale data.
 */
export function RealtimeReportSubscription({ billId }: { billId: string }) {
  const router = useRouter();

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    let warned = false;
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
      .subscribe((status) => {
        // CLOSED also fires on intentional removeChannel() in cleanup, so
        // it would flash the toast on every navigation. CHANNEL_ERROR and
        // TIMED_OUT are the only unambiguous failure signals.
        if (
          (status === "CHANNEL_ERROR" || status === "TIMED_OUT") &&
          !warned
        ) {
          warned = true;
          toast.warning("Live report updates paused", {
            description:
              "Connection blocked or dropped. Refresh to see the latest.",
            duration: 8000,
          });
        }
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [billId, router]);

  return null;
}
