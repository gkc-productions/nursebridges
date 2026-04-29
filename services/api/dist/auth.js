import { createRemoteJWKSet, jwtVerify } from "jose";
import { SUPABASE_URL, supabaseForUser } from "./supabase.js";
const SUPABASE_JWT_SECRET = process.env.SUPABASE_JWT_SECRET;
const JWKS = createRemoteJWKSet(new URL(`${SUPABASE_URL}/auth/v1/.well-known/jwks.json`));
const USER_ROLES = ["patient", "nurse", "admin"];
export function getBearerToken(req) {
    const h = req.headers.authorization;
    if (!h)
        return null;
    const m = /^Bearer\s+(.+)$/i.exec(h);
    return m?.[1] ?? null;
}
async function verifyAccessToken(jwt) {
    if (SUPABASE_JWT_SECRET) {
        const secret = new TextEncoder().encode(SUPABASE_JWT_SECRET);
        return jwtVerify(jwt, secret, { algorithms: ["HS256"] });
    }
    return jwtVerify(jwt, JWKS);
}
export async function requireAuth(req) {
    const jwt = getBearerToken(req);
    if (!jwt) {
        throw Object.assign(new Error("Missing bearer token"), { statusCode: 401 });
    }
    let payload;
    try {
        const verified = await verifyAccessToken(jwt);
        payload = verified.payload;
    }
    catch {
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
        throw Object.assign(new Error("Profile lookup failed"), { statusCode: 500 });
    }
    if (!profile) {
        throw Object.assign(new Error("Profile row missing"), { statusCode: 403 });
    }
    if (!USER_ROLES.includes(profile.role)) {
        throw Object.assign(new Error("Invalid profile role"), { statusCode: 403 });
    }
    const role = profile.role;
    return { jwt, userId, email, role, profile };
}
export function requireRole(authed, roles) {
    if (!roles.includes(authed.role)) {
        throw Object.assign(new Error("Forbidden"), { statusCode: 403 });
    }
}
export function requireAdmin(authed) {
    if (authed.role !== "admin") {
        throw Object.assign(new Error("Not admin"), { statusCode: 403 });
    }
}
