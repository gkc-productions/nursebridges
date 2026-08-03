"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { adminFetch } from "../lib/adminAuthClient";

type Overview = {
  users: number;
  jobs: number;
  nurses: number;
};

export default function Dashboard() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        setError(null);

        const overviewRes = await adminFetch("/api/admin/jobs");
        if (!overviewRes.ok) {
          const msg = await overviewRes.text();
          throw new Error(msg || "Failed to load overview");
        }

        const usersRes = await adminFetch("/api/admin/users");
        const nursesRes = await adminFetch("/api/admin/nurses");

        if (!usersRes.ok || !nursesRes.ok) {
          throw new Error("Failed to load dashboard data");
        }

        const jobs = await overviewRes.json();
        const users = await usersRes.json();
        const nurses = await nursesRes.json();

        setOverview({
          jobs: Array.isArray(jobs) ? jobs.length : jobs?.count ?? 0,
          users: Array.isArray(users) ? users.length : users?.count ?? 0,
          nurses: Array.isArray(nurses) ? nurses.length : nurses?.count ?? 0
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong");
      }
    };

    load();
  }, []);

  return (
    <>
    <section className="hero-panel">
      <div><p className="eyebrow">Live care operations</p><h2>Everything your care team needs, in one calm view.</h2><p>Review incoming requests, clear credentialing decisions, and keep every care handoff visible.</p></div>
      <Link className="button" href="/jobs">Open dispatch queue →</Link>
    </section>

    <section>
      <div className="section-heading"><div><p className="eyebrow">Today</p><h2>Operations overview</h2></div><span className="live-pill"><i /> Live</span></div>

      {error ? (
        <p className="notice">
          {error} <Link href="/login">Go to login</Link>.
        </p>
      ) : null}

      <div className="cards">
        <div className="card">
          <div className="label">People</div>
          <div className="value">{overview?.users ?? 0}</div>
          <p>Patient, nurse, and admin profiles</p>
        </div>
        <div className="card">
          <div className="label">Care requests</div>
          <div className="value">{overview?.jobs ?? 0}</div>
          <p>Across the complete care lifecycle</p>
        </div>
        <div className="card">
          <div className="label">Care professionals</div>
          <div className="value">{overview?.nurses ?? 0}</div>
          <p>Credentialing records to review</p>
        </div>
      </div>
    </section>
    </>
  );
}
