import { z } from "zod";

import { LIMITS } from "@/lib/constants";

/*
 * Server-action input schemas. Forms reuse the form-shaped variant via RHF;
 * server actions parse the action-shaped variant from FormData. Source of
 * truth is the SQL CHECK constraints in 0001_init.sql.
 */

// Raw money string like "12.34" — kept as string to round-trip safely through
// FormData. Converted to cents server-side via lib/money.ts#toCents.
const moneyString = z
  .string()
  .trim()
  .min(1, "Enter an amount.")
  .regex(/^\d+(\.\d{1,2})?$/, "Use a number like 12.34.");

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
 * Used by the client-side RHF resolver on /dashboard/new.
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
  total: moneyString,
  dueDate: optionalDate,
  membersInput,
});

export type CreateBillForm = z.infer<typeof CreateBillFormSchema>;

/**
 * Used by the createBill server action. Same fields as the form, validated again.
 */
export const CreateBillActionSchema = CreateBillFormSchema;

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
 * Mark-paid action input. Token is bearer credential — never logged.
 */
export const MarkPaidSchema = z.object({
  token: z.string().trim().min(8).max(64),
});

/**
 * Claim-name action input. Server constructs the device hash; client only
 * supplies which slug + member they want.
 */
export const ClaimMemberSchema = z.object({
  slug: z.string().trim().min(4).max(32),
  memberId: z.string().uuid(),
});
