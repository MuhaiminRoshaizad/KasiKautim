import { describe, expect, it } from "vitest";

import {
  centsToDigits,
  centsToDisplay,
  digitsToCents,
  digitsToDisplay,
  sanitizeDigits,
} from "./currency-input-format";

describe("sanitizeDigits", () => {
  it("strips non-digit characters", () => {
    expect(sanitizeDigits("1a2b3")).toBe("123");
    expect(sanitizeDigits("RM 12.50")).toBe("1250");
    expect(sanitizeDigits("1,234.56")).toBe("123456");
  });

  it("returns empty for all-non-digits", () => {
    expect(sanitizeDigits(".")).toBe("");
    expect(sanitizeDigits("abc")).toBe("");
    expect(sanitizeDigits("")).toBe("");
  });

  it("caps at maxCents when provided", () => {
    expect(sanitizeDigits("999", 100)).toBe("100");
    expect(sanitizeDigits("50", 100)).toBe("50");
  });
});

describe("digitsToDisplay", () => {
  it("renders empty for empty input", () => {
    expect(digitsToDisplay("")).toBe("");
  });

  it("handles single digit as 0.0N", () => {
    expect(digitsToDisplay("5")).toBe("0.05");
  });

  it("handles two digits as 0.NN", () => {
    expect(digitsToDisplay("12")).toBe("0.12");
  });

  it("slides the decimal as digits enter", () => {
    expect(digitsToDisplay("320")).toBe("3.20");
    expect(digitsToDisplay("32000")).toBe("320.00");
  });

  it("does not introduce leading zeros on whole part", () => {
    expect(digitsToDisplay("1000")).toBe("10.00");
    expect(digitsToDisplay("100000")).toBe("1000.00");
  });
});

describe("digitsToCents", () => {
  it("converts digit strings to integer cents", () => {
    expect(digitsToCents("")).toBe(0);
    expect(digitsToCents("5")).toBe(5);
    expect(digitsToCents("32000")).toBe(32000);
  });
});

describe("centsToDigits", () => {
  it("round-trips with digitsToCents", () => {
    expect(centsToDigits(0)).toBe("");
    expect(centsToDigits(32000)).toBe("32000");
    expect(centsToDigits(5)).toBe("5");
  });
});

describe("centsToDisplay", () => {
  it("renders prefilled values correctly", () => {
    expect(centsToDisplay(0)).toBe("");
    expect(centsToDisplay(320)).toBe("3.20");
    expect(centsToDisplay(32000)).toBe("320.00");
  });
});
