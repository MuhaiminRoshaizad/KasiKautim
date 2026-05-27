import { NextResponse, type NextRequest } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";

/*
 * Handles the post-Google-OAuth redirect. Exchanges the ?code for a
 * session, then 302s to the ?next path. `next` is hardened against open
 * redirects: protocol-relative URLs (//evil.com), backslash tricks, and
 * absolute URLs are all rejected, with a final same-origin check via the
 * URL parser as the actual safety net.
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const code = url.searchParams.get("code");
  const next = safeNext(url.searchParams.get("next"), url);

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

function safeNext(raw: string | null, base: URL): string {
  if (!raw) return "/dashboard";
  // Fast-path reject: protocol-relative (//evil.com), backslash variants,
  // and anything not anchored at "/". `startsWith("/")` alone allows
  // "//evil.com/x" — new URL() then resolves that to http://evil.com/x.
  if (
    !raw.startsWith("/") ||
    raw.startsWith("//") ||
    raw.startsWith("/\\") ||
    raw.startsWith("/%2f") ||
    raw.startsWith("/%2F")
  ) {
    return "/dashboard";
  }
  // Final guard: resolve against base and confirm same-origin. Belt and
  // braces — any oddity that slipped past the prefix check trips here.
  try {
    const resolved = new URL(raw, base);
    if (resolved.origin !== base.origin) return "/dashboard";
    return resolved.pathname + resolved.search;
  } catch {
    return "/dashboard";
  }
}
