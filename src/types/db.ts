/*
 * TypeScript types matching supabase/migrations/0001_init.sql.
 * Hand-written for D1/D2 to avoid the supabase CLI dependency. Regenerate
 * with `supabase gen types typescript --project-id=<id> > src/types/db.ts`
 * once the CLI is installed (no D2 blocker).
 */

import type { BillStatus } from "@/lib/constants";

export type Iso = string; // ISO 8601 timestamp
export type IsoDate = string; // YYYY-MM-DD

export interface ProfileRow {
  id: string;
  display_name: string | null;
  duitnow_id: string | null;
  created_at: Iso;
  updated_at: Iso;
}

export interface BillRow {
  id: string;
  slug: string;
  organizer_id: string;
  title: string;
  description: string | null;
  total_cents: number;
  currency: string;
  due_date: IsoDate | null;
  status: BillStatus;
  created_at: Iso;
  updated_at: Iso;
}

export type BillInsert = Omit<BillRow, "id" | "created_at" | "updated_at" | "status"> & {
  status?: BillStatus;
};

export interface BillMemberRow {
  id: string;
  bill_id: string;
  name: string;
  amount_owed_cents: number;
  member_token: string;
  paid: boolean;
  paid_at: Iso | null;
  last_viewed_at: Iso | null;
  payment_proof_url: string | null;
  claimed_at: Iso | null;
  claimed_device_hash: string | null;
  created_at: Iso;
}

export type BillMemberInsert = Omit<
  BillMemberRow,
  "id" | "paid" | "paid_at" | "last_viewed_at" | "payment_proof_url" | "claimed_at" | "claimed_device_hash" | "created_at"
>;

export type PaymentEventType = "viewed" | "claimed" | "paid";

export interface PaymentEventRow {
  id: string;
  bill_member_id: string;
  event_type: PaymentEventType;
  occurred_at: Iso;
}

// ----- RPC return shapes (match SECURITY DEFINER functions in 0001_init.sql) -----

export interface PublicBillRpc {
  bill_id: string;
  slug: string;
  title: string;
  description: string | null;
  total_cents: number;
  currency: string;
  due_date: IsoDate | null;
  status: BillStatus;
  organizer_display_name: string | null;
  organizer_duitnow_id: string | null;
  created_at: Iso;
}

export interface PublicBillMemberRpc {
  member_id: string;
  name: string;
  amount_owed_cents: number;
  paid: boolean;
  paid_at: Iso | null;
  claimed: boolean;
}

export interface MemberByTokenRpc {
  member_id: string;
  bill_id: string;
  bill_slug: string;
  name: string;
  amount_owed_cents: number;
  paid: boolean;
  paid_at: Iso | null;
}

// mark_member_paid returns a single timestamptz (the paid_at value).
// No interface needed — the action consumes `data` as `string | null` directly.
