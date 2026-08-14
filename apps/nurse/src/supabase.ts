import Constants from "expo-constants";
import * as SecureStore from "expo-secure-store";
import { createClient } from "@supabase/supabase-js";

const url = Constants.expoConfig?.extra?.supabaseUrl as string | undefined;
const anonKey = Constants.expoConfig?.extra?.supabaseAnonKey as string | undefined;

const storage = {
  getItem: (key: string) => SecureStore.getItemAsync(`care:${key}`),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(`care:${key}`, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(`care:${key}`)
};

export const hasSupabaseConfig = Boolean(url && anonKey);
export const supabase = hasSupabaseConfig ? createClient(url!, anonKey!, {
  auth: { storage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false }
}) : null;
