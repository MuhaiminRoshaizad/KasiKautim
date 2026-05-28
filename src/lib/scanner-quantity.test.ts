import { describe, expect, it } from "vitest";

import { expandQuantityFields, expandQuantityLines } from "./scanner-quantity";

describe("expandQuantityFields", () => {
  it("expands when qty + unit_price match the line total", () => {
    const out = expandQuantityFields([
      {
        name: "SET NASI AYAM GEPUK",
        price_cents: 2600,
        quantity: 2,
        unit_price_cents: 1300,
      },
    ]);
    expect(out).toHaveLength(2);
    expect(out.every((i) => i.name === "SET NASI AYAM GEPUK")).toBe(true);
    expect(out.map((i) => i.price_cents)).toEqual([1300, 1300]);
    // Strip the quantity hints so a second pass wouldn't re-expand.
    expect(out.every((i) => i.quantity === null)).toBe(true);
    expect(out.every((i) => i.unit_price_cents === null)).toBe(true);
  });

  it("expands a 3-unit line like '3 x RM2.00'", () => {
    const out = expandQuantityFields([
      {
        name: "TEH O AIS",
        price_cents: 600,
        quantity: 3,
        unit_price_cents: 200,
      },
    ]);
    expect(out).toHaveLength(3);
    expect(out.every((i) => i.price_cents === 200)).toBe(true);
  });

  it("absorbs the rounding remainder onto the first item", () => {
    // 3 x RM 0.34 = 1.02 but line total prints RM 1.00 (rounded down).
    // Within ±qty slack, so expand and put -2c remainder on the first.
    const out = expandQuantityFields([
      {
        name: "ROUNDED",
        price_cents: 100,
        quantity: 3,
        unit_price_cents: 34,
      },
    ]);
    expect(out).toHaveLength(3);
    expect(out.map((i) => i.price_cents)).toEqual([32, 34, 34]);
    expect(out.reduce((s, i) => s + i.price_cents, 0)).toBe(100);
  });

  it("leaves the item alone when fields are missing", () => {
    const items = [
      { name: "Solo Item", price_cents: 1500, quantity: null, unit_price_cents: null },
    ];
    expect(expandQuantityFields(items)).toEqual(items);
  });

  it("leaves qty=1 alone (not a stack)", () => {
    const items = [
      {
        name: "PAN MEE HITAM",
        price_cents: 1090,
        quantity: 1,
        unit_price_cents: 1090,
      },
    ];
    expect(expandQuantityFields(items)).toEqual(items);
  });

  it("refuses to expand when qty * unit doesn't reconcile with line total", () => {
    // 2 * 1500 = 3000 but line says 2600 — too wide a gap (more than qty cents).
    // Trust the line total, don't expand.
    const items = [
      {
        name: "Mismatch",
        price_cents: 2600,
        quantity: 2,
        unit_price_cents: 1500,
      },
    ];
    expect(expandQuantityFields(items)).toEqual(items);
  });

  it("rejects qty > 99 as probable SKU/year misread", () => {
    const items = [
      {
        name: "Many",
        price_cents: 100000,
        quantity: 100,
        unit_price_cents: 1000,
      },
    ];
    expect(expandQuantityFields(items)).toEqual(items);
  });

  it("preserves order across mixed expanded + non-expanded items", () => {
    const out = expandQuantityFields([
      { name: "Teh Tarik", price_cents: 300, quantity: null, unit_price_cents: null },
      { name: "ROTI", price_cents: 900, quantity: 3, unit_price_cents: 300 },
      { name: "Maggi", price_cents: 700, quantity: null, unit_price_cents: null },
    ]);
    expect(out.map((i) => i.name)).toEqual([
      "Teh Tarik",
      "ROTI",
      "ROTI",
      "ROTI",
      "Maggi",
    ]);
  });
});

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
