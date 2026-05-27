"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Check, Loader2 } from "lucide-react";

import { AmountDisplay } from "@/components/amount-display";
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

  // Track in-flight toggles per item so a 2nd tap during 1st request just
  // queues — and we can show a spinner on the chip.
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
  const myClaims = new Set(me?.claimedItemIds ?? []);

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
        Tap each item you ordered. Items shared by multiple people split equally
        among everyone who taps them.
      </p>

      <ul className="space-y-2">
        {items.map((item) => {
          const isMine = myClaims.has(item.id);
          const isPending = pendingItemIds.has(item.id);
          const claimers = members.filter((m) =>
            m.claimedItemIds.includes(item.id),
          );
          const otherClaimers = claimers.filter((m) => m.id !== meId);

          return (
            <li key={item.id}>
              <button
                type="button"
                disabled={me.paid || isPending}
                onClick={() => handleToggle(item.id)}
                aria-pressed={isMine}
                className={cn(
                  "flex w-full items-center gap-3 border px-3 py-3 text-left transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                  isMine
                    ? "border-ringgit bg-ringgit-soft/60"
                    : "border-border bg-surface hover:bg-surface-deep",
                  (me.paid || isPending) && "cursor-not-allowed opacity-70",
                )}
              >
                <span
                  className={cn(
                    "inline-flex h-5 w-5 shrink-0 items-center justify-center border",
                    isMine
                      ? "border-ringgit bg-ringgit text-paper"
                      : "border-border bg-transparent text-transparent",
                  )}
                  aria-hidden
                >
                  {isPending ? (
                    <Loader2 size={12} className="animate-spin text-foreground" />
                  ) : isMine ? (
                    <Check size={12} />
                  ) : null}
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span
                      className={cn(
                        "truncate font-mono text-sm",
                        isMine ? "text-foreground" : "text-foreground-soft",
                      )}
                    >
                      {item.name}
                    </span>
                    <AmountDisplay
                      cents={item.price_cents}
                      size="sm"
                      muted={!isMine}
                    />
                  </div>
                  {otherClaimers.length > 0 ? (
                    <div className="mt-1 flex flex-wrap gap-1 text-[10px] text-foreground-faint">
                      <span>Shared with:</span>
                      {otherClaimers.map((c) => (
                        <span
                          key={c.id}
                          className="border border-border bg-surface px-1.5 py-0.5 font-mono"
                        >
                          {c.name}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
              </button>
            </li>
          );
        })}
      </ul>

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
