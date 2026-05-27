"use server";

import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase/server";

/*
 * Sign-out is the only server action left after switching to Google OAuth.
 * Sign-in is a 302 redirect via /login/google → Supabase → Google's
 * consent screen → /auth/callback?code=... → exchangeCodeForSession.
 * No password, no email round-trip, no SMTP.
 */
export async function signOut() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/");
}
