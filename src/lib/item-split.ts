import type { BillItem } from "@/types/db";

/*
 * Per-member share computation for item-claim bills.
 *
 * Mirrors the Postgres _recompute_item_shares function in 0004_init.sql so
 * the client can preview totals live without round-tripping the DB on every
 * chip tap. SQL is the source of truth; this lib must match.
 *
 * Per-item math:
 *   share = floor(price / claimer_count)
 *   first claimer (by memberId sort) absorbs the remainder so per-item
 *   totals reconcile exactly.
 *
 * Tax/discount allocation:
 *   net_charge = tax_cents - discount_cents
 *   tax_share  = floor(member_subtotal * net_charge / total_subtotal)
 *   Integer division can lose up to (members - 1) cents total; acceptable
 *   given real receipts round to 5 sen anyway.
 */

export interface MemberClaim {
  memberId: string;
  claimedItemIds: string[];
}

export interface MemberShare {
  memberId: string;
  subtotalCents: number;
  taxShareCents: number;
  totalCents: number;
}

export function computeMemberShares(
  items: readonly BillItem[],
  members: readonly MemberClaim[],
  taxCents: number,
  discountCents: number,
): Map<string, MemberShare> {
  const subtotalByMember = computeSubtotals(items, members);
  const totalSubtotal = sumValues(subtotalByMember);
  const netCharge = taxCents - discountCents;

  const shares = new Map<string, MemberShare>();
  for (const m of members) {
    const subtotalCents = subtotalByMember.get(m.memberId) ?? 0;
    const taxShareCents =
      totalSubtotal > 0
        ? Math.floor((subtotalCents * netCharge) / totalSubtotal)
        : 0;
    shares.set(m.memberId, {
      memberId: m.memberId,
      subtotalCents,
      taxShareCents,
      totalCents: subtotalCents + taxShareCents,
    });
  }
  return shares;
}

function computeSubtotals(
  items: readonly BillItem[],
  members: readonly MemberClaim[],
): Map<string, number> {
  const sortedMemberIds = [...members.map((m) => m.memberId)].sort();
  const claimersByItem = buildClaimersIndex(items, members, sortedMemberIds);
  const subtotalByMember = new Map<string, number>();

  for (const item of items) {
    const claimers = claimersByItem.get(item.id);
    if (!claimers || claimers.length === 0) continue;

    const baseShare = Math.floor(item.price_cents / claimers.length);
    const remainder = item.price_cents - baseShare * claimers.length;

    claimers.forEach((memberId, idx) => {
      const share = idx === 0 ? baseShare + remainder : baseShare;
      subtotalByMember.set(
        memberId,
        (subtotalByMember.get(memberId) ?? 0) + share,
      );
    });
  }
  return subtotalByMember;
}

function buildClaimersIndex(
  items: readonly BillItem[],
  members: readonly MemberClaim[],
  sortedMemberIds: readonly string[],
): Map<string, string[]> {
  const claimsByMember = new Map<string, Set<string>>();
  for (const m of members) {
    claimsByMember.set(m.memberId, new Set(m.claimedItemIds));
  }

  const result = new Map<string, string[]>();
  for (const item of items) {
    const claimers = sortedMemberIds.filter((mid) =>
      claimsByMember.get(mid)?.has(item.id),
    );
    if (claimers.length > 0) result.set(item.id, claimers);
  }
  return result;
}

function sumValues(map: Map<string, number>): number {
  let total = 0;
  for (const v of map.values()) total += v;
  return total;
}

/**
 * Items in the bill that no member has claimed.
 * Drives the "X items unclaimed — organizer needs to take them on" warning.
 */
export function unclaimedItems(
  items: readonly BillItem[],
  members: readonly MemberClaim[],
): BillItem[] {
  const claimed = new Set<string>();
  for (const m of members) {
    for (const id of m.claimedItemIds) claimed.add(id);
  }
  return items.filter((it) => !claimed.has(it.id));
}
