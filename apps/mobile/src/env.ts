import Constants from "expo-constants";
import AsyncStorage from "@react-native-async-storage/async-storage";

export type EnvKey = "LOCAL" | "TUNNEL";

export type EnvOption = {
  key: EnvKey;
  label: string;
  baseUrl: string;
};

const STORAGE_ENV_KEY = "nb_api_env_key";
const STORAGE_BASE_URL = "nb_api_base_url";

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

export async function loadApiConfig(): Promise<{ envKey: EnvKey; baseUrl: string }> {
  const [storedEnvKey, storedBaseUrl] = await Promise.all([
    AsyncStorage.getItem(STORAGE_ENV_KEY),
    AsyncStorage.getItem(STORAGE_BASE_URL)
  ]);

  const envKey = envOptions.find((opt) => opt.key === storedEnvKey)?.key ?? envOptions[0].key;
  const envBase = envOptions.find((opt) => opt.key === envKey)?.baseUrl ?? envOptions[0].baseUrl;
  const baseUrl = normalizeBaseUrl(storedBaseUrl ?? envBase);

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
  return envOptions.find((opt) => opt.key === envKey) ?? envOptions[0];
}
