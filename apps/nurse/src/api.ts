import Constants from "expo-constants";
import type { Session } from "@supabase/supabase-js";

export const apiBaseUrl = String(Constants.expoConfig?.extra?.envTunnelBase ?? "https://api.nursebridges.com").replace(/\/$/, "");

export async function api<T>(session: Session, path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${session.access_token}`);
  headers.set("x-request-id", `care-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`);
  if (init.body) headers.set("Content-Type", "application/json");
  const response = await fetch(`${apiBaseUrl}${path}`, { ...init, headers });
  const text = await response.text();
  const data = text ? JSON.parse(text) : {};
  if (!response.ok) throw new Error(data.error ?? "Request failed");
  return data as T;
}
