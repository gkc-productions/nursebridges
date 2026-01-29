"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { adminFetch, getAdminAccessToken } from "../../lib/adminAuthClient";

type JobRow = {
  id: string;
  status: string;
  title: string;
  description: string | null;
  created_at: string;
  patient_name: string | null;
  nurse_name: string | null;
};

export default function JobsPage() {
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      const token = getAdminAccessToken();
      if (!token) {
        setError("Please sign in.");
        return;
      }

      const res = await adminFetch("/api/admin/jobs");

      if (!res.ok) {
        setError("Unable to load jobs.");
        return;
      }

      const data = (await res.json()) as JobRow[];
      setJobs(data);
    };

    void load();
  }, []);

  return (
    <section>
      <h2>Jobs</h2>
      {error ? <p className="notice">{error}</p> : null}
      <table>
        <thead>
          <tr>
            <th>Title</th>
            <th>Status</th>
            <th>Patient</th>
            <th>Nurse</th>
            <th>Created</th>
            <th>Timeline</th>
          </tr>
        </thead>
        <tbody>
          {jobs.map((job) => (
            <tr key={job.id}>
              <td>{job.title}</td>
              <td>
                <span className="badge">{job.status}</span>
              </td>
              <td>{job.patient_name ?? "-"}</td>
              <td>{job.nurse_name ?? "-"}</td>
              <td>{new Date(job.created_at).toLocaleDateString()}</td>
              <td>
                <Link href={`/jobs/${job.id}`}>View</Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
