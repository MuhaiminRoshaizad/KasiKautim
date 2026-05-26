import { NextResponse, type NextRequest } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";

/*
 * Handles the redirect from the magic-link email.
 * Exchanges the ?code for a session, then redirects to the original ?next
 * (whitelisted to in-app paths only — no open-redirect).
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const code = url.searchParams.get("code");
  const nextParam = url.searchParams.get("next");
  const next = nextParam?.startsWith("/") ? nextParam : "/dashboard";

  if (!code) {
    return NextResponse.redirect(new URL("/login?error=missing_code", url));
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    logger.warn("auth callback exchange failed", { code: error.code });
    return NextResponse.redirect(new URL("/login?error=exchange_failed", url));
  }

  return NextResponse.redirect(new URL(next, url));
}
