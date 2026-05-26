import { describe, expect, it } from "vitest";

import { formatMYR, splitEqually, sumCents, toCents } from "./money";

describe("toCents", () => {
  it("converts whole ringgit", () => {
    expect(toCents("100")).toBe(10_000);
    expect(toCents("0")).toBe(0);
  });

  it("converts fractional ringgit", () => {
    expect(toCents("12.34")).toBe(1234);
    expect(toCents("0.05")).toBe(5);
    expect(toCents(".5")).toBe(50);
  });

  it("pads short fractions", () => {
    expect(toCents("1.5")).toBe(150);
    expect(toCents("1.")).toBe(100);
  });

  it("truncates beyond two decimals", () => {
    expect(toCents("1.999")).toBe(199);
  });

  it("rejects garbage", () => {
    expect(() => toCents("")).toThrow();
    expect(() => toCents("abc")).toThrow();
    expect(() => toCents("1.2.3")).toThrow();
    expect(() => toCents("-")).toThrow();
  });

  it("handles negatives", () => {
    expect(toCents("-3.50")).toBe(-350);
  });
});

describe("splitEqually", () => {
  it("splits evenly when divisible", () => {
    expect(splitEqually(10_000, 4)).toEqual([2500, 2500, 2500, 2500]);
  });

  it("puts remainder on the last member", () => {
    expect(splitEqually(10_001, 3)).toEqual([3333, 3333, 3335]);
  });

  it("always sums back to the total (no drift)", () => {
    for (const [total, n] of [
      [10_000, 3],
      [10_001, 3],
      [9_999, 7],
      [1, 4],
      [0, 5],
    ] as const) {
      expect(sumCents(splitEqually(total, n))).toBe(total);
    }
  });

  it("single member gets the full amount", () => {
    expect(splitEqually(12_345, 1)).toEqual([12_345]);
  });

  it("rejects invalid input", () => {
    expect(() => splitEqually(-1, 3)).toThrow();
    expect(() => splitEqually(100, 0)).toThrow();
    expect(() => splitEqually(100, -2)).toThrow();
    expect(() => splitEqually(1.5, 2)).toThrow();
  });
});

describe("formatMYR", () => {
  it("formats with RM prefix and 2dp", () => {
    expect(formatMYR(12_345)).toMatch(/RM\s*123\.45/);
  });

  it("handles zero", () => {
    expect(formatMYR(0)).toMatch(/RM\s*0\.00/);
  });
});
