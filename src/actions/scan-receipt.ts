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
          .describe("The item name as printed. Strip leading dashes/numbers."),
        price_cents: z
          .number()
          .int()
          .nonnegative()
          .describe(
            "Price for THIS line, in cents. e.g. RM 12.50 -> 1250. If a quantity is shown, this is the line total, not the unit price.",
          ),
      }),
    )
    .describe("Each line-item with its price. Do not include subtotals, tax, or total here."),
  total_cents: z
    .number()
    .int()
    .nonnegative()
    .describe(
      "Final amount paid, including tax/service charge, in cents. This should equal the largest 'TOTAL' figure on the receipt.",
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
                "You are a receipt parser for a Malaysian split-bill app. " +
                "Extract the merchant name, every line-item with its price, the final total, and the currency. " +
                "Convert all amounts to integer cents (RM 12.50 -> 1250). " +
                "If a receipt is unreadable, return empty items and a zero total. Do not invent items.",
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
