"use server";

import { z } from "zod";

import { logger } from "@/lib/logger";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ToggleItemClaimRpc } from "@/types/db";

export interface ToggleItemClaimState {
  ok: boolean | null;
  message: string;
  claimed?: boolean;
  amountOwedCents?: number;
}

const ToggleSchema = z.object({
  token: z.string().trim().min(8).max(64),
  itemId: z.string().trim().min(1).max(32),
});

/**
 * Recipient toggles an item claim on an item-mode bill. The DB RPC handles:
 *   - auth via member_token
 *   - rejecting if the member already paid (frozen)
 *   - rejecting if the bill isn't in item-mode
 *   - rejecting if the item id isn't in the bill
 *   - re-deriving amount_owed_cents for every non-paid member of the bill
 *
 * Idempotency note: toggle is NOT naturally idempotent across rapid
 * retaps — each call inverts the current state. The optimistic UI in
 * item-picker.tsx flips the chip synchronously on tap to mask the
 * round-trip, which discourages user retap during normal latency.
 * If a true idempotency story is ever needed (e.g. unreliable mobile
 * networks where dupes are common), wrap the RPC in a "set claim
 * state to X" call rather than the current toggle semantics.
 */
export async function toggleItemClaim(
  _prev: ToggleItemClaimState,
  formData: FormData,
): Promise<ToggleItemClaimState> {
  const parsed = ToggleSchema.safeParse({
    token: formData.get("token"),
    itemId: formData.get("itemId"),
  });
  if (!parsed.success) {
    return { ok: false, message: "Invalid claim request." };
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .rpc("toggle_item_claim", {
      p_token: parsed.data.token,
      p_item_id: parsed.data.itemId,
    })
    .maybeSingle<ToggleItemClaimRpc>();

  if (error) {
    logger.error("toggle_item_claim rpc failed", {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    });
    return {
      ok: false,
      message: "Couldn't update your claim. Try again.",
    };
  }

  return {
    ok: true,
    message: data?.claimed ? "Claimed." : "Unclaimed.",
    claimed: data?.claimed ?? false,
    amountOwedCents: data?.amount_owed_cents ?? 0,
  };
}
