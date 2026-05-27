import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/*
 * Session refresh helper for proxy.ts (Next 16's middleware rename).
 *
 * Two responsibilities:
 *   1. Refresh the Supabase session cookies on every request so server
 *      components see a fresh user. Skipping this causes random logouts.
 *   2. Gate /dashboard/* — unauthenticated users get bounced to /login with
 *      a ?next= param so they land back where they tried to go.
 */
export async function updateSession(request: NextRequest) {
  // Expose the current pathname to server components via a request header
  // so layouts can branch on it (e.g. skip the welcome-redirect when the
  // user is already on /welcome). Next.js doesn't expose the pathname to
  // Server Components by default.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", request.nextUrl.pathname);

  let supabaseResponse = NextResponse.next({
    request: { headers: requestHeaders },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          supabaseResponse = NextResponse.next({
            request: { headers: requestHeaders },
          });
          for (const { name, value, options } of cookiesToSet) {
            supabaseResponse.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const url = request.nextUrl;
  const isProtected = url.pathname.startsWith("/dashboard");
  if (!user && isProtected) {
    const loginUrl = url.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("next", url.pathname);
    return NextResponse.redirect(loginUrl);
  }

  return supabaseResponse;
}
