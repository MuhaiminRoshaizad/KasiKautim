import { describe, expect, it } from "vitest";

import {
  computeMemberShares,
  unclaimedItems,
  type MemberClaim,
} from "./item-split";
import type { BillItem } from "@/types/db";

const items: BillItem[] = [
  { id: "i1", name: "Nasi Putih", price_cents: 330 },
  { id: "i2", name: "Nasi Putih", price_cents: 330 },
  { id: "i3", name: "Ayam", price_cents: 1400 },
  { id: "i4", name: "Sotong", price_cents: 1200 },
  { id: "i5", name: "Teh Tarik", price_cents: 250 },
];

describe("computeMemberShares", () => {
  it("returns zero for every member when nobody has claimed anything", () => {
    const members: MemberClaim[] = [
      { memberId: "m1", claimedItemIds: [] },
      { memberId: "m2", claimedItemIds: [] },
    ];
    const shares = computeMemberShares(items, members, 0, 0);
    for (const s of shares.values()) {
      expect(s.subtotalCents).toBe(0);
      expect(s.taxShareCents).toBe(0);
      expect(s.totalCents).toBe(0);
    }
  });

  it("assigns full price when one person solo-claims items", () => {
    const members: MemberClaim[] = [
      { memberId: "m1", claimedItemIds: ["i1", "i3"] },
      { memberId: "m2", claimedItemIds: [] },
    ];
    const shares = computeMemberShares(items, members, 0, 0);
    expect(shares.get("m1")!.subtotalCents).toBe(330 + 1400);
    expect(shares.get("m2")!.subtotalCents).toBe(0);
  });

  it("splits a shared item equally; remainder goes to alphabetically-first claimer", () => {
    // 250 cents split by 3 -> 83, 83, 84 (first by sort absorbs +1)
    const members: MemberClaim[] = [
      { memberId: "b", claimedItemIds: ["i5"] },
      { memberId: "a", claimedItemIds: ["i5"] },
      { memberId: "c", claimedItemIds: ["i5"] },
    ];
    const shares = computeMemberShares(items, members, 0, 0);
    expect(shares.get("a")!.subtotalCents).toBe(84);
    expect(shares.get("b")!.subtotalCents).toBe(83);
    expect(shares.get("c")!.subtotalCents).toBe(83);
    expect(
      shares.get("a")!.subtotalCents +
        shares.get("b")!.subtotalCents +
        shares.get("c")!.subtotalCents,
    ).toBe(250);
  });

  it("mixed claims sum per-member subtotals correctly", () => {
    const members: MemberClaim[] = [
      { memberId: "m1", claimedItemIds: ["i1", "i3"] },
      { memberId: "m2", claimedItemIds: ["i2", "i3"] },
      { memberId: "m3", claimedItemIds: ["i4"] },
    ];
    const shares = computeMemberShares(items, members, 0, 0);
    expect(shares.get("m1")!.subtotalCents).toBe(330 + 700);
    expect(shares.get("m2")!.subtotalCents).toBe(330 + 700);
    expect(shares.get("m3")!.subtotalCents).toBe(1200);
  });

  it("allocates tax proportionally to each member's subtotal", () => {
    const fakeItems: BillItem[] = [
      { id: "a", name: "A", price_cents: 1000 },
      { id: "b", name: "B", price_cents: 2000 },
    ];
    const members: MemberClaim[] = [
      { memberId: "m1", claimedItemIds: ["a"] },
      { memberId: "m2", claimedItemIds: ["b"] },
    ];
    const shares = computeMemberShares(fakeItems, members, 180, 0);
    expect(shares.get("m1")!.taxShareCents).toBe(60);
    expect(shares.get("m2")!.taxShareCents).toBe(120);
    expect(shares.get("m1")!.totalCents).toBe(1060);
    expect(shares.get("m2")!.totalCents).toBe(2120);
  });

  it("subtracts discount from tax (net charge) in proportional allocation", () => {
    const fakeItems: BillItem[] = [
      { id: "a", name: "A", price_cents: 1000 },
    ];
    const members: MemberClaim[] = [
      { memberId: "m1", claimedItemIds: ["a"] },
    ];
    const shares = computeMemberShares(fakeItems, members, 100, 50);
    expect(shares.get("m1")!.taxShareCents).toBe(50);
    expect(shares.get("m1")!.totalCents).toBe(1050);
  });

  it("per-item totals reconcile exactly thanks to remainder absorption", () => {
    const fakeItems: BillItem[] = [{ id: "x", name: "x", price_cents: 100 }];
    const members: MemberClaim[] = [
      { memberId: "a", claimedItemIds: ["x"] },
      { memberId: "b", claimedItemIds: ["x"] },
      { memberId: "c", claimedItemIds: ["x"] },
    ];
    const shares = computeMemberShares(fakeItems, members, 0, 0);
    const sum =
      shares.get("a")!.subtotalCents +
      shares.get("b")!.subtotalCents +
      shares.get("c")!.subtotalCents;
    expect(sum).toBe(100);
  });
});

describe("unclaimedItems", () => {
  it("returns items that no member has claimed", () => {
    const members: MemberClaim[] = [
      { memberId: "m1", claimedItemIds: ["i1", "i3"] },
      { memberId: "m2", claimedItemIds: ["i2"] },
    ];
    const unclaimed = unclaimedItems(items, members);
    expect(unclaimed.map((it) => it.id)).toEqual(["i4", "i5"]);
  });

  it("returns empty when every item has at least one claimer", () => {
    const members: MemberClaim[] = [
      { memberId: "m1", claimedItemIds: items.map((it) => it.id) },
    ];
    expect(unclaimedItems(items, members)).toEqual([]);
  });

  it("returns every item when no claims exist", () => {
    expect(unclaimedItems(items, [])).toEqual(items);
  });
});
