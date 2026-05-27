import { cache } from "react";

import { createSupabaseServerClient } from "./server";

/*
 * Per-request cached user lookup. React's cache() dedupes the call
 * within a single server render — proxy.ts already verified via
 * getUser() in middleware, then the dashboard layout + each page
 * used to call getUser() again (~150ms Tokyo round-trip each).
 * With cache(), layout + every page sharing one render call share
 * one network round-trip.
 *
 * Use this everywhere you'd otherwise reach for
 * `supabase.auth.getUser()` inside a Server Component or page.
 * Middleware (proxy.ts) can't use this because cache() is scoped to
 * a single React render cycle — middleware runs in its own context.
 */
export const getCurrentUser = cache(async () => {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

/*
 * Lightweight session check that reads only the local auth cookie
 * (no network call). Acceptable for route-gating in layouts where
 * proxy.ts has already verified via getUser() — the cookie is
 * signed by Supabase's JWT secret, so forging it would require
 * compromising the project's secret. Trade-off: a revoked JWT
 * could continue passing the gate until it expires (~1h default).
 *
 * Industry-standard pattern for SSR apps that prioritize speed of
 * navigation over real-time revocation. Per official Supabase docs
 * (https://supabase.com/docs/guides/auth/server-side) this is the
 * acknowledged escape hatch for the middleware-already-checked case.
 */
export const getCurrentSession = cache(async () => {
  const supabase = await createSupabaseServerClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session;
});
