import "dotenv/config";

export default {
  expo: {
    name: "NurseBridge",
    slug: "nursebridge",
    scheme: "nursebridge",
    version: "0.1.0",
    orientation: "portrait",
    userInterfaceStyle: "light",
    extra: {
      supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
      supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
      envLocalLabel: process.env.EXPO_PUBLIC_ENV_LOCAL_LABEL ?? "Local",
      envTunnelLabel: process.env.EXPO_PUBLIC_ENV_TUNNEL_LABEL ?? "Tunnel",
      envLocalBase: process.env.EXPO_PUBLIC_ENV_LOCAL_BASE ?? "http://localhost:3000",
      envTunnelBase: process.env.EXPO_PUBLIC_ENV_TUNNEL_BASE ?? "https://api.nursebridges.com"
    }
  }
};
