"use server";

import { z } from "zod";

import { logger } from "@/lib/logger";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { MemberByTokenRpc } from "@/types/db";

const ACCEPTED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB — matches storage bucket limit
const BUCKET = "payment-proofs";

export interface UploadProofState {
  ok: boolean | null;
  message: string;
  proofPath?: string;
}

const TokenSchema = z.string().trim().min(8).max(64);

/**
 * Recipient uploads a payment-proof screenshot. Token authenticates which
 * member is uploading. File goes to the private 'payment-proofs' bucket
 * keyed by bill_id + member_id; the returned path is then passed to
 * markPaid which snapshots it on the member row.
 *
 * Uses the service-role admin client so the bucket can stay anon-locked.
 * Reads later happen via short-lived signed URLs generated at report time.
 */
export async function uploadProof(
  _prev: UploadProofState,
  formData: FormData,
): Promise<UploadProofState> {
  const tokenRaw = formData.get("token");
  const file = formData.get("image");

  const parsedToken = TokenSchema.safeParse(tokenRaw);
  if (!parsedToken.success) {
    return { ok: false, message: "Invalid token." };
  }
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, message: "Pick an image first." };
  }
  if (!ACCEPTED_TYPES.has(file.type)) {
    return { ok: false, message: "Use a JPG, PNG, WEBP, or HEIC image." };
  }
  if (file.size > MAX_BYTES) {
    return { ok: false, message: "Image is too big — keep it under 5 MB." };
  }

  // Resolve which member is uploading. Don't trust the client to pass it.
  const supabase = await createSupabaseServerClient();
  const { data: member, error: memberError } = await supabase
    .rpc("get_member_by_token", { p_token: parsedToken.data })
    .maybeSingle<MemberByTokenRpc>();

  if (memberError || !member) {
    return { ok: false, message: "Token doesn't match any bill." };
  }
  if (member.paid) {
    return {
      ok: false,
      message: "You've already marked this paid — uploads are locked.",
    };
  }

  // Path: bills/{bill_id}/{member_id}-{timestamp}.{ext}
  const ext = mimeToExt(file.type);
  const path = `bills/${member.bill_id}/${member.member_id}-${Date.now()}.${ext}`;

  const bytes = new Uint8Array(await file.arrayBuffer());
  const admin = createSupabaseAdminClient();
  const { error: uploadError } = await admin.storage
    .from(BUCKET)
    .upload(path, bytes, {
      contentType: file.type,
      upsert: false,
    });

  if (uploadError) {
    logger.error("payment-proof upload failed", {
      message: uploadError.message,
    });
    return {
      ok: false,
      message: "Couldn't upload the image. Try again.",
    };
  }

  return { ok: true, message: "Uploaded.", proofPath: path };
}

function mimeToExt(mime: string): string {
  switch (mime) {
    case "image/jpeg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    case "image/heic":
      return "heic";
    case "image/heif":
      return "heif";
    default:
      return "bin";
  }
}
