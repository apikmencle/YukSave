import { createClient } from "@supabase/supabase-js";

// Server-side client — uses the service role key so API routes can
// write to the `downloads` log table. Never import this from client
// components; keep it inside app/api/** only.
export function getSupabaseServerClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error("Supabase env vars are not configured");
  }

  return createClient(url, key, {
    auth: { persistSession: false },
  });
}
