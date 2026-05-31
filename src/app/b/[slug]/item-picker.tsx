"use client";

import { useRouter } from "next/navigation";
import { useEffect, useOptimistic, useState, useTransition } from "react";

import { AmountDisplay } from "@/components/amount-display";
import { ItemClaimPicker } from "@/components/item-claim-picker";
import { ReceiptDivider } from "@/components/receipt-card";
import { cn } from "@/lib/cn";
import { computeMemberShares, type MemberClaim } from "@/lib/item-split";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import {
  toggleItemClaim,
  type ToggleItemClaimState,
} from "@/actions/items";
import type { BillItem } from "@/types/db";

interface MemberPickerInfo {
  id: string;
  name: string;
  claimedItemIds: string[];
  paid: boolean;
}

interface ItemPickerProps {
  billId: string;
  token: string;
  meId: string;
  items: BillItem[];
  members: MemberPickerInfo[];
  taxCents: number;
  discountCents: number;
}

const INITIAL: ToggleItemClaimState = { ok: null, message: "" };

/*
 * Recipient item picker. Wires the shared ItemClaimPicker into the
 * recipient's token-based toggleItemClaim flow, subscribes to realtime
 * updates so any claim by anyone re-renders this view, and shows a
 * live "Your share" preview computed locally (mirrors the
 * _recompute_item_shares trigger so the number matches what the DB
 * will store post-toggle).
 *
 * Quantity-stacked items (e.g. "3 Teh Tarik" expanded by the scanner)
 * collapse back into a single grouped row with a stepper inside the
 * shared picker — see ItemClaimPicker for the spec.
 */
export function ItemPicker({
  billId,
  token,
  meId,
  items,
  members,
  taxCents,
  discountCents,
}: ItemPickerProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // True when the realtime channel fails to connect or drops - usually
  // a tracker blocker (Brave / Firefox+uBlock) killing the websocket.
  // Surfaced as a banner so the user knows other people's claims won't
  // appear live; tapping refresh manually still works.
  const [realtimeBroken, setRealtimeBroken] = useState(false);

  // Optimistic mirror of members so the chip flips instantly on tap
  // instead of waiting for the full Vercel -> Supabase Tokyo round-trip
  // (~500-1200ms on mobile). React resets this to the `members` prop
  // automatically when the transition completes, so server truth wins
  // on conflict. Same pattern as the React docs' useOptimistic example.
  const [optimisticMembers, applyOptimisticToggle] = useOptimistic(
    members,
    (state, op: { memberId: string; itemId: string }) =>
      state.map((m) => {
        if (m.id !== op.memberId) return m;
        const has = m.claimedItemIds.includes(op.itemId);
        return {
          ...m,
          claimedItemIds: has
            ? m.claimedItemIds.filter((id) => id !== op.itemId)
            : [...m.claimedItemIds, op.itemId],
        };
      }),
  );

  // Realtime: any claim by anyone re-renders the picker via router.refresh().
  // The subscribe callback yields status updates - SUBSCRIBED on success,
  // CHANNEL_ERROR / TIMED_OUT if a tracker blocker drops the websocket
  // or the network goes flaky. CLOSED is excluded — it also fires on
  // intentional removeChannel() in cleanup, which would flash the
  // banner on every navigation.
  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    const channel = supabase
      .channel(`item-picker:${billId}`)
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
      .subscribe((status) => {
        if (status === "SUBSCRIBED") setRealtimeBroken(false);
        else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          setRealtimeBroken(true);
        }
      });
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [billId, router]);

  const me = optimisticMembers.find((m) => m.id === meId);

  // Compute live shares from the optimistic state so the share preview
  // updates the same instant the chip does.
  const memberClaims: MemberClaim[] = optimisticMembers.map((m) => ({
    memberId: m.id,
    claimedItemIds: m.claimedItemIds,
  }));
  const shares = computeMemberShares(items, memberClaims, taxCents, discountCents);
  const myShare = shares.get(meId);

  const handleToggle = (itemId: string) => {
    if (me?.paid) return;
    setErrorMessage(null);

    const fd = new FormData();
    fd.append("token", token);
    fd.append("itemId", itemId);

    startTransition(async () => {
      // Flip the chip immediately. If the server rejects, the transition
      // ends without router.refresh() picking up a new state and React
      // snaps the optimistic value back to `members` on its own.
      applyOptimisticToggle({ memberId: meId, itemId });
      const result = await toggleItemClaim(INITIAL, fd);
      if (!result.ok) {
        setErrorMessage(result.message);
        return;
      }
      // Realtime usually echoes back first, but kick a refresh too so
      // the canonical server state lands even if the channel is slow.
      router.refresh();
    });
  };

  if (!me) {
    return (
      <p className="text-sm text-foreground-soft">
        Hmm — couldn&apos;t find your record on this bill.
      </p>
    );
  }

  const claimedAny = me.claimedItemIds.length > 0;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs text-foreground-soft">
        Tap each item you ordered. For lines like &quot;Nasi Lemak ×3&quot;
        use the [−] [+] stepper to pick how many you ate.
      </p>

      {realtimeBroken ? (
        <p
          role="status"
          className="border-l-2 border-highlighter bg-highlighter/10 px-3 py-2 text-[11px] text-foreground-soft"
        >
          Live updates are off (network or browser extension blocked the
          connection). Your taps still save. Pull-to-refresh to see other
          claimers.
        </p>
      ) : null}

      <ItemClaimPicker
        items={items}
        members={optimisticMembers}
        meId={meId}
        onToggle={handleToggle}
        disabled={me.paid}
      />

      {errorMessage ? (
        <p role="alert" className="text-xs text-stamp">
          {errorMessage}
        </p>
      ) : null}

      <ReceiptDivider label="Your share" />

      <dl className="space-y-1 font-mono text-xs">
        <ShareRow label={`Items you tapped (${me.claimedItemIds.length})`}>
          <AmountDisplay cents={myShare?.subtotalCents ?? 0} size="sm" muted />
        </ShareRow>
        {taxCents > 0 ? (
          <ShareRow label="Your share of tax / service">
            <AmountDisplay cents={myShare?.taxShareCents ?? 0} size="sm" muted />
          </ShareRow>
        ) : null}
        <ShareRow label="Your total" emphasize>
          <AmountDisplay cents={myShare?.totalCents ?? 0} size="lg" />
        </ShareRow>
      </dl>

      {!claimedAny && !me.paid ? (
        <p className="text-center text-[11px] text-foreground-faint">
          Tap your items above to see your total.
        </p>
      ) : null}
    </div>
  );
}

function ShareRow({
  label,
  emphasize,
  children,
}: {
  label: string;
  emphasize?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex items-baseline justify-between gap-3",
        emphasize && "border-t border-border pt-1.5",
      )}
    >
      <dt
        className={cn(
          "text-foreground-soft",
          emphasize && "text-xs font-medium uppercase tracking-widest text-foreground",
        )}
      >
        {label}
      </dt>
      <dd className="tabular">{children}</dd>
    </div>
  );
}
