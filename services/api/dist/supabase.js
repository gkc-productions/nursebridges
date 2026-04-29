import { createClient } from "@supabase/supabase-js";
function must(name, v) {
    if (!v)
        throw new Error(`Missing env var: ${name}`);
    return v;
}
export const SUPABASE_URL = must("SUPABASE_URL", process.env.SUPABASE_URL);
export const SUPABASE_ANON_KEY = must("SUPABASE_ANON_KEY", process.env.SUPABASE_ANON_KEY);
export const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
/**
 * Admin client (service role). NEVER expose to mobile/browser.
 * Only initialized when SUPABASE_SERVICE_ROLE_KEY is available.
 */
export const supabaseAdmin = SUPABASE_SERVICE_ROLE_KEY
    ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
        auth: { persistSession: false, autoRefreshToken: false }
    })
    : null;
/**
 * Create a user-context client using a user JWT (Authorization Bearer token).
 * RLS applies.
 */
export function supabaseForUser(jwt) {
    return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: { persistSession: false, autoRefreshToken: false },
        global: { headers: { Authorization: `Bearer ${jwt}` } }
    });
}
