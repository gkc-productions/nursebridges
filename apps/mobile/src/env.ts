import Constants from "expo-constants";
import * as Device from "expo-device";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

export type EnvKey = "LOCAL" | "TUNNEL";

export type EnvOption = {
  key: EnvKey;
  label: string;
  baseUrl: string;
};

const STORAGE_ENV_KEY = "nb_api_env_key";
const STORAGE_BASE_URL = "nb_api_base_url";
const DEFAULT_ENV_KEY: EnvKey = "TUNNEL";

const rawLocalBase = String(Constants.expoConfig?.extra?.envLocalBase ?? "http://localhost:3000");
const rawTunnelBase = String(
  Constants.expoConfig?.extra?.envTunnelBase ?? "https://api.nursebridges.com"
);

export const envOptions: EnvOption[] = [
  {
    key: "LOCAL",
    label: String(Constants.expoConfig?.extra?.envLocalLabel ?? "Local"),
    baseUrl: rawLocalBase
  },
  {
    key: "TUNNEL",
    label: String(Constants.expoConfig?.extra?.envTunnelLabel ?? "Tunnel"),
    baseUrl: rawTunnelBase
  }
];

function normalizeBaseUrl(url: string) {
  return url.trim().replace(/\/$/, "");
}

function isLocalhostBaseUrl(url: string) {
  try {
    const { hostname } = new URL(url);
    return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
  } catch {
    return /(^https?:\/\/)?(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/i.test(url);
  }
}

function getDefaultEnvOption() {
  return envOptions.find((opt) => opt.key === DEFAULT_ENV_KEY) ?? envOptions[0];
}

export async function loadApiConfig(): Promise<{ envKey: EnvKey; baseUrl: string }> {
  const [storedEnvKey, storedBaseUrl] = await Promise.all([
    AsyncStorage.getItem(STORAGE_ENV_KEY),
    AsyncStorage.getItem(STORAGE_BASE_URL)
  ]);

  const defaultOption = getDefaultEnvOption();
  let envKey = envOptions.find((opt) => opt.key === storedEnvKey)?.key ?? defaultOption.key;
  let envBase = envOptions.find((opt) => opt.key === envKey)?.baseUrl ?? defaultOption.baseUrl;
  let baseUrl = normalizeBaseUrl(storedBaseUrl ?? envBase);

  if (Platform.OS === "android" && Device.isDevice && isLocalhostBaseUrl(baseUrl)) {
    envKey = defaultOption.key;
    envBase = defaultOption.baseUrl;
    baseUrl = normalizeBaseUrl(envBase);
    await saveApiConfig(envKey, baseUrl);
  }

  return { envKey, baseUrl };
}

export async function saveApiConfig(envKey: EnvKey, baseUrl: string): Promise<void> {
  const normalized = normalizeBaseUrl(baseUrl);
  await Promise.all([
    AsyncStorage.setItem(STORAGE_ENV_KEY, envKey),
    AsyncStorage.setItem(STORAGE_BASE_URL, normalized)
  ]);
}

export function getEnvOption(envKey: EnvKey): EnvOption {
  return envOptions.find((opt) => opt.key === envKey) ?? getDefaultEnvOption();
}
