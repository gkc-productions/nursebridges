import Constants from "expo-constants";
import * as SecureStore from "expo-secure-store";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

type SecureStorage = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
};

const supabaseUrl = Constants.expoConfig?.extra?.supabaseUrl as string | undefined;
const supabaseAnonKey = Constants.expoConfig?.extra?.supabaseAnonKey as string | undefined;
const hasSupabaseConfig = Boolean(supabaseUrl?.trim() && supabaseAnonKey?.trim());
let supabaseClient: SupabaseClient | null = null;

const secureStorage: SecureStorage = {
  getItem: (key) => SecureStore.getItemAsync(key),
  setItem: (key, value) => SecureStore.setItemAsync(key, value),
  removeItem: (key) => SecureStore.deleteItemAsync(key)
};

export function getSupabaseClient(): SupabaseClient | null {
  if (!hasSupabaseConfig) return null;

  supabaseClient ??= createClient(supabaseUrl as string, supabaseAnonKey as string, {
    auth: {
      storage: secureStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false
    }
  });

  return supabaseClient;
}

export function getSupabaseConfig() {
  return { supabaseUrl, supabaseAnonKey, hasSupabaseConfig };
}
