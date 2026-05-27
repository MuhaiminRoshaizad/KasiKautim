"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

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
  const [pendingItemIds, setPendingItemIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Realtime: any claim by anyone re-renders the picker via router.refresh().
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
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [billId, router]);

  const me = members.find((m) => m.id === meId);

  // Compute live shares (mirrors what the DB will store post-claim).
  const memberClaims: MemberClaim[] = members.map((m) => ({
    memberId: m.id,
    claimedItemIds: m.claimedItemIds,
  }));
  const shares = computeMemberShares(items, memberClaims, taxCents, discountCents);
  const myShare = shares.get(meId);

  const handleToggle = (itemId: string) => {
    if (me?.paid) return;
    setErrorMessage(null);
    setPendingItemIds((s) => new Set(s).add(itemId));

    const fd = new FormData();
    fd.append("token", token);
    fd.append("itemId", itemId);

    startTransition(async () => {
      const result = await toggleItemClaim(INITIAL, fd);
      setPendingItemIds((s) => {
        const next = new Set(s);
        next.delete(itemId);
        return next;
      });
      if (!result.ok) {
        setErrorMessage(result.message);
      } else {
        // Local recompute is instant via Realtime, but kick a refresh too
        // in case the channel hasn't echoed yet.
        router.refresh();
      }
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

      <ItemClaimPicker
        items={items}
        members={members}
        meId={meId}
        onToggle={handleToggle}
        disabled={me.paid}
        pendingItemIds={pendingItemIds}
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
