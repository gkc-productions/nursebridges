import React, { useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import * as Clipboard from "expo-clipboard";

type Props = {
  accessToken: string | null;
};

export default function TokenScreen({ accessToken }: Props) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!accessToken) return;
    await Clipboard.setStringAsync(accessToken);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Access Token</Text>
      <Text selectable style={styles.tokenText}>
        {accessToken ?? "No active session"}
      </Text>
      <TouchableOpacity
        style={[styles.button, !accessToken && styles.buttonDisabled]}
        onPress={handleCopy}
        disabled={!accessToken}
      >
        <Text style={styles.buttonText}>{copied ? "Copied" : "Copy Token"}</Text>
      </TouchableOpacity>
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
  tokenText: {
    fontSize: 12,
    color: "#2D2A26",
    marginBottom: 14
  },
  button: {
    backgroundColor: "#1E6A5A",
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center"
  },
  buttonDisabled: {
    backgroundColor: "#9FB4AE"
  },
  buttonText: {
    color: "#FFFFFF",
    fontWeight: "600"
  }
});
