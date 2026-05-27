import { NextResponse, type NextRequest } from "next/server";

import { siteUrl } from "@/lib/site-url";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";

/*
 * Kicks off the Google OAuth flow. The browser hits this route (via a GET
 * link), we ask Supabase for the provider URL, and 302 the user to Google's
 * consent screen. Google redirects back to /auth/callback?code=... which
 * the existing PKCE handler exchanges for a session.
 *
 * Server-side handler (not a client component) because we want to use the
 * same SSR Supabase client + cookie machinery that magic-link did — the
 * code_verifier cookie has to be set on the request *origin* domain so the
 * /auth/callback exchange can read it back.
 *
 * ?next= is forwarded into the OAuth state via the redirectTo URL, then
 * unwrapped by /auth/callback to decide where to land the signed-in user.
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const nextParam = url.searchParams.get("next");
  const next = nextParam?.startsWith("/") ? nextParam : "/dashboard";

  const supabase = await createSupabaseServerClient();
  const redirectTo = `${siteUrl()}/auth/callback?next=${encodeURIComponent(next)}`;

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo,
      // Force Google's account picker every time so shared-device users
      // can switch accounts without first signing out of Google.
      queryParams: { prompt: "select_account" },
    },
  });

  if (error || !data?.url) {
    logger.warn("google oauth init failed", { code: error?.code, status: error?.status });
    const back = url.clone();
    back.pathname = "/login";
    back.searchParams.set("error", "oauth_init_failed");
    return NextResponse.redirect(back);
  }

  return NextResponse.redirect(data.url);
}
