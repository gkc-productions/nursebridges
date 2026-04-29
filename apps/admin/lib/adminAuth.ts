import { NextRequest } from "next/server";
import { supabaseAdmin } from "./supabaseAdmin";

export function getBearerToken(req: NextRequest) {
  const h = req.headers.get("authorization") || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : null;
}

export async function requireAdmin(req: NextRequest) {
  const token = getBearerToken(req);
  if (!token) {
    return { ok: false as const, status: 401, error: "Missing bearer token" };
  }

  // Authoritative verification via Supabase Auth.
  let authResult: Awaited<ReturnType<typeof supabaseAdmin.auth.getUser>>;
  try {
    authResult = await supabaseAdmin.auth.getUser(token);
  } catch {
    return { ok: false as const, status: 401, error: "Invalid token" };
  }

  const { data, error } = authResult;
  if (error || !data?.user) {
    return { ok: false as const, status: 401, error: "Invalid token" };
  }

  const userId = data.user.id;

  // Enforce admin role from public.profiles.
  const { data: profile, error: profErr } = await supabaseAdmin
    .from("profiles")
    .select("id, role, full_name")
    .eq("id", userId)
    .maybeSingle();

  if (profErr) {
    return { ok: false as const, status: 500, error: "Profile lookup failed" };
  }
  if (!profile) {
    return { ok: false as const, status: 403, error: "Profile row missing" };
  }
  if (profile.role !== "admin") {
    return { ok: false as const, status: 403, error: "Not an admin" };
  }

  return { ok: true as const, user: data.user, profile };
}
