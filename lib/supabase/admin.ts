import { createClient } from "@supabase/supabase-js";

// Service-role client. Server-only. Bypasses RLS.
// Used by the .ics feed handler (Phase 3) where we authenticate via a capability URL token.
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
  }
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
