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
      message: "Couldn't send the link. Try again in a sec.",
    };
  }

  return {
    ok: true,
    message: "Check your inbox — the magic link's on its way.",
  };
}

export async function signOut() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/");
}
