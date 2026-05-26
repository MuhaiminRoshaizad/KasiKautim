import { describe, expect, it } from "vitest";

import { parseMembers } from "./members-parser";

describe("parseMembers", () => {
  it("returns empty for empty input", () => {
    expect(parseMembers("")).toEqual([]);
    expect(parseMembers("   ")).toEqual([]);
  });

  it("parses bare names with null amounts", () => {
    expect(parseMembers("Aisha, Faiz, Wani")).toEqual([
      { name: "Aisha", amountCents: null },
      { name: "Faiz", amountCents: null },
      { name: "Wani", amountCents: null },
    ]);
  });

  it("parses names with trailing amounts", () => {
    expect(parseMembers("Aisha 25, Faiz 30")).toEqual([
      { name: "Aisha", amountCents: 2500 },
      { name: "Faiz", amountCents: 3000 },
    ]);
  });

  it("supports multi-word names", () => {
    expect(parseMembers("Mohd Faiz 25, Siti Aisyah")).toEqual([
      { name: "Mohd Faiz", amountCents: 2500 },
      { name: "Siti Aisyah", amountCents: null },
    ]);
  });

  it("handles newline separators and mixed amounts", () => {
    expect(parseMembers("Aisha 25\nFaiz, Wani 30")).toEqual([
      { name: "Aisha", amountCents: 2500 },
      { name: "Faiz", amountCents: null },
      { name: "Wani", amountCents: 3000 },
    ]);
  });

  it("accepts fractional amounts", () => {
    expect(parseMembers("Aisha 12.50, Faiz 3.5, Wani 0.05")).toEqual([
      { name: "Aisha", amountCents: 1250 },
      { name: "Faiz", amountCents: 350 },
      { name: "Wani", amountCents: 5 },
    ]);
  });

  it("ignores trailing commas and blank entries", () => {
    expect(parseMembers("Aisha,,Faiz,")).toEqual([
      { name: "Aisha", amountCents: null },
      { name: "Faiz", amountCents: null },
    ]);
  });

  it("dedupes case-insensitively, keeping the first occurrence", () => {
    expect(parseMembers("Aisha 25, aisha 99, Faiz")).toEqual([
      { name: "Aisha", amountCents: 2500 },
      { name: "Faiz", amountCents: null },
    ]);
  });

  it("treats a lone number as a name (not an orphan amount)", () => {
    expect(parseMembers("123")).toEqual([{ name: "123", amountCents: null }]);
  });

  it("caps at the member count limit", () => {
    const many = Array.from({ length: 80 }, (_, i) => `P${i}`).join(",");
    expect(parseMembers(many)).toHaveLength(50);
  });
});
