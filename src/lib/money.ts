import { DEFAULT_CURRENCY } from "./constants";

/**
 * Money lives as integer cents everywhere. parseFloat is banned for money.
 */

const MYR_FORMATTER = new Intl.NumberFormat("en-MY", {
  style: "currency",
  currency: "MYR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const MYR_FORMATTER_PLAIN = new Intl.NumberFormat("en-MY", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function toCents(amount: number | string): number {
  const asString = typeof amount === "number" ? amount.toString() : amount.trim();
  if (asString === "" || asString === "-" || asString === ".") {
    throw new Error("Invalid amount");
  }
  const negative = asString.startsWith("-");
  const unsigned = negative ? asString.slice(1) : asString;
  const parts = unsigned.split(".");
  if (parts.length > 2) throw new Error("Invalid amount");
  const [whole, fraction = ""] = parts;
  const wholeOk = whole === "" || /^\d+$/.test(whole);
  const fractionOk = fraction === "" || /^\d+$/.test(fraction);
  if (!wholeOk || !fractionOk || (whole === "" && fraction === "")) {
    throw new Error("Invalid amount");
  }
  const paddedFraction = (fraction + "00").slice(0, 2);
  const cents = Number(whole || "0") * 100 + Number(paddedFraction || 0);
  if (!Number.isSafeInteger(cents)) throw new Error("Amount too large");
  return negative ? -cents : cents;
}

export function fromCents(cents: number): number {
  return cents / 100;
}

export function formatMYR(cents: number): string {
  return MYR_FORMATTER.format(cents / 100);
}

export function formatAmount(cents: number): string {
  return MYR_FORMATTER_PLAIN.format(cents / 100);
}

export function formatCurrency(cents: number, currency: string = DEFAULT_CURRENCY): string {
  if (currency === "MYR") return formatMYR(cents);
  return new Intl.NumberFormat("en", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(cents / 100);
}

/**
 * Split `totalCents` evenly across `count` members.
 * Each member gets floor(total / count); the leftover remainder is added to the last
 * member so the sum exactly equals the total (no rounding drift).
 */
export function splitEqually(totalCents: number, count: number): number[] {
  if (!Number.isInteger(totalCents) || totalCents < 0) {
    throw new Error("totalCents must be a non-negative integer");
  }
  if (!Number.isInteger(count) || count < 1) {
    throw new Error("count must be a positive integer");
  }
  const base = Math.floor(totalCents / count);
  const remainder = totalCents - base * count;
  const shares = new Array<number>(count).fill(base);
  if (remainder > 0) shares[count - 1] = base + remainder;
  return shares;
}

export function sumCents(values: readonly number[]): number {
  return values.reduce((acc, v) => acc + v, 0);
}
