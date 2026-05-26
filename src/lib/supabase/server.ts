import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/*
 * Use in Server Components, server actions, and route handlers.
 * Create a fresh client per request — never share across requests.
 * `setAll` may throw inside a Server Component (cookies are read-only there);
 * the proxy middleware handles refreshes, so we swallow that branch safely.
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Server Component context — proxy handles refresh.
          }
        },
      },
    },
  );
}
