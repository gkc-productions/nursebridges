"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { adminFetch, getAdminAccessToken } from "../../lib/adminAuthClient";

type JobRow = {
  id: string;
  status: string;
  title: string;
  description: string | null;
  address: string | null;
  start_time: string | null;
  hourly_rate: number | null;
  created_at: string;
  applicant_count: number;
  patient_name: string | null;
  nurse_name: string | null;
};

const statusRank: Record<string, number> = {
  open: 0,
  assigned: 1,
  completed: 2,
  cancelled: 3
};

function formatDateTime(value: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString();
}

function formatRate(value: number | null) {
  if (value === null || value === undefined) return "-";
  return `$${value}/hr`;
}

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
      setJobs(
        [...data].sort((a, b) => {
          const statusDiff = (statusRank[a.status] ?? 99) - (statusRank[b.status] ?? 99);
          if (statusDiff !== 0) return statusDiff;
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        })
      );
    };

    void load();
  }, []);

  return (
    <section>
      <h2>Request Queue</h2>
      {error ? <p className="notice">{error}</p> : null}
      <table>
        <thead>
          <tr>
            <th>Status</th>
            <th>Request</th>
            <th>Patient</th>
            <th>Start</th>
            <th>Rate</th>
            <th>Applicants</th>
            <th>Assigned</th>
            <th>Created</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {jobs.map((job) => (
            <tr key={job.id}>
              <td>
                <span className="badge">{job.status}</span>
              </td>
              <td>
                <strong>{job.title}</strong>
                <div className="table-meta">{job.address ?? "No address"}</div>
              </td>
              <td>{job.patient_name ?? "-"}</td>
              <td>{formatDateTime(job.start_time)}</td>
              <td>{formatRate(job.hourly_rate)}</td>
              <td>{job.applicant_count}</td>
              <td>{job.nurse_name ?? "-"}</td>
              <td>{formatDateTime(job.created_at)}</td>
              <td>
                <Link href={`/jobs/${job.id}`}>{job.status === "open" ? "Review" : "Open"}</Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
