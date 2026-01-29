"use client";

import { createClient } from "@supabase/supabase-js";

const TOKEN_KEY = "nursebridge_admin_access_token";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY env vars.");
}

export const supabaseClient = createClient(supabaseUrl, supabaseAnonKey);

function cleanToken(token: string) {
  return token.trim().replace(/^"|"$/g, "");
}

export function setAdminAccessToken(token?: string | null) {
  if (!token) {
    localStorage.removeItem(TOKEN_KEY);
    return;
  }
  localStorage.setItem(TOKEN_KEY, cleanToken(token));
}

export function getAdminAccessToken(): string | null {
  const t = localStorage.getItem(TOKEN_KEY);
  return t ? cleanToken(t) : null;
}

export async function adminFetch(path: string, init: RequestInit = {}) {
  const token = getAdminAccessToken();
  const headers = new Headers(init.headers || {});
  if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return fetch(path, { ...init, headers });
}

export async function signInWithPassword(email: string, password: string) {
  const res = await supabaseClient.auth.signInWithPassword({ email, password });
  setAdminAccessToken(res.data.session?.access_token ?? null);
  return res;
}

export async function signOutAdmin() {
  setAdminAccessToken(null);
  await supabaseClient.auth.signOut();
}

export async function fetchAdminMe() {
  const res = await adminFetch("/api/admin/me");
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(txt || `Admin auth failed (${res.status})`);
  }
  return res.json();
}
