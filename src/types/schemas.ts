import { z } from "zod";

import { LIMITS } from "@/lib/constants";

/*
 * Server-action input schemas. Forms reuse the form-shaped variant via RHF;
 * server actions parse the action-shaped variant from FormData. Source of
 * truth is the SQL CHECK constraints in 0001_init.sql.
 */

const optionalDate = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a date like 2026-06-30.")
  .optional()
  .or(z.literal(""));

// The raw textarea content of the "Add the squad" input. Parsed in
// lib/members-parser.ts. Schema only validates non-emptiness here.
const membersInput = z
  .string()
  .trim()
  .min(1, "Add at least one person.");

/**
 * One line-item on an item-mode bill. id is a nanoid minted by the client
 * when items come from the scanner; price_cents matches the DB JSONB shape.
 */
export const BillItemSchema = z.object({
  id: z.string().min(1).max(32),
  name: z.string().trim().min(1).max(80),
  price_cents: z.number().int().nonnegative(),
});
export type BillItemInput = z.infer<typeof BillItemSchema>;

const SplitModeSchema = z.enum(["equal", "item"]);
export type SplitModeInput = z.infer<typeof SplitModeSchema>;

/**
 * Used by the client-side RHF resolver on /dashboard/new.
 *
 * splitMode === 'equal':  `total` is required and split across members
 *                         (members can have custom amounts via membersInput).
 * splitMode === 'item':   `items` is required; `total` is computed as
 *                         sum(items) + tax - discount. `membersInput` is
 *                         names-only; per-person amounts come from claims.
 */
export const CreateBillFormSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Give the bill a title.")
    .max(LIMITS.billTitle, `Keep it under ${LIMITS.billTitle} characters.`),
  description: z
    .string()
    .trim()
    .max(LIMITS.billDescription, `Keep it under ${LIMITS.billDescription} characters.`)
    .optional()
    .or(z.literal("")),
  total: z.string().optional().or(z.literal("")),
  dueDate: optionalDate,
  membersInput,
  splitMode: SplitModeSchema.default("equal"),
  items: z.array(BillItemSchema).optional().default([]),
  taxCents: z.number().int().nonnegative().optional().default(0),
  discountCents: z.number().int().nonnegative().optional().default(0),
});

// Use z.input so optional+defaulted fields stay optional for RHF defaultValues.
// z.output would mark them required (because defaults are applied on parse).
export type CreateBillForm = z.input<typeof CreateBillFormSchema>;

/**
 * Server-action schema with cross-field validation. Equal-mode needs a
 * non-empty total string; item-mode needs at least one item.
 */
export const CreateBillActionSchema = CreateBillFormSchema.superRefine(
  (data, ctx) => {
    if (data.splitMode === "equal") {
      if (!data.total || !data.total.trim()) {
        ctx.addIssue({
          code: "custom",
          path: ["total"],
          message: "Enter a total amount.",
        });
      } else if (!/^\d+(\.\d{1,2})?$/.test(data.total.trim())) {
        ctx.addIssue({
          code: "custom",
          path: ["total"],
          message: "Use a number like 12.34.",
        });
      }
    } else {
      if (!data.items || data.items.length === 0) {
        ctx.addIssue({
          code: "custom",
          path: ["items"],
          message: "Item-mode bills need at least one item.",
        });
      }
    }
  },
);

/**
 * Item-mode bills don't validate moneyString anymore (total is computed).
 * Equal-mode bills still must validate `total`. Below is the shape consumed
 * by the action — kept separate from form schema so the legacy moneyString
 * pattern doesn't trip on empty total in item-mode.
 */

/**
 * Parsed member line — output of lib/members-parser.ts.
 */
export const ParsedMemberSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1)
    .max(LIMITS.memberName),
  amountCents: z.number().int().nonnegative().nullable(),
});
export type ParsedMember = z.infer<typeof ParsedMemberSchema>;

/**
 * Payment methods the recipient can pick when marking paid.
 * Mirrors the CHECK constraint in DB migration 0005 — keep in sync.
 */
export const PaymentMethodSchema = z.enum([
  "cash",
  "online_transfer",
  "duitnow_qr",
  "ewallet",
  "other",
]);
export type PaymentMethod = z.infer<typeof PaymentMethodSchema>;

/**
 * Mark-paid action input. Token is bearer credential — never logged.
 * method/note/proofPath are all optional — recipient can skip the audit
 * fields entirely and still mark themselves paid (vibes mode).
 */
export const MarkPaidSchema = z.object({
  token: z.string().trim().min(8).max(64),
  method: PaymentMethodSchema.optional().or(z.literal("")),
  note: z
    .string()
    .trim()
    .max(120, "Keep the note under 120 characters.")
    .optional()
    .or(z.literal("")),
  proofPath: z
    .string()
    .trim()
    .max(500)
    .optional()
    .or(z.literal("")),
});

/**
 * Claim-name action input. Server constructs the device hash; client only
 * supplies which slug + member they want.
 */
export const ClaimMemberSchema = z.object({
  slug: z.string().trim().min(4).max(32),
  memberId: z.string().uuid(),
});

/**
 * Unclaim action — recipient who picked the wrong name escapes back to
 * the claim picker. Device hash comes from the cookie server-side; client
 * sends the token (which identifies the member they're currently holding).
 */
export const UnclaimMemberSchema = z.object({
  token: z.string().trim().min(8).max(64),
  slug: z.string().trim().min(4).max(32),
});

/**
 * Profile update — both fields optional, both clearable.
 * duitnow_id is loose-validated (5-50 chars, alphanumeric + a few separators)
 * to accept phone numbers (+60123456789), DuitNow IDs, business IDs, etc.
 */
export const ProfileUpdateSchema = z.object({
  displayName: z
    .string()
    .trim()
    .max(LIMITS.memberName, `Keep it under ${LIMITS.memberName} characters.`)
    .optional()
    .or(z.literal("")),
  duitnowId: z
    .string()
    .trim()
    .max(50, "Keep it under 50 characters.")
    .regex(/^[A-Za-z0-9+\-_.@ ]*$/, "Use letters, numbers, +, -, _, ., @, or spaces.")
    .optional()
    .or(z.literal("")),
});

export type ProfileUpdateForm = z.infer<typeof ProfileUpdateSchema>;
