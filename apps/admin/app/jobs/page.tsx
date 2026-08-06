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
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"active" | "open" | "assigned" | "all">("active");

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

  const visibleJobs = jobs.filter((job) => {
    const matchesFilter = filter === "all"
      || (filter === "active" && (job.status === "open" || job.status === "assigned"))
      || job.status === filter;
    const haystack = `${job.title} ${job.patient_name ?? ""} ${job.nurse_name ?? ""} ${job.address ?? ""}`.toLowerCase();
    return matchesFilter && haystack.includes(query.trim().toLowerCase());
  });

  const openCount = jobs.filter((job) => job.status === "open").length;
  const assignedCount = jobs.filter((job) => job.status === "assigned").length;

  return (
    <>
    <section className="page-intro">
      <div><p className="eyebrow">Dispatch</p><h2>Care request queue</h2><p>Review incoming needs, compare approved applicants, and follow active care through completion.</p></div>
      <div className="compact-stats"><span><strong>{openCount}</strong><small>Need review</small></span><span><strong>{assignedCount}</strong><small>In progress</small></span><span><strong>{jobs.length}</strong><small>All records</small></span></div>
    </section>
    <section className="data-section">
      <div className="queue-toolbar">
        <div className="segmented" aria-label="Filter care requests">
          {(["active", "open", "assigned", "all"] as const).map((option) => <button className={filter === option ? "active" : ""} key={option} onClick={() => setFilter(option)}>{option}</button>)}
        </div>
        <label className="search-field"><span>⌕</span><input aria-label="Search requests" placeholder="Search requests" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
      </div>
      {error ? <p className="notice">{error}</p> : null}
      <div className="table-shell"><table>
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
          {visibleJobs.map((job) => (
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
                <Link className="row-action" href={`/jobs/${job.id}`}>{job.status === "open" ? "Review" : "Open"} <span>›</span></Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table></div>
      {visibleJobs.length === 0 && !error ? <div className="empty-state centered"><strong>No matching requests</strong><p>Try another status or search term.</p></div> : null}
    </section>
    </>
  );
}
