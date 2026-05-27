"use server";

import { generateObject, NoObjectGeneratedError } from "ai";
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
            "Price for THIS line in cents. RM 12.50 -> 1250. If a quantity is shown next to the item (e.g. '2 AYAM RM 14.00'), this number is the LINE TOTAL printed on the receipt, not the unit price.",
          ),
      }),
    )
    .describe(
      "Each line-item with its price. Do NOT include subtotals, tax, service charge, rounding, or grand total here.",
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
                "Extract: merchant name, every line-item with its price, the subtotal (if labelled), the tax/service sum (if any), the final total the customer paid, and the currency. " +
                "Convert all amounts to integer cents (RM 12.50 -> 1250). " +
                "Critical: Malaysian receipts often show 'SUBTOTAL' that already includes SST/GST/service charge — never add tax twice. " +
                "If 'CASH' and 'CHANGE' lines are both present, the total customer paid equals Cash - Change. Use that as a sanity check. " +
                "If the receipt is unreadable, return empty items and zero total — do not invent items or amounts.",
            },
            { type: "file", data: bytes, mediaType: file.type },
          ],
        },
      ],
    });

    return {
      ok: true,
      message: "Scanned.",
      receipt: object,
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
