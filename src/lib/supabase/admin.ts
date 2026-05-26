import "server-only";

import { createClient } from "@supabase/supabase-js";

/*
 * Service-role client. BYPASSES RLS.
 * Import only from server actions that genuinely need elevated access.
 * Never re-export, never import from a client file.
 * `server-only` guards this — building it into a client bundle is a build error.
 */
export function createSupabaseAdminClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
  }
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
