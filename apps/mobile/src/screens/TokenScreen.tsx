import React from "react";
import { StyleSheet, Text, View } from "react-native";

type Props = {
  accessToken: string | null;
};

export default function TokenScreen({ accessToken }: Props) {
  const signedIn = Boolean(accessToken);

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Session Status</Text>
      <Text style={styles.sessionText}>{signedIn ? "Signed in" : "No active session"}</Text>
      <Text style={styles.helpText}>
        Session credentials are intentionally hidden. Use issue details or the support snapshot for debugging.
      </Text>
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
  sessionText: {
    fontSize: 12,
    color: "#2D2A26",
    marginBottom: 14
  },
  helpText: {
    color: "#5E564F",
    fontSize: 12,
    lineHeight: 17
  }
});
