import React, { useState } from "react";
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { envOptions, type EnvKey } from "../env";

type Props = {
  envKey: EnvKey;
  baseUrl: string;
  onSave: (envKey: EnvKey, baseUrl: string) => Promise<void>;
};

export default function EnvironmentScreen({ envKey, baseUrl, onSave }: Props) {
  const [selectedKey, setSelectedKey] = useState<EnvKey>(envKey);
  const [url, setUrl] = useState(baseUrl);
  const [status, setStatus] = useState<string | null>(null);

  const handleSelect = (key: EnvKey) => {
    setSelectedKey(key);
    const env = envOptions.find((opt) => opt.key === key);
    if (env) setUrl(env.baseUrl);
  };

  const handleSave = async () => {
    setStatus(null);
    await onSave(selectedKey, url);
    setStatus("Saved");
    setTimeout(() => setStatus(null), 1500);
  };

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Environment</Text>
      <View style={styles.row}>
        {envOptions.map((option) => (
          <TouchableOpacity
            key={option.key}
            style={[styles.envButton, selectedKey === option.key && styles.envButtonActive]}
            onPress={() => handleSelect(option.key)}
          >
            <Text
              style={[styles.envButtonText, selectedKey === option.key && styles.envButtonTextActive]}
            >
              {option.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>Base URL</Text>
      <TextInput
        style={styles.input}
        value={url}
        autoCapitalize="none"
        autoCorrect={false}
        onChangeText={setUrl}
        placeholder="https://example.com"
      />

      <TouchableOpacity style={styles.button} onPress={handleSave}>
        <Text style={styles.buttonText}>Save</Text>
      </TouchableOpacity>

      {status ? <Text style={styles.saved}>{status}</Text> : null}
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
    marginBottom: 12
  },
  label: {
    fontSize: 12,
    textTransform: "uppercase",
    color: "#8A8177",
    marginBottom: 6
  },
  row: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 12
  },
  envButton: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#1E6A5A"
  },
  envButtonActive: {
    backgroundColor: "#1E6A5A"
  },
  envButtonText: {
    color: "#1E6A5A",
    fontWeight: "600"
  },
  envButtonTextActive: {
    color: "#FFFFFF"
  },
  input: {
    borderWidth: 1,
    borderColor: "#E2DCD3",
    padding: 12,
    borderRadius: 10,
    marginBottom: 12,
    backgroundColor: "#FFF"
  },
  button: {
    backgroundColor: "#1E6A5A",
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center"
  },
  buttonText: {
    color: "#FFFFFF",
    fontWeight: "600"
  },
  saved: {
    marginTop: 8,
    color: "#1E6A5A"
  }
});
