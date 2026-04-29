const easProjectId =
  process.env.EXPO_PUBLIC_EAS_PROJECT_ID ??
  "76f2fa6d-f34e-43b3-b9f0-67b7d2c5a8b1";

export default {
  expo: {
    name: "NurseBridge",
    slug: "nursebridge",
    scheme: "nursebridge",
    version: "0.1.0",
    orientation: "portrait",
    userInterfaceStyle: "light",
    plugins: ["expo-secure-store"],
    ios: {
      bundleIdentifier: "com.nursebridge.mobile",
      supportsTablet: false
    },
    android: {
      package: "com.nursebridge.mobile",
      permissions: ["POST_NOTIFICATIONS"]
    },
    extra: {
      supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
      supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
      envLocalLabel: process.env.EXPO_PUBLIC_ENV_LOCAL_LABEL ?? "Local",
      envTunnelLabel: process.env.EXPO_PUBLIC_ENV_TUNNEL_LABEL ?? "Tunnel",
      envLocalBase: process.env.EXPO_PUBLIC_ENV_LOCAL_BASE ?? "http://localhost:3000",
      envTunnelBase: process.env.EXPO_PUBLIC_ENV_TUNNEL_BASE ?? "https://api.nursebridges.com",
      eas: {
        projectId: easProjectId
      }
    }
  }
};
