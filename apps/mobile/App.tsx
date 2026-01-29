import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from "react-native";
import type { Session } from "@supabase/supabase-js";
import LoginScreen from "./src/screens/LoginScreen";
import TokenScreen from "./src/screens/TokenScreen";
import ApiTestScreen from "./src/screens/ApiTestScreen";
import EnvironmentScreen from "./src/screens/EnvironmentScreen";
import { loadApiConfig, saveApiConfig, type EnvKey } from "./src/env";
import { supabase } from "./src/supabase";

type ScreenKey = "login" | "token" | "api" | "settings";

type ApiConfig = {
  envKey: EnvKey;
  baseUrl: string;
};

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [screen, setScreen] = useState<ScreenKey>("login");
  const [apiConfig, setApiConfig] = useState<ApiConfig>({
    envKey: "LOCAL",
    baseUrl: "http://localhost:3000"
  });

  useEffect(() => {
    let mounted = true;
    loadApiConfig().then((config) => {
      if (mounted) setApiConfig(config);
    });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session ?? null);
      setLoading(false);
      setScreen(data.session ? "token" : "login");
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setScreen(newSession ? "token" : "login");
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  const handleSaveEnv = async (envKey: EnvKey, baseUrl: string) => {
    await saveApiConfig(envKey, baseUrl);
    setApiConfig({ envKey, baseUrl });
  };

  const tabs = useMemo<ScreenKey[]>(() => {
    if (!session) return ["login", "settings"];
    return ["token", "api", "settings"];
  }, [session]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#1E6A5A" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>NurseBridge Mobile</Text>
      </View>

      <View style={styles.tabRow}>
        {tabs.map((key) => (
          <TouchableOpacity
            key={key}
            style={[styles.tabButton, screen === key && styles.tabButtonActive]}
            onPress={() => setScreen(key)}
          >
            <Text style={[styles.tabText, screen === key && styles.tabTextActive]}>
              {key.toUpperCase()}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {screen === "login" ? (
          <LoginScreen onSignedIn={() => setScreen("token")} />
        ) : null}
        {screen === "token" ? <TokenScreen accessToken={session?.access_token ?? null} /> : null}
        {screen === "api" ? (
          <ApiTestScreen baseUrl={apiConfig.baseUrl} accessToken={session?.access_token ?? null} />
        ) : null}
        {screen === "settings" ? (
          <EnvironmentScreen
            envKey={apiConfig.envKey}
            baseUrl={apiConfig.baseUrl}
            onSave={handleSaveEnv}
          />
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5F2EE"
  },
  header: {
    padding: 20,
    paddingBottom: 10
  },
  title: {
    fontSize: 26,
    fontWeight: "700",
    color: "#221E1A"
  },
  tabRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    gap: 10
  },
  tabButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#1E6A5A"
  },
  tabButtonActive: {
    backgroundColor: "#1E6A5A"
  },
  tabText: {
    fontSize: 12,
    color: "#1E6A5A",
    fontWeight: "600"
  },
  tabTextActive: {
    color: "#FFFFFF"
  },
  content: {
    padding: 20
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center"
  }
});
