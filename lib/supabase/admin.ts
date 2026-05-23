import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

// Service-role client. Server-only. Bypasses RLS.
// Used by the .ics feed handler (Phase 3) and the one-shot /api/setup user provisioner.
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
  }
  return createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
