const easProjectId =
  process.env.EXPO_PUBLIC_EAS_PROJECT_ID ??
  "76f2fa6d-f34e-43b3-b9f0-67b7d2c5a8b1";

export default {
  expo: {
    name: "NurseBridges",
    slug: "nursebridges",
    scheme: "nursebridges",
    version: "0.1.0",
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "automatic",
    plugins: ["expo-secure-store"],
    splash: {
      image: "./assets/splash.png",
      resizeMode: "contain",
      backgroundColor: "#EEF3F6"
    },
    ios: {
      bundleIdentifier: "com.nursebridges.mobile",
      buildNumber: "1",
      supportsTablet: false,
      icon: "./assets/icon.png",
      infoPlist: {
        ITSAppUsesNonExemptEncryption: false,
        NSFaceIDUsageDescription:
          "NurseBridges uses Face ID only when you choose to protect local app access on this device."
      }
    },
    android: {
      package: "com.nursebridges.mobile",
      versionCode: 1,
      adaptiveIcon: {
        foregroundImage: "./assets/icon.png",
        backgroundColor: "#101820"
      },
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
