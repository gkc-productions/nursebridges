import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

function missingSupabaseAdmin() {
  throw new Error("Missing SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars.");
}

export const supabaseAdmin =
  supabaseUrl && serviceRole
    ? createClient(supabaseUrl, serviceRole, {
        auth: { persistSession: false }
      })
    : new Proxy({} as ReturnType<typeof createClient>, {
        get() {
          missingSupabaseAdmin();
        }
      });

export function hasSupabaseAdminConfig() {
  return Boolean(supabaseUrl && serviceRole);
}
