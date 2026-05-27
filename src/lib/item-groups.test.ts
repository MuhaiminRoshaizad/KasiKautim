import { describe, expect, test } from "vitest";

import { groupItemsByName } from "./item-groups";
import type { BillItem } from "@/types/db";
import type { MemberClaim } from "@/lib/item-split";

const item = (id: string, name: string, price_cents: number): BillItem => ({
  id,
  name,
  price_cents,
});

describe("groupItemsByName", () => {
  test("returns an empty array for empty input", () => {
    expect(groupItemsByName([], [])).toEqual([]);
  });

  test("returns a single-unit group for a one-off item", () => {
    const items = [item("a", "Seafood Platter", 4500)];
    const groups = groupItemsByName(items, []);
    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({
      baseName: "Seafood Platter",
      unitPriceCents: 4500,
      units: [{ id: "a", claimedByMemberIds: [] }],
    });
  });

  test("groups duplicates with identical name + price into one group", () => {
    const items = [
      item("a", "Teh Tarik", 300),
      item("b", "Teh Tarik", 300),
      item("c", "Teh Tarik", 300),
    ];
    const groups = groupItemsByName(items, []);
    expect(groups).toHaveLength(1);
    expect(groups[0]!.units.map((u) => u.id)).toEqual(["a", "b", "c"]);
  });

  test("keeps same-name items separate when prices differ (small vs large)", () => {
    const items = [
      item("a", "Coffee", 500),
      item("b", "Coffee", 700),
      item("c", "Coffee", 500),
    ];
    const groups = groupItemsByName(items, []);
    expect(groups).toHaveLength(2);
    expect(groups[0]!.unitPriceCents).toBe(500);
    expect(groups[0]!.units.map((u) => u.id)).toEqual(["a", "c"]);
    expect(groups[1]!.unitPriceCents).toBe(700);
    expect(groups[1]!.units.map((u) => u.id)).toEqual(["b"]);
  });

  test("attaches claim info per-unit so the UI can render 'Aisha 1 · Faiz 1'", () => {
    const items = [
      item("a", "Roti Canai", 200),
      item("b", "Roti Canai", 200),
      item("c", "Roti Canai", 200),
    ];
    const members: MemberClaim[] = [
      { memberId: "aisha", claimedItemIds: ["a"] },
      { memberId: "faiz", claimedItemIds: ["b"] },
      // "c" left unclaimed
    ];
    const [group] = groupItemsByName(items, members);
    expect(group!.units).toEqual([
      { id: "a", claimedByMemberIds: ["aisha"] },
      { id: "b", claimedByMemberIds: ["faiz"] },
      { id: "c", claimedByMemberIds: [] },
    ]);
  });

  test("preserves first-occurrence order of groups (matches receipt order)", () => {
    const items = [
      item("a", "Nasi Lemak", 850),
      item("b", "Teh Tarik", 300),
      item("c", "Nasi Lemak", 850),
    ];
    const groups = groupItemsByName(items, []);
    expect(groups.map((g) => g.baseName)).toEqual(["Nasi Lemak", "Teh Tarik"]);
    // First group (Nasi Lemak) has both copies even though they're not adjacent
    expect(groups[0]!.units).toHaveLength(2);
    expect(groups[1]!.units).toHaveLength(1);
  });

  test("normalises name differences in whitespace + case for grouping", () => {
    const items = [
      item("a", "Teh Tarik", 300),
      item("b", "TEH TARIK", 300),
      item("c", "  teh  tarik  ", 300),
    ];
    const groups = groupItemsByName(items, []);
    expect(groups).toHaveLength(1);
    expect(groups[0]!.units).toHaveLength(3);
    // baseName uses the first-occurrence's casing for display
    expect(groups[0]!.baseName).toBe("Teh Tarik");
  });

  test("records the same member on multiple units when they claim several copies", () => {
    const items = [
      item("a", "Nasi Lemak", 850),
      item("b", "Nasi Lemak", 850),
      item("c", "Nasi Lemak", 850),
    ];
    const members: MemberClaim[] = [
      { memberId: "aisha", claimedItemIds: ["a", "b"] },
      { memberId: "faiz", claimedItemIds: ["c"] },
    ];
    const [group] = groupItemsByName(items, members);
    expect(group!.units.flatMap((u) => u.claimedByMemberIds)).toEqual([
      "aisha",
      "aisha",
      "faiz",
    ]);
  });
});
