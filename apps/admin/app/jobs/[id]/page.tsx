"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { adminFetch, getAdminAccessToken } from "../../../lib/adminAuthClient";

type JobDetail = {
  id: string;
  status: string;
  title: string;
  description: string | null;
  created_at: string;
  patient_name: string | null;
  nurse_name: string | null;
};

type EventRow = {
  id: string;
  type: string;
  created_at: string;
  actor_name: string | null;
};

type NurseRow = {
  id: string;
  profile_name: string | null;
  verified: boolean;
};

export default function JobDetailPage() {
  const params = useParams();
  const jobId = params.id as string;
  const [job, setJob] = useState<JobDetail | null>(null);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [nurses, setNurses] = useState<NurseRow[]>([]);
  const [selectedNurse, setSelectedNurse] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    const token = getAdminAccessToken();
    if (!token) {
      setError("Please sign in.");
      return;
    }

    const res = await adminFetch(`/api/admin/jobs/${jobId}`);

    if (!res.ok) {
      setError("Unable to load job.");
      return;
    }

    const data = await res.json();
    setJob(data.job as JobDetail);
    setEvents(data.events as EventRow[]);

    const nurseRes = await adminFetch("/api/admin/nurses");

    if (nurseRes.ok) {
      const nurseData = (await nurseRes.json()) as NurseRow[];
      setNurses(nurseData);
    }
  };

  useEffect(() => {
    void load();
  }, [jobId]);

  const assignNurse = async () => {
    const token = getAdminAccessToken();
    if (!token) {
      setError("Please sign in.");
      return;
    }

    const res = await adminFetch("/api/admin/jobs/assign", {
      method: "POST",
      body: JSON.stringify({ job_id: jobId, nurse_id: selectedNurse })
    });

    if (!res.ok) {
      setError("Unable to assign nurse.");
      return;
    }

    await load();
  };

  return (
    <section>
      <h2>Job Detail</h2>
      {error ? <p className="notice">{error}</p> : null}
      {job ? (
        <div className="grid two">
          <div>
            <h3>{job.title}</h3>
            <p>Status: {job.status}</p>
            <p>Patient: {job.patient_name ?? "-"}</p>
            <p>Nurse: {job.nurse_name ?? "Unassigned"}</p>
            <p>Created: {new Date(job.created_at).toLocaleString()}</p>
            <p>Description: {job.description ?? "-"}</p>
          </div>
          <div>
            <h3>Assign Nurse</h3>
            <select
              className="input"
              value={selectedNurse}
              onChange={(event) => setSelectedNurse(event.target.value)}
            >
              <option value="">Select nurse</option>
              {nurses.map((nurse) => (
                <option key={nurse.id} value={nurse.id}>
                  {nurse.profile_name ?? nurse.id} {nurse.verified ? "(verified)" : ""}
                </option>
              ))}
            </select>
            <button className="button" onClick={assignNurse} disabled={!selectedNurse}>
              Assign Nurse
            </button>
          </div>
          <div>
            <h3>Status Timeline</h3>
            {events.length === 0 ? (
              <p>No events yet.</p>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Event</th>
                    <th>Actor</th>
                  </tr>
                </thead>
                <tbody>
                  {events.map((event) => (
                    <tr key={event.id}>
                      <td>{new Date(event.created_at).toLocaleString()}</td>
                      <td>{event.type}</td>
                      <td>{event.actor_name ?? "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      ) : (
        <p>Loading...</p>
      )}
    </section>
  );
}
