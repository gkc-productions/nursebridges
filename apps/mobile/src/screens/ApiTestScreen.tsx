import React, { useState } from "react";
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from "react-native";

type Props = {
  baseUrl: string;
  accessToken: string | null;
};

export default function ApiTestScreen({ baseUrl, accessToken }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [response, setResponse] = useState<string | null>(null);
  const [status, setStatus] = useState<number | null>(null);

  const handleTest = async () => {
    if (!accessToken) {
      setError("Sign in to test the API.");
      setResponse(null);
      setStatus(null);
      return;
    }

    setLoading(true);
    setError(null);
    setResponse(null);
    setStatus(null);

    try {
      const res = await fetch(`${baseUrl}/health`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      });

      const text = await res.text();
      setStatus(res.status);
      setResponse(text || "(empty response)");
    } catch {
      setError("Network error. Check the base URL and tunnel status.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.card}>
      <Text style={styles.title}>API Health Test</Text>
      <Text style={styles.meta}>Base URL: {baseUrl}</Text>

      <TouchableOpacity style={styles.button} onPress={handleTest} disabled={loading}>
        {loading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.buttonText}>Run Test</Text>}
      </TouchableOpacity>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {status !== null ? <Text style={styles.meta}>Status: {status}</Text> : null}
      {response ? <Text selectable style={styles.response}>{response}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20
  },
  title: {
    fontSize: 20,
    fontWeight: "600",
    marginBottom: 8
  },
  meta: {
    fontSize: 12,
    color: "#5E564F",
    marginBottom: 10
  },
  button: {
    backgroundColor: "#1E6A5A",
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
    marginBottom: 12
  },
  buttonText: {
    color: "#FFFFFF",
    fontWeight: "600"
  },
  error: {
    color: "#B00020",
    marginBottom: 8
  },
  response: {
    fontSize: 12,
    color: "#2D2A26"
  }
});
