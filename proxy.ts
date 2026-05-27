import type { NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase/proxy-session";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

/*
 * Only run on routes that actually need a Supabase session check. Each
 * proxy hit calls supabase.auth.getUser() which is a network round-trip
 * to Supabase Auth (Tokyo region) — adds ~150-300ms per navigation from
 * Malaysia. Previously the matcher ran on every page including the
 * landing, /privacy, and the public /b/[slug] recipient flow, all of
 * which don't need auth.
 *
 * Trade-off: session cookies don't get refreshed on public-page nav.
 * Default Supabase JWT lifetime is 1 hour; users who stay on the
 * landing page for >1h would need to re-sign-in. Acceptable.
 */
export const config = {
  matcher: ["/dashboard/:path*", "/auth/:path*"],
};
