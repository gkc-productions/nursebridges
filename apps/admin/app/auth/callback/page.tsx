"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchAdminMe, signInWithMagicLinkToken } from "../../../lib/adminAuthClient";

export default function AdminAuthCallbackPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const completeSignIn = async () => {
      const tokenHash = new URLSearchParams(window.location.search).get("token_hash");
      if (!tokenHash) {
        if (active) setError("This sign-in link is incomplete or has expired.");
        return;
      }

      try {
        const { error: verifyError } = await signInWithMagicLinkToken(tokenHash);
        if (verifyError) throw verifyError;
        await fetchAdminMe();
        if (active) router.replace("/");
      } catch {
        if (active) setError("This sign-in link is invalid, expired, or is not approved for admin access.");
      }
    };

    void completeSignIn();
    return () => {
      active = false;
    };
  }, [router]);

  return (
    <section className="login-panel">
      <div className="login-copy">
        <p className="eyebrow">Secure operations</p>
        <h2>Confirming access.</h2>
        <p>The one-time link is being verified against the approved NurseBridge operator account.</p>
      </div>
      <div className="login-form">
        <h3>{error ? "Unable to confirm access" : "Signing you in…"}</h3>
        {error ? (
          <>
            <p className="notice" role="alert">{error}</p>
            <Link className="button" href="/login">Return to sign in</Link>
          </>
        ) : (
          <div className="loading-state" role="status" aria-live="polite">
            <span className="loading-indicator" aria-hidden="true" />
            <p>Verifying the one-time link.</p>
          </div>
        )}
      </div>
    </section>
  );
}
