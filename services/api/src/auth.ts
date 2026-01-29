import type { FastifyRequest } from "fastify";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { SUPABASE_URL, supabaseForUser } from "./supabase";

export type UserRole = "patient" | "nurse" | "admin";

export type Authed = {
  jwt: string;
  userId: string;
  email: string | null;
  role: UserRole;
  profile: Record<string, any> | null;
};

const SUPABASE_JWT_SECRET = process.env.SUPABASE_JWT_SECRET;
const JWKS = createRemoteJWKSet(new URL(`${SUPABASE_URL}/auth/v1/.well-known/jwks.json`));

export function getBearerToken(req: FastifyRequest): string | null {
  const h = req.headers.authorization;
  if (!h) return null;
  const m = /^Bearer\s+(.+)$/i.exec(h);
  return m?.[1] ?? null;
}

async function verifyAccessToken(jwt: string) {
  if (SUPABASE_JWT_SECRET) {
    const secret = new TextEncoder().encode(SUPABASE_JWT_SECRET);
    return jwtVerify(jwt, secret, { algorithms: ["HS256"] });
  }

  return jwtVerify(jwt, JWKS);
}

export async function requireAuth(req: FastifyRequest): Promise<Authed> {
  const jwt = getBearerToken(req);
  if (!jwt) {
    throw Object.assign(new Error("Missing bearer token"), { statusCode: 401 });
  }

  let payload: Record<string, any>;
  try {
    const verified = await verifyAccessToken(jwt);
    payload = verified.payload as Record<string, any>;
  } catch {
    throw Object.assign(new Error("Invalid token"), { statusCode: 401 });
  }

  const userId = String(payload.sub ?? "");
  if (!userId) {
    throw Object.assign(new Error("Invalid token"), { statusCode: 401 });
  }

  const email = typeof payload.email === "string" ? payload.email : null;
  const sb = supabaseForUser(jwt);

  const { data: profile, error: profErr } = await sb
    .from("profiles")
    .select("id, role, full_name, phone, created_at, updated_at")
    .eq("id", userId)
    .maybeSingle();

  if (profErr) {
    throw Object.assign(new Error(`Failed to load profile: ${profErr.message}`), { statusCode: 500 });
  }

  const role = (profile?.role ?? "patient") as UserRole;

  return { jwt, userId, email, role, profile: profile ?? null };
}

export function requireRole(authed: Authed, roles: UserRole[]) {
  if (!roles.includes(authed.role)) {
    throw Object.assign(new Error(`Forbidden (requires role: ${roles.join(", ")})`), { statusCode: 403 });
  }
}

export function requireAdmin(authed: Authed) {
  if (authed.role !== "admin") {
    throw Object.assign(new Error("Not admin"), { statusCode: 403 });
  }
}
