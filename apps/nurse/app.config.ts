export default {
  expo: {
    name: "NurseBridges Care",
    slug: "nursebridges-care",
    scheme: "nursebridges-care",
    version: "0.1.0",
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "light",
    plugins: ["expo-secure-store", "expo-font"],
    splash: {
      image: "./assets/brand/nursebridges-care-mark.png",
      resizeMode: "contain",
      backgroundColor: "#071B24"
    },
    ios: {
      bundleIdentifier: "com.nursebridges.care",
      buildNumber: "3",
      supportsTablet: false,
      icon: "./assets/icon.png",
      infoPlist: {
        ITSAppUsesNonExemptEncryption: false,
        NSFaceIDUsageDescription:
          "NurseBridges Care uses Face ID only when you choose to protect local app access on this device."
      }
    },
    android: {
      package: "com.nursebridges.care",
      versionCode: 1,
      adaptiveIcon: {
        foregroundImage: "./assets/icon.png",
        backgroundColor: "#071B24"
      },
      permissions: ["POST_NOTIFICATIONS"]
    },
    extra: {
      productId: "nurse",
      supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
      supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
      envLocalLabel: process.env.EXPO_PUBLIC_ENV_LOCAL_LABEL ?? "Local",
      envTunnelLabel: process.env.EXPO_PUBLIC_ENV_TUNNEL_LABEL ?? "Tunnel",
      envLocalBase: process.env.EXPO_PUBLIC_ENV_LOCAL_BASE ?? "http://localhost:3000",
      envTunnelBase: process.env.EXPO_PUBLIC_ENV_TUNNEL_BASE ?? "https://api.nursebridges.com"
    }
  }
};
