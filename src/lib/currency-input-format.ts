/*
 * Pure logic for the shift-from-right currency input pattern (CIMB /
 * Maybank / TNG money entry). User types digits only; the decimal
 * floats two positions from the right. Extracted from the React
 * component so we can unit-test it without mounting.
 *
 * Conventions:
 *   digits = a string of 0-9 only ("32000" represents 320.00).
 *   cents  = the integer value those digits represent (32000 cents).
 *
 * Empty digit string represents an empty input (0 cents, display "").
 */

const MAX_DIGITS = 12; // covers up to RM 9,999,999,999.99 — well past any cap

/** Strip everything but ASCII digits, optionally cap to `max` cents. */
export function sanitizeDigits(raw: string, maxCents?: number): string {
  const onlyDigits = raw.replace(/\D+/g, "").slice(0, MAX_DIGITS);
  if (onlyDigits === "") return "";
  if (maxCents !== undefined && Number(onlyDigits) > maxCents) {
    return String(maxCents);
  }
  return onlyDigits;
}

/** "32000" → "320.00", "5" → "0.05", "" → "" */
export function digitsToDisplay(digits: string): string {
  if (digits === "") return "";
  const padded = digits.padStart(3, "0");
  const whole = padded.slice(0, padded.length - 2);
  const fraction = padded.slice(padded.length - 2);
  // Strip leading zeros from whole part but keep at least one digit
  const trimmedWhole = whole.replace(/^0+(?=\d)/, "");
  return `${trimmedWhole}.${fraction}`;
}

/** "32000" → 32000 cents, "" → 0 */
export function digitsToCents(digits: string): number {
  if (digits === "") return 0;
  return Number(digits);
}

/** 32000 cents → "32000", 0 → "" (treat zero as empty for input UX) */
export function centsToDigits(cents: number): string {
  if (!Number.isFinite(cents) || cents <= 0) return "";
  return String(Math.floor(cents));
}

/** Round-trip helper: cents → display string for prefilled values. */
export function centsToDisplay(cents: number): string {
  return digitsToDisplay(centsToDigits(cents));
}
