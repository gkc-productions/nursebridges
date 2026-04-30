import React, { useState } from "react";
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { getSupabaseClient } from "../supabase";

type Props = {
  onSignedIn: () => void;
};

export default function LoginScreen({ onSignedIn }: Props) {
  const supabase = getSupabaseClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSignIn = async () => {
    if (!supabase) {
      setError("Mobile app is missing Supabase configuration.");
      return;
    }

    setLoading(true);
    setError(null);

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    setLoading(false);

    if (signInError) {
      setError(signInError.message);
      return;
    }

    onSignedIn();
  };

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Admin Login</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <TextInput
        style={styles.input}
        placeholder="Email"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />
      <TouchableOpacity style={styles.button} onPress={handleSignIn} disabled={loading}>
        {loading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.buttonText}>Sign In</Text>}
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
  error: {
    color: "#B00020",
    marginBottom: 10
  }
});
