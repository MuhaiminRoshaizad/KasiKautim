"use server";

import { generateObject, NoObjectGeneratedError } from "ai";

import { expandQuantityFields, expandQuantityLines } from "@/lib/scanner-quantity";
import { google } from "@ai-sdk/google";
import { z } from "zod";

import { AI_SCANNER_MODEL } from "@/lib/constants";
import { logger } from "@/lib/logger";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const ACCEPTED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);
const MAX_BYTES = 8 * 1024 * 1024; // 8 MB

const ReceiptSchema = z.object({
  merchant_name: z
    .string()
    .nullable()
    .describe(
      "The restaurant, shop, or merchant name printed at the top of the receipt. Null if not visible or unclear.",
    ),
  items: z
    .array(
      z.object({
        name: z
          .string()
          .describe(
            "The item name as printed. Strip leading dashes, quantity markers, and SKU codes.",
          ),
        price_cents: z
          .number()
          .int()
          .nonnegative()
          .describe(
            "LINE TOTAL for this item in cents (RM 12.50 -> 1250). The printed amount in the rightmost / total column, NOT the unit price. For a 'SET NASI AYAM GEPUK RM26.00 / 2 x RM13.00' line, price_cents is 2600 (the line total). For a column-aligned 'NASI GORENG PATTAYA  8.00  3  24.00' line, price_cents is 2400 (the rightmost total column).",
          ),
        quantity: z
          .number()
          .int()
          .min(1)
          .max(99)
          .nullable()
          .describe(
            "Quantity ordered. Two common Malaysian POS formats; populate this whenever you can see a quantity for the item: (A) sub-line format: '2 x RM13.00' printed UNDER or BESIDE the item — set quantity to 2. (B) column format: receipt has columns like 'Item | Price | Qty | Total' where the same line reads 'NASI GORENG PATTAYA  8.00  3  24.00' — set quantity to 3 (the middle qty column). Null if no quantity is shown anywhere for the item.",
          ),
        unit_price_cents: z
          .number()
          .int()
          .nonnegative()
          .nullable()
          .describe(
            "Per-unit price in cents. (A) Sub-line format '2 x RM13.00' -> set 1300. (B) Column format 'NASI GORENG PATTAYA  8.00  3  24.00' -> set 800 (the unit-price column, NOT the line total). Null when quantity is null. When set, quantity * unit_price_cents should approximately equal price_cents (within a few cents for rounding).",
          ),
      }),
    )
    .describe(
      "Each line-item with its price. Do NOT include subtotals, tax, service charge, rounding, or grand total here. When the receipt exposes both a unit price AND a quantity for an item — in EITHER the sub-line format ('2 x RM13.00') OR the column format ('Item | Unit | Qty | Total') — populate quantity AND unit_price_cents so the app can split per-unit. price_cents always carries the LINE TOTAL regardless of format.",
    ),
  subtotal_cents: z
    .number()
    .int()
    .nonnegative()
    .nullable()
    .describe(
      "Pre-tax/pre-service-charge subtotal in cents, if a 'Subtotal' or 'Sub Total' line is explicitly shown. Null if not labelled as such.",
    ),
  tax_cents: z
    .number()
    .int()
    .nonnegative()
    .nullable()
    .describe(
      "Sum of all tax + service-charge lines in cents (SST 6%, GST 6%, Service Tax, Service Charge 10%, Rounding). Null if none shown.",
    ),
  discount_cents: z
    .number()
    .int()
    .nonnegative()
    .nullable()
    .describe(
      "Sum of all discount/promo/voucher lines in cents, expressed as a POSITIVE number. " +
        "Look for lines like 'DISCOUNT', 'PROMO', 'VOUCHER', 'OFFER', 'COUPON', 'REBATE', " +
        "'BOGO', 'LOYALTY', or a leading minus sign before an amount in the totals area. " +
        "Null if none shown.",
    ),
  total_cents: z
    .number()
    .int()
    .nonnegative()
    .describe(
      "FINAL amount the customer paid, in cents. Use this priority: " +
        "(1) the line literally labelled 'NET TOTAL', 'GRAND TOTAL', or 'TOTAL DUE'; " +
        "(2) if 'CASH' and 'CHANGE' are both visible, compute Cash - Change; " +
        "(3) the line labelled 'TOTAL' (note: on Malaysian receipts a 'TOTAL' line is usually already tax-inclusive — do NOT add SST/GST/service on top of it); " +
        "(4) only as a last resort, sum of items + tax. " +
        "Never double-count tax. The amount the customer actually handed over is the answer.",
    ),
  currency: z
    .string()
    .min(3)
    .max(3)
    .describe(
      "ISO 4217 currency code (e.g. MYR, USD, SGD). Default MYR if a ringgit/RM symbol is present.",
    ),
});

export type ScannedReceipt = z.infer<typeof ReceiptSchema>;

export interface ScanReceiptState {
  ok: boolean | null;
  message: string;
  receipt?: ScannedReceipt;
}

export async function scanReceipt(
  _prev: ScanReceiptState,
  formData: FormData,
): Promise<ScanReceiptState> {
  // Auth-gate: this hits a billed external API; never expose to anon.
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, message: "Sign in to use the scanner." };
  }

  // Per-user daily quota — Gemini's free tier cap (1500/day) is project-
  // wide, so without this any one user can DoS the scanner for everyone.
  // The RPC atomically rolls the day forward + increments, returning
  // false past the daily cap.
  const { data: withinQuota, error: quotaErr } = await supabase.rpc(
    "consume_scan_quota",
    { p_user_id: user.id },
  );
  if (quotaErr) {
    logger.error("consume_scan_quota rpc failed", { code: quotaErr.code });
    return {
      ok: false,
      message: "Scanner unavailable right now. Fill in items manually.",
    };
  }
  if (withinQuota === false) {
    return {
      ok: false,
      message: "Daily scan limit reached. Fill in items manually for today.",
    };
  }

  const file = formData.get("image");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, message: "Pick a receipt photo first." };
  }
  if (!ACCEPTED_TYPES.has(file.type)) {
    return {
      ok: false,
      message: "Use a JPG, PNG, WEBP, or HEIC image.",
    };
  }
  if (file.size > MAX_BYTES) {
    return {
      ok: false,
      message: "Image is too big — keep it under 8 MB.",
    };
  }

  if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    return {
      ok: false,
      message: "Scanner not configured. Fill in items manually for now.",
    };
  }

  const bytes = new Uint8Array(await file.arrayBuffer());

  try {
    const { object } = await generateObject({
      model: google(AI_SCANNER_MODEL),
      schema: ReceiptSchema,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text:
                "You are a precise receipt parser for a Malaysian split-bill app. " +
                "Extract: merchant name, every line-item with its price, the subtotal (if labelled), the tax/service sum (if any), any discount/promo/voucher amounts (as positive cents), the final total the customer paid, and the currency. " +
                "Convert all amounts to integer cents (RM 12.50 -> 1250). " +
                "Critical: Malaysian receipts often show 'SUBTOTAL' that already includes SST/GST/service charge — never add tax twice. " +
                "If 'CASH' and 'CHANGE' lines are both present, the total customer paid equals Cash - Change. Use that as a sanity check. " +
                "Item names can be in English, Bahasa Malaysia, Chinese, or Tamil — preserve the original script. " +
                "Stacked quantities come in TWO common Malaysian POS formats — handle BOTH: " +
                "(A) Sub-line format: '2 x RM13.00' printed UNDER or BESIDE the item (e.g. '2 x RM13.00' below 'SET NASI AYAM GEPUK RM26.00'). " +
                "(B) Column format: the receipt header reads 'Item Price | Qty | Total(RM)' and the line spans columns like 'NASI GORENG PATTAYA  8.00  3  24.00' (unit RM 8.00, qty 3, line total RM 24.00). " +
                "In BOTH cases set quantity=N and unit_price_cents=<unit in cents>, keeping price_cents as the LINE TOTAL. Verify quantity * unit_price_cents ≈ price_cents (within a few cents for rounding). If only the line total is shown with no qty/unit breakdown, leave quantity and unit_price_cents null. " +
                "If the receipt is unreadable, return empty items and zero total — do not invent items or amounts.",
            },
            { type: "file", data: bytes, mediaType: file.type },
          ],
        },
      ],
    });

    // Gemini's prompt instructs it to return empty items + zero total
    // when the image is unreadable / not a receipt (rather than inventing
    // values). Catch that here so the UI doesn't show "✓ receipt math
    // reconciles" for what is actually "we saw nothing".
    //
    // Two-stage expansion: first use the explicit quantity + unit_price
    // fields Gemini extracts from "2 x RM13.00" sub-lines (Malaysian
    // POS standard); then fall back to the legacy name-prefix parser
    // for "10 NASI LEMAK" single-line formats. Both produce per-unit
    // items so groupItemsByName can render a single grouped stepper row.
    const items = expandQuantityLines(expandQuantityFields(object.items));
    const looksLikeReceipt =
      items.length > 0 ||
      object.total_cents > 0 ||
      (object.merchant_name?.trim()?.length ?? 0) > 0;

    if (!looksLikeReceipt) {
      return {
        ok: false,
        message:
          "That doesn't look like a receipt. Try a clearer photo, or fill in items manually below.",
      };
    }

    return {
      ok: true,
      message: "Scanned.",
      receipt: { ...object, items },
    };
  } catch (err) {
    if (NoObjectGeneratedError.isInstance(err)) {
      logger.warn("scan-receipt: model returned no object", { cause: err.cause });
      return {
        ok: false,
        message: "Couldn't read that receipt. Try a clearer photo.",
      };
    }
    logger.error("scan-receipt failed", {
      message: err instanceof Error ? err.message : "unknown",
    });
    return {
      ok: false,
      message: "Scanner hit an error. Try again or fill in manually.",
    };
  }
}

