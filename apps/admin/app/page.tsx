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
    <section>
      <h2>Overview</h2>

      {error ? (
        <p className="notice">
          {error} <Link href="/login">Go to login</Link>.
        </p>
      ) : null}

      <div className="cards">
        <div className="card">
          <div className="label">USERS</div>
          <div className="value">{overview?.users ?? 0}</div>
        </div>
        <div className="card">
          <div className="label">JOBS</div>
          <div className="value">{overview?.jobs ?? 0}</div>
        </div>
        <div className="card">
          <div className="label">NURSES</div>
          <div className="value">{overview?.nurses ?? 0}</div>
        </div>
      </div>
    </section>
  );
}
