"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { siteUrl } from "@/lib/site-url";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";

export interface AuthFormState {
  ok: boolean | null;
  message: string;
}

const SignInSchema = z.object({
  email: z.string().email("Enter a real email lah."),
  next: z.string().optional(),
});

export async function signInWithMagicLink(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = SignInSchema.safeParse({
    email: formData.get("email"),
    next: formData.get("next") ?? undefined,
  });
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Invalid email.",
    };
  }

  const supabase = await createSupabaseServerClient();
  const next = parsed.data.next?.startsWith("/") ? parsed.data.next : "/dashboard";
  const emailRedirectTo = `${siteUrl()}/auth/callback?next=${encodeURIComponent(next)}`;

  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data.email,
    options: { emailRedirectTo },
  });

  if (error) {
    logger.warn("magic-link signin failed", { code: error.code, status: error.status });
    return {
      ok: false,
      message: mapSignInError(error.code, error.status),
    };
  }

  return {
    ok: true,
    message: "Check your inbox — the magic link's on its way.",
  };
}

/*
 * Map Supabase Auth error codes to user-friendly Manglish copy.
 * Codes are the canonical strings from @supabase/supabase-js — keep this
 * list in sync with https://supabase.com/docs/reference/javascript/auth-error-codes
 * Only branch on codes we expect to see; everything else falls through to
 * the generic message so we never leak internal status text to the user.
 */
function mapSignInError(
  code: string | undefined,
  status: number | undefined,
): string {
  if (code === "over_email_send_rate_limit" || status === 429) {
    return "Too many sign-in tries from this email. Wait an hour, or try a different email.";
  }
  if (code === "validation_failed") {
    return "That email doesn't look right. Check the spelling and try again.";
  }
  if (code === "email_address_not_authorized") {
    return "That email isn't on the allowlist for this project. Use the email you signed up with.";
  }
  if (code === "signup_disabled") {
    return "New signups are currently paused. Try again later.";
  }
  return "Couldn't send the link — Supabase Auth rejected it. Wait a minute and try again.";
}

export async function signOut() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/");
}
