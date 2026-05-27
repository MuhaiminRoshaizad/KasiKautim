"use client";

import { useMemo } from "react";
import { Check, Loader2, Minus, Plus } from "lucide-react";

import { AmountDisplay } from "@/components/amount-display";
import { cn } from "@/lib/cn";
import { groupItemsByName, type ItemGroup } from "@/lib/item-groups";
import type { MemberClaim } from "@/lib/item-split";
import type { BillItem } from "@/types/db";

/*
 * Shared item-claim picker used by both the recipient page
 * (`/b/[slug]/item-picker`) and the create-bill form's organizer
 * "what did YOU eat?" section.
 *
 * Two render paths per item group:
 *   - size 1: single tap-to-toggle chip (existing pattern)
 *   - size > 1: grouped row with a [−] N [+] stepper
 *
 * Stepper assigns "the next available unit" on +, "the most-recent
 * mine" on −. It can't express "share a single unit with someone else"
 * — that's the existing co-tap-the-same-chip pattern, which only
 * triggers when stacked items are manually split in the editor.
 *
 * Pure controlled component: every claim change goes through
 * onToggle(itemId), so the caller owns the actual mutation (calls
 * toggleItemClaim server action with token, or whatever).
 */

export interface MemberPickerInfo {
  id: string;
  name: string;
  claimedItemIds: string[];
  paid: boolean;
}

interface ItemClaimPickerProps {
  items: readonly BillItem[];
  members: readonly MemberPickerInfo[];
  meId: string;
  onToggle: (itemId: string) => void;
  disabled?: boolean;
  pendingItemIds?: ReadonlySet<string>;
}

export function ItemClaimPicker({
  items,
  members,
  meId,
  onToggle,
  disabled = false,
  pendingItemIds,
}: ItemClaimPickerProps) {
  const memberClaims = useMemo<MemberClaim[]>(
    () =>
      members.map((m) => ({
        memberId: m.id,
        claimedItemIds: m.claimedItemIds,
      })),
    [members],
  );
  const groups = useMemo(
    () => groupItemsByName(items, memberClaims),
    [items, memberClaims],
  );
  const nameById = useMemo(
    () => new Map(members.map((m) => [m.id, m.name])),
    [members],
  );

  return (
    <ul className="space-y-2">
      {groups.map((group) =>
        group.units.length === 1 ? (
          <li key={group.units[0]!.id}>
            <SingleChip
              group={group}
              meId={meId}
              nameById={nameById}
              disabled={disabled}
              pending={pendingItemIds?.has(group.units[0]!.id) ?? false}
              onToggle={onToggle}
            />
          </li>
        ) : (
          <li key={group.units[0]!.id}>
            <StepperRow
              group={group}
              meId={meId}
              nameById={nameById}
              disabled={disabled}
              pendingItemIds={pendingItemIds}
              onToggle={onToggle}
            />
          </li>
        ),
      )}
    </ul>
  );
}

// ---------- Single chip (group of 1) ----------

function SingleChip({
  group,
  meId,
  nameById,
  disabled,
  pending,
  onToggle,
}: {
  group: ItemGroup;
  meId: string;
  nameById: Map<string, string>;
  disabled: boolean;
  pending: boolean;
  onToggle: (itemId: string) => void;
}) {
  const unit = group.units[0]!;
  const isMine = unit.claimedByMemberIds.includes(meId);
  const otherClaimers = unit.claimedByMemberIds.filter((id) => id !== meId);

  return (
    <button
      type="button"
      disabled={disabled || pending}
      onClick={() => onToggle(unit.id)}
      aria-pressed={isMine}
      className={cn(
        "flex w-full items-center gap-3 border px-3 py-3 text-left transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        isMine
          ? "border-ringgit bg-ringgit-soft/60"
          : "border-border bg-surface hover:bg-surface-deep",
        (disabled || pending) && "cursor-not-allowed opacity-70",
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
        {pending ? (
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
            {group.baseName}
          </span>
          <AmountDisplay
            cents={group.unitPriceCents}
            size="sm"
            muted={!isMine}
          />
        </div>
        {otherClaimers.length > 0 ? (
          <div className="mt-1 flex flex-wrap items-center gap-1 text-[10px] text-foreground-faint">
            <span>Shared with:</span>
            {otherClaimers.map((id, i) => (
              <span
                key={`${id}-${i}`}
                className="border border-border bg-surface px-1.5 py-0.5 font-mono"
              >
                {nameById.get(id) ?? "Unknown"}
              </span>
            ))}
          </div>
        ) : null}
        {isMine && !pending ? (
          <p className="mt-1 text-[10px] uppercase tracking-widest text-ringgit">
            ✓ Tapped · tap to remove
          </p>
        ) : null}
      </div>
    </button>
  );
}

// ---------- Stepper row (group of >1) ----------

function StepperRow({
  group,
  meId,
  nameById,
  disabled,
  pendingItemIds,
  onToggle,
}: {
  group: ItemGroup;
  meId: string;
  nameById: Map<string, string>;
  disabled: boolean;
  pendingItemIds?: ReadonlySet<string>;
  onToggle: (itemId: string) => void;
}) {
  // Bucket the units by ownership so increment/decrement can pick the
  // right one to toggle.
  const mineUnits = group.units.filter((u) =>
    u.claimedByMemberIds.includes(meId),
  );
  const availableUnits = group.units.filter(
    (u) => u.claimedByMemberIds.length === 0,
  );
  const othersClaimed = group.units.flatMap((u) =>
    u.claimedByMemberIds.filter((id) => id !== meId),
  );

  // "I can claim up to this many" = my current count + what's still
  // unclaimed (we don't steal from other claimers — sharing is a
  // separate concern handled by manually splitting the line).
  const myCount = mineUnits.length;
  const max = myCount + availableUnits.length;
  const anyPending = group.units.some(
    (u) => pendingItemIds?.has(u.id) ?? false,
  );

  const claimerSummary = useMemo(() => {
    // Count claims per non-me member for the "Aisha 1 · Faiz 1" line.
    const counts = new Map<string, number>();
    for (const id of othersClaimed) {
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
    const parts = Array.from(counts.entries()).map(([id, n]) => {
      const name = nameById.get(id) ?? "Unknown";
      return `${name} ${n}`;
    });
    return parts;
  }, [othersClaimed, nameById]);

  const remaining = availableUnits.length;
  const isMine = myCount > 0;

  const handleIncrement = () => {
    if (disabled || anyPending) return;
    const next = availableUnits[0];
    if (next) onToggle(next.id);
  };

  const handleDecrement = () => {
    if (disabled || anyPending) return;
    const drop = mineUnits[mineUnits.length - 1];
    if (drop) onToggle(drop.id);
  };

  const onValueKeyDown = (e: React.KeyboardEvent) => {
    if (disabled || anyPending) return;
    switch (e.key) {
      case "ArrowUp":
      case "ArrowRight":
        e.preventDefault();
        handleIncrement();
        break;
      case "ArrowDown":
      case "ArrowLeft":
        e.preventDefault();
        handleDecrement();
        break;
      case "Home":
        e.preventDefault();
        if (myCount > 0) {
          // Drop them one at a time — simpler than mutating in bulk;
          // realtime echo will keep the UI consistent.
          mineUnits.forEach((u) => onToggle(u.id));
        }
        break;
      case "End":
        e.preventDefault();
        availableUnits.forEach((u) => onToggle(u.id));
        break;
    }
  };

  return (
    <div
      className={cn(
        "border bg-surface p-3 sm:p-4 transition-colors",
        isMine ? "border-ringgit bg-ringgit-soft/40" : "border-border",
      )}
    >
      {/* Title row: name + ×N + unit price */}
      <div className="flex items-baseline justify-between gap-3 font-mono">
        <div className="flex min-w-0 items-baseline gap-2">
          <span
            className={cn(
              "truncate text-sm",
              isMine ? "text-foreground" : "text-foreground-soft",
            )}
          >
            {group.baseName}
          </span>
          <span className="text-xs text-foreground-faint">
            ×{group.units.length}
          </span>
        </div>
        <span className="flex items-baseline gap-1 text-[10px] text-foreground-faint">
          <AmountDisplay
            cents={group.unitPriceCents}
            size="sm"
            muted={!isMine}
          />
          <span>each</span>
        </span>
      </div>

      {/* Status row: who else has how many + how many are left */}
      {(claimerSummary.length > 0 || remaining > 0) && (
        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-foreground-faint">
          {claimerSummary.map((s, i) => (
            <span key={i}>
              {s}
              {i < claimerSummary.length - 1 ? " ·" : null}
            </span>
          ))}
          {remaining > 0 && claimerSummary.length > 0 ? <span>·</span> : null}
          {remaining > 0 ? (
            <span>
              {remaining} left
            </span>
          ) : (
            <span className="text-ringgit">All claimed</span>
          )}
        </div>
      )}

      {/* Controls — stepper on mobile-first stack, inline on tablet+ */}
      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[11px] uppercase tracking-widest text-foreground-soft sm:hidden">
          How many did you eat?
        </p>
        <div className="flex items-center justify-center gap-3 sm:justify-start">
          <button
            type="button"
            onClick={handleDecrement}
            disabled={disabled || anyPending || myCount === 0}
            aria-label="One fewer"
            className={cn(
              "inline-flex h-11 w-11 items-center justify-center border border-border bg-surface sm:h-9 sm:w-9",
              "transition-colors hover:bg-surface-deep active:bg-surface-deep/80",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              "disabled:cursor-not-allowed disabled:opacity-40",
            )}
          >
            <Minus size={16} aria-hidden />
          </button>
          <span
            tabIndex={disabled ? -1 : 0}
            role="spinbutton"
            aria-valuemin={0}
            aria-valuemax={max}
            aria-valuenow={myCount}
            aria-label={`${group.baseName} count`}
            onKeyDown={onValueKeyDown}
            className={cn(
              "inline-flex h-11 min-w-[2.5rem] items-center justify-center px-2 font-mono text-lg tabular sm:h-9 sm:text-base",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground",
              isMine ? "text-foreground" : "text-foreground-faint",
            )}
          >
            {anyPending ? (
              <Loader2 size={16} className="animate-spin" aria-hidden />
            ) : (
              myCount
            )}
          </span>
          <button
            type="button"
            onClick={handleIncrement}
            disabled={disabled || anyPending || myCount === max}
            aria-label="One more"
            className={cn(
              "inline-flex h-11 w-11 items-center justify-center border border-border bg-surface sm:h-9 sm:w-9",
              "transition-colors hover:bg-surface-deep active:bg-surface-deep/80",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              "disabled:cursor-not-allowed disabled:opacity-40",
            )}
          >
            <Plus size={16} aria-hidden />
          </button>
        </div>
      </div>
    </div>
  );
}
