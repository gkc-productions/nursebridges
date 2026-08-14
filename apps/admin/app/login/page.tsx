"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchAdminMe, restoreAdminAccessToken, signInWithPassword } from "../../lib/adminAuthClient";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;

    const restoreMagicLinkSession = async () => {
      try {
        const token = await restoreAdminAccessToken();
        if (!token || !active) return;

        setLoading(true);
        await fetchAdminMe();
        if (active) router.replace("/");
      } catch {
        // A missing or invalid callback session should leave the password form available.
      } finally {
        if (active) setLoading(false);
      }
    };

    void restoreMagicLinkSession();
    return () => {
      active = false;
    };
  }, [router]);

  const handleLogin = async () => {
    setLoading(true);
    setError(null);

    const { error: signInError } = await signInWithPassword(email, password);

    if (signInError) {
      setError("Unable to sign in. Check the operator email and password, then try again.");
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
    <section className="login-panel">
      <div className="login-copy"><p className="eyebrow">Secure operations</p><h2>Welcome back.</h2><p>Sign in to coordinate care requests, verification, and assignments. Access is limited to approved NurseBridges operators.</p><div className="secure-note">Protected workspace · Activity is auditable</div></div>
      <div className="login-form">
      <h3>Operator sign in</h3>
      {error ? <p className="notice">{error}</p> : null}
      <div className="grid">
        <label>Email address</label>
        <input
          className="input"
          placeholder="Email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
        <label>Password</label>
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
      </div>
    </section>
  );
}
