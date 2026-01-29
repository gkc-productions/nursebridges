"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { fetchAdminMe, signInWithPassword } from "../../lib/adminAuthClient";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setLoading(true);
    setError(null);

    const { error: signInError } = await signInWithPassword(email, password);

    if (signInError) {
      setError(signInError.message);
      setLoading(false);
      return;
    }

    try {
      await fetchAdminMe();
      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Admin access required.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section>
      <h2>Admin Login</h2>
      {error ? <p className="notice">{error}</p> : null}
      <div className="grid">
        <input
          className="input"
          placeholder="Email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
        <input
          className="input"
          placeholder="Password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
        <button className="button" onClick={handleLogin} disabled={loading}>
          {loading ? "Signing in..." : "Sign in"}
        </button>
      </div>
    </section>
  );
}
