/*
 * Expand quantity-stacked receipt lines into N copies at unit price.
 *
 * Why: KasiKautim's claim model is one-line-equals-one-claimable-chip.
 * If 10 people order nasi lemak but the receipt prints "10 NASI LEMAK
 * 85.00" as one consolidated line, the chip can't represent the case
 * where 8 people each eat 1 and 2 people share 1 — math would split
 * the lump RM 85 among everyone who taps, instead of 8 × RM 8.50 +
 * (2 × RM 4.25).
 *
 * Expanding the line to 10 separate "Nasi Lemak" items at RM 8.50 each
 * makes the claim model work naturally: sole-eaters tap their own
 * chips, sharers tap a chip together. Math reconciles. The display
 * layer (groupItemsByName + ItemClaimPicker) then collapses the 10
 * back into a single "Nasi Lemak ×10" stepper row.
 *
 * Two expansion paths, in order:
 *
 *   1. expandQuantityFields — uses Gemini-extracted `quantity` +
 *      `unit_price_cents` fields. Triggers for the Malaysian POS
 *      sub-line format like:
 *        SET NASI AYAM GEPUK    RM26.00
 *        2 x RM13.00
 *      where qty + unit price are printed under the item.
 *
 *   2. expandQuantityLines — fallback that parses qty out of the
 *      item NAME for the older "10 NASI LEMAK 85.00" single-line
 *      format. Runs after #1 since field-based is more reliable.
 *
 * Patterns matched by name parser (case-insensitive):
 *   "10 NASI LEMAK"      → qty 10
 *   "10x NASI LEMAK"     → qty 10
 *   "10 x NASI LEMAK"    → qty 10
 *   "(3) KOPI"           → qty 3
 *
 * Safety bars (both expanders):
 *   - qty in [2, 99] — too low isn't a stack (just a name like
 *     "1 SCOOP ICE CREAM" stays as one), too high is probably an SKU
 *     misread or a year.
 *   - line total must reconcile against qty × unit (within ±qty cents
 *     to allow for rounding) else trust the line total over the qty
 *     hint and leave the item alone.
 *   - Remainder cents go on the first expanded item so the sum stays
 *     exact (e.g. RM 25.01 / 3 → 8.34, 8.33, 8.33 = 25.00 floor + 1c
 *     onto the first).
 */

const QUANTITY_PATTERNS = [
  /^(\d{1,2})\s*[x×]\s+(.+)$/i, // "10x AYAM" / "10 x AYAM"
  /^(\d{1,2})\s+(.+)$/, // "10 AYAM" (must come AFTER the x-variant)
  /^\((\d{1,2})\)\s*(.+)$/, // "(10) AYAM"
];

/**
 * Field-based expansion. When Gemini captured a `quantity` + `unit_price_cents`
 * from a "2 x RM13.00" sub-line, split the line into `quantity` units at the
 * unit price each. If the fields are missing, invalid, or the math doesn't
 * reconcile against the line total, leave the item alone — the name-based
 * parser downstream is the backstop.
 */
export function expandQuantityFields<
  T extends {
    name: string;
    price_cents: number;
    quantity?: number | null;
    unit_price_cents?: number | null;
  },
>(items: readonly T[]): T[] {
  const out: T[] = [];
  for (const item of items) {
    const qty = item.quantity ?? 0;
    const unit = item.unit_price_cents ?? 0;
    const reconciles =
      qty >= 2 &&
      qty <= 99 &&
      unit > 0 &&
      // Allow ±qty cents of slack so single-cent rounding on the receipt
      // doesn't kill the expansion. Anything wider and we trust the line
      // total over the qty hint and don't expand.
      Math.abs(qty * unit - item.price_cents) <= qty;

    if (!reconciles) {
      out.push(item);
      continue;
    }

    // Allocate any rounding remainder onto the first item so the sum of
    // expanded prices exactly equals the printed line total.
    const baseTotal = unit * qty;
    const remainder = item.price_cents - baseTotal;
    for (let i = 0; i < qty; i++) {
      out.push({
        ...item,
        price_cents: i === 0 ? unit + remainder : unit,
        // Strip the quantity hint from expanded children so a second
        // expansion pass wouldn't try to re-expand them.
        quantity: null,
        unit_price_cents: null,
      });
    }
  }
  return out;
}

export function expandQuantityLines<
  T extends { name: string; price_cents: number },
>(items: readonly T[]): T[] {
  const out: T[] = [];
  for (const item of items) {
    let matched = false;
    for (const pattern of QUANTITY_PATTERNS) {
      const m = item.name.match(pattern);
      if (!m) continue;
      const qty = Number.parseInt(m[1]!, 10);
      const baseName = m[2]!.trim();
      if (qty < 2 || qty > 99) break;
      if (item.price_cents < qty) break;
      const unit = Math.floor(item.price_cents / qty);
      const remainder = item.price_cents - unit * qty;
      for (let i = 0; i < qty; i++) {
        out.push({
          ...item,
          name: baseName,
          price_cents: i === 0 ? unit + remainder : unit,
        });
      }
      matched = true;
      break;
    }
    if (!matched) out.push(item);
  }
  return out;
}
