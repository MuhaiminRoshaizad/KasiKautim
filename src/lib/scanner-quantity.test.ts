import { describe, expect, it } from "vitest";

import { expandQuantityLines } from "./scanner-quantity";

describe("expandQuantityLines", () => {
  it("expands a qty-prefixed line into N items at unit price", () => {
    const out = expandQuantityLines([
      { name: "10 NASI LEMAK", price_cents: 8500 },
    ]);
    expect(out).toHaveLength(10);
    expect(out.every((i) => i.name === "NASI LEMAK")).toBe(true);
    expect(out.every((i) => i.price_cents === 850)).toBe(true);
  });

  it("handles the '10x AYAM' form", () => {
    const out = expandQuantityLines([
      { name: "10x AYAM", price_cents: 14000 },
    ]);
    expect(out).toHaveLength(10);
    expect(out[0]!.name).toBe("AYAM");
  });

  it("handles spaced '10 x AYAM'", () => {
    const out = expandQuantityLines([
      { name: "10 x AYAM", price_cents: 14000 },
    ]);
    expect(out).toHaveLength(10);
  });

  it("handles parenthesized '(3) KOPI'", () => {
    const out = expandQuantityLines([
      { name: "(3) KOPI", price_cents: 600 },
    ]);
    expect(out).toHaveLength(3);
    expect(out[0]!.name).toBe("KOPI");
    expect(out[0]!.price_cents).toBe(200);
  });

  it("puts the remainder on the first item", () => {
    const out = expandQuantityLines([
      { name: "3 NASI", price_cents: 2501 },
    ]);
    expect(out.map((i) => i.price_cents)).toEqual([835, 833, 833]);
    expect(out.reduce((s, i) => s + i.price_cents, 0)).toBe(2501);
  });

  it("leaves single-quantity lines alone", () => {
    const items = [{ name: "Nasi Lemak", price_cents: 850 }];
    expect(expandQuantityLines(items)).toEqual(items);
  });

  it("leaves qty=1 lines alone (not a quantity, just a name)", () => {
    const items = [{ name: "1 SCOOP ICE CREAM", price_cents: 800 }];
    expect(expandQuantityLines(items)).toEqual(items);
  });

  it("rejects qty > 99 as probably SKU/year misread", () => {
    const items = [{ name: "2024 SPECIAL", price_cents: 1500 }];
    expect(expandQuantityLines(items)).toEqual(items);
  });

  it("rejects qty when line total < qty (cents floor)", () => {
    // "10 ITEM" at RM 0.05 — clearly not 10 sub-cent items
    const items = [{ name: "10 ITEM", price_cents: 5 }];
    expect(expandQuantityLines(items)).toEqual(items);
  });

  it("preserves order across mixed expanded + non-expanded items", () => {
    const out = expandQuantityLines([
      { name: "Teh Tarik", price_cents: 300 },
      { name: "3 ROTI", price_cents: 900 },
      { name: "Maggi Goreng", price_cents: 700 },
    ]);
    expect(out.map((i) => i.name)).toEqual([
      "Teh Tarik",
      "ROTI",
      "ROTI",
      "ROTI",
      "Maggi Goreng",
    ]);
  });
});
