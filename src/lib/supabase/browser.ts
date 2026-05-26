import { createBrowserClient } from "@supabase/ssr";

/*
 * Use in client components only. Reads cookies set by the server.
 * Returns the same instance across calls in a given browser context.
 */
export function createSupabaseBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
