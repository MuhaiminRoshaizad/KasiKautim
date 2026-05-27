"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  CLAIM_COOKIE_MAX_AGE_SECONDS,
  CLAIM_COOKIE_NAME,
} from "@/lib/constants";
import { logger } from "@/lib/logger";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ClaimMemberSchema, MarkPaidSchema } from "@/types/schemas";

export interface ClaimMemberState {
  ok: boolean | null;
  message: string;
}

export interface MarkPaidState {
  ok: boolean | null;
  message: string;
  paidAt: string | null;
}

/**
 * Mint or read the device-hash cookie. The value is opaque to the user;
 * the RPC stores it as the claimed_device_hash so subsequent visits from
 * the same device re-resolve to the same member.
 */
async function getOrMintDeviceHash(): Promise<string> {
  const jar = await cookies();
  const existing = jar.get(CLAIM_COOKIE_NAME)?.value;
  if (existing && existing.length >= 16) return existing;

  const minted = crypto.randomUUID().replace(/-/g, "");
  jar.set(CLAIM_COOKIE_NAME, minted, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: CLAIM_COOKIE_MAX_AGE_SECONDS,
    path: "/",
  });
  return minted;
}

/**
 * Public — anyone with the bill slug can attempt to claim a member slot.
 * The Postgres claim_member RPC is atomic: race losers get null.
 * On success, the action redirects to /b/[slug]?m=<token>.
 */
export async function claimMember(
  _prev: ClaimMemberState,
  formData: FormData,
): Promise<ClaimMemberState> {
  const parsed = ClaimMemberSchema.safeParse({
    slug: formData.get("slug"),
    memberId: formData.get("memberId"),
  });
  if (!parsed.success) {
    return { ok: false, message: "Invalid claim request." };
  }

  const { slug, memberId } = parsed.data;
  const deviceHash = await getOrMintDeviceHash();

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("claim_member", {
    p_slug: slug,
    p_member_id: memberId,
    p_device_hash: deviceHash,
  });

  if (error) {
    logger.error("claim_member rpc failed", {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    });
    return { ok: false, message: "Couldn't claim that name. Try again." };
  }

  // RPC returns text (the member_token) or null on race-loss.
  const token = typeof data === "string" ? data : null;
  if (!token) {
    return {
      ok: false,
      message: "Someone else just claimed that name. Pick another.",
    };
  }

  revalidatePath(`/b/${slug}`);
  redirect(`/b/${slug}?m=${token}`);
}

/**
 * Public — anyone holding a member token can mark that member paid.
 * The RPC is idempotent (no-op when already paid) and atomic.
 */
export async function markPaid(
  _prev: MarkPaidState,
  formData: FormData,
): Promise<MarkPaidState> {
  const parsed = MarkPaidSchema.safeParse({
    token: formData.get("token"),
    method: formData.get("method") ?? "",
    note: formData.get("note") ?? "",
    proofPath: formData.get("proofPath") ?? "",
  });
  if (!parsed.success) {
    return { ok: false, message: "Invalid request.", paidAt: null };
  }

  // Empty strings → null so the RPC stores them as missing rather than ''.
  const method = parsed.data.method?.trim() || null;
  const note = parsed.data.note?.trim() || null;
  const proofPath = parsed.data.proofPath?.trim() || null;

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("mark_member_paid", {
    p_token: parsed.data.token,
    p_method: method,
    p_note: note,
    p_proof_url: proofPath,
  });

  if (error) {
    logger.error("mark_member_paid rpc failed", {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    });
    return {
      ok: false,
      message: "Couldn't update. Try again in a sec.",
      paidAt: null,
    };
  }

  // RPC returns timestamptz directly; data is an ISO string or null.
  const paidAt =
    typeof data === "string" ? data : new Date().toISOString();

  return {
    ok: true,
    message: "Settled. Thank you 🙏",
    paidAt,
  };
}

/**
 * Server-side fire-and-await (cheap) view-touch from /b/[slug]?m=token.
 * No state returned — caller doesn't block on errors.
 */
export async function touchMemberViewed(token: string): Promise<void> {
  const parsed = MarkPaidSchema.safeParse({ token });
  if (!parsed.success) return;
  const supabase = await createSupabaseServerClient();
  await supabase.rpc("touch_member_viewed", { p_token: parsed.data.token });
}
