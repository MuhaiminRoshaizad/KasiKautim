/*
 * Expand quantity-prefixed receipt lines into N copies at unit price.
 *
 * Why: JomSplit's claim model is one-line-equals-one-claimable-chip.
 * If 10 people order nasi lemak but the receipt prints "10 NASI LEMAK
 * 85.00" as one consolidated line, the chip can't represent the case
 * where 8 people each eat 1 and 2 people share 1 — math would split
 * the lump RM 85 among everyone who taps, instead of 8 × RM 8.50 +
 * (2 × RM 4.25).
 *
 * Expanding the line to 10 separate "Nasi Lemak" items at RM 8.50 each
 * makes the claim model work naturally: sole-eaters tap their own
 * chips, sharers tap a chip together. Math reconciles.
 *
 * Patterns matched (case-insensitive):
 *   "10 NASI LEMAK"      → qty 10
 *   "10x NASI LEMAK"     → qty 10
 *   "10 x NASI LEMAK"    → qty 10
 *   "(3) KOPI"           → qty 3
 *
 * Safety bars:
 *   - qty in [2, 99] — too low isn't a quantity (just a name like
 *     "1 SCOOP ICE CREAM" stays as one), too high is probably an SKU
 *     misread or a year.
 *   - line total must be ≥ qty (one-cent floor per unit) — else assume
 *     the leading number isn't a quantity.
 *   - Remainder cents go on the first expanded item so the sum stays
 *     exact (e.g. RM 25.01 / 3 → 8.34, 8.33, 8.33 = 25.00 floor + 1c
 *     onto the first).
 */

const QUANTITY_PATTERNS = [
  /^(\d{1,2})\s*[x×]\s+(.+)$/i, // "10x AYAM" / "10 x AYAM"
  /^(\d{1,2})\s+(.+)$/, // "10 AYAM" (must come AFTER the x-variant)
  /^\((\d{1,2})\)\s*(.+)$/, // "(10) AYAM"
];

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
