"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { adminFetch } from "../lib/adminAuthClient";

type Overview = {
  users: number;
  jobs: number;
  nurses: number;
  openRequests: number;
  assignedRequests: number;
  pendingCredentials: number;
  readyProfessionals: number;
};

type JobRow = { id: string; status: string; title: string; applicant_count: number; created_at: string };
type NurseRow = { id: string; profile_name: string | null; verification_status: string; created_at: string };

function relativeAge(value: string) {
  const minutes = Math.max(1, Math.round((Date.now() - new Date(value).getTime()) / 60_000));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export default function Dashboard() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [priorityJobs, setPriorityJobs] = useState<JobRow[]>([]);
  const [pendingNurses, setPendingNurses] = useState<NurseRow[]>([]);
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

        const jobs = (await overviewRes.json()) as JobRow[];
        const users = await usersRes.json() as unknown[];
        const nurses = (await nursesRes.json()) as NurseRow[];

        setOverview({
          jobs: jobs.length,
          users: users.length,
          nurses: nurses.length,
          openRequests: jobs.filter((job) => job.status === "open").length,
          assignedRequests: jobs.filter((job) => job.status === "assigned").length,
          pendingCredentials: nurses.filter((nurse) => nurse.verification_status === "pending").length,
          readyProfessionals: nurses.filter((nurse) => nurse.verification_status === "approved").length
        });
        setPriorityJobs(jobs.filter((job) => job.status === "open").slice(0, 3));
        setPendingNurses(nurses.filter((nurse) => nurse.verification_status === "pending").slice(0, 3));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong");
      }
    };

    load();
  }, []);

  return (
    <>
    <section className="hero-panel operations-hero">
      <div>
        <p className="eyebrow">Operations command center</p>
        <h2>Know what needs attention—and who should handle it next.</h2>
        <p>Prioritize new care requests, credential reviews, and active assignments from one focused workspace.</p>
      </div>
      <div className="hero-actions">
        <Link className="button coral" href="/jobs">Review care queue</Link>
        <Link className="button ghost" href="/nurses">Open credentialing</Link>
      </div>
    </section>

    <section className="dashboard-section">
      <div className="section-heading"><div><p className="eyebrow">Right now</p><h2>Operations pulse</h2></div><span className="live-pill"><i /> Live data</span></div>

      {error ? (
        <p className="notice">
          {error} <Link href="/login">Go to login</Link>.
        </p>
      ) : null}

      <div className="cards">
        <Link className="card priority-card" href="/jobs">
          <div className="label">Needs review</div>
          <div className="value">{overview?.openRequests ?? 0}</div>
          <p>Open care requests awaiting coordination</p>
          <span className="card-link">Open queue →</span>
        </Link>
        <Link className="card" href="/nurses">
          <div className="label">Credential decisions</div>
          <div className="value">{overview?.pendingCredentials ?? 0}</div>
          <p>Professionals awaiting operator review</p>
          <span className="card-link">Review →</span>
        </Link>
        <Link className="card" href="/jobs">
          <div className="label">Care in progress</div>
          <div className="value">{overview?.assignedRequests ?? 0}</div>
          <p>Assigned requests being actively coordinated</p>
          <span className="card-link">Monitor →</span>
        </Link>
        <Link className="card" href="/nurses">
          <div className="label">Ready professionals</div>
          <div className="value">{overview?.readyProfessionals ?? 0}</div>
          <p>Approved for closed-beta opportunities</p>
          <span className="card-link">View team →</span>
        </Link>
      </div>
    </section>

    <div className="dashboard-grid">
      <section className="queue-panel">
        <div className="section-heading">
          <div><p className="eyebrow">Dispatch queue</p><h2>Care requests to review</h2></div>
          <Link href="/jobs">View all</Link>
        </div>
        <div className="work-list">
          {priorityJobs.length === 0 ? <div className="empty-state"><strong>Queue is clear</strong><p>No open care requests need review.</p></div> : priorityJobs.map((job) => (
            <Link className="work-row" href={`/jobs/${job.id}`} key={job.id}>
              <span className="work-icon request-icon">↗</span>
              <span className="work-copy"><strong>{job.title}</strong><small>{job.applicant_count} applicant{job.applicant_count === 1 ? "" : "s"} · {relativeAge(job.created_at)}</small></span>
              <span className="badge">Open</span>
              <span className="chevron">›</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="queue-panel">
        <div className="section-heading">
          <div><p className="eyebrow">Trust & safety</p><h2>Credential reviews</h2></div>
          <Link href="/nurses">View all</Link>
        </div>
        <div className="work-list">
          {pendingNurses.length === 0 ? <div className="empty-state"><strong>Reviews are current</strong><p>No pending credential decisions.</p></div> : pendingNurses.map((nurse) => (
            <Link className="work-row" href="/nurses" key={nurse.id}>
              <span className="work-icon person-icon">✓</span>
              <span className="work-copy"><strong>{nurse.profile_name ?? "Unnamed professional"}</strong><small>Submitted {relativeAge(nurse.created_at)}</small></span>
              <span className="badge pending">Pending</span>
              <span className="chevron">›</span>
            </Link>
          ))}
        </div>
      </section>
    </div>

    <section className="team-readiness">
      <div><p className="eyebrow">Team readiness</p><h2>Built for one operator today, structured for a team tomorrow.</h2><p>This workspace separates dispatch, credentialing, and people operations. The next release adds enforced case claiming and handoffs so two operators cannot work the same item unnoticed.</p></div>
      <div className="readiness-points">
        <span><i>1</i><strong>One queue</strong><small>Shared operational truth</small></span>
        <span><i>2</i><strong>Clear ownership</strong><small>Next implementation</small></span>
        <span><i>3</i><strong>Auditable actions</strong><small>Already recorded</small></span>
      </div>
    </section>
    </>
  );
}
