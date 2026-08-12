"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { adminFetch, getAdminAccessToken } from "../../../lib/adminAuthClient";

type JobDetail = {
  id: string;
  status: string;
  title: string;
  description: string | null;
  address: string | null;
  service_city: string | null;
  service_state: string | null;
  start_time: string | null;
  hourly_rate: number | null;
  created_at: string;
  patient_name: string | null;
  nurse_user_id: string | null;
  nurse_name: string | null;
  logistics: JobLogistics | null;
};

type JobLogistics = {
  residence_type: string;
  street_address: string;
  unit: string | null;
  building_name: string | null;
  city: string;
  state: string;
  postal_code: string;
  stairs: string;
  elevator_available: boolean | null;
  meeting_point: string | null;
  parking_notes: string | null;
  arrival_instructions: string | null;
  mobility_aids: string[];
  mobility_notes: string | null;
  onsite_contact_name: string | null;
  onsite_contact_relationship: string | null;
  onsite_contact_phone: string | null;
  transportation_mode: string;
  transportation_provider: string | null;
  pickup_time: string | null;
  return_plan: string;
  transportation_notes: string | null;
};

type EventRow = {
  id: string;
  type: string;
  created_at: string;
  actor_name: string | null;
};

type ApplicationRow = {
  job_id: string;
  nurse_user_id: string;
  nurse_name: string | null;
  status: string;
  verification_status: string;
  created_at: string;
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

function formatEventType(value: string) {
  return value
    .replace(/^job_/, "")
    .replaceAll("_", " ")
    .replace(/^./, (letter) => letter.toUpperCase());
}

function label(value: string | null | undefined) {
  return value ? value.replaceAll("_", " ") : "-";
}

function joined(values: Array<string | null | undefined>) {
  return values.filter(Boolean).join(" · ") || "-";
}

export default function JobDetailPage() {
  const params = useParams();
  const jobId = params.id as string;
  const [job, setJob] = useState<JobDetail | null>(null);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [applications, setApplications] = useState<ApplicationRow[]>([]);
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
    setApplications((data.applications ?? []) as ApplicationRow[]);
    setSelectedNurse("");
  };

  useEffect(() => {
    void load();
  }, [jobId]);

  const assignApplicant = async (nurseId: string) => {
    setSelectedNurse(nurseId);

    const token = getAdminAccessToken();
    if (!token) {
      setError("Please sign in.");
      return;
    }

    const res = await adminFetch("/api/admin/jobs/assign", {
      method: "POST",
      body: JSON.stringify({ job_id: jobId, nurse_id: nurseId })
    });

    if (!res.ok) {
      setError("Unable to assign nurse.");
      return;
    }

    await load();
  };

  const updateJobStatus = async (status: "cancelled" | "completed") => {
    const token = getAdminAccessToken();
    if (!token) {
      setError("Please sign in.");
      return;
    }

    const res = await adminFetch(`/api/admin/jobs/${jobId}`, {
      method: "PATCH",
      body: JSON.stringify({ status })
    });

    if (!res.ok) {
      setError("Unable to update job.");
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
            <p>Nurse: {job.nurse_name ?? job.nurse_user_id ?? "Unassigned"}</p>
            <p>Service area: {[job.service_city, job.service_state].filter(Boolean).join(", ") || "-"}</p>
            <p>Start: {formatDateTime(job.start_time)}</p>
            <p>Rate: {formatRate(job.hourly_rate)}</p>
            <p>Created: {formatDateTime(job.created_at)}</p>
            <p>Description: {job.description ?? "-"}</p>
            {job.logistics ? (
              <>
                <h3>Private residence and arrival</h3>
                <p>Residence: {label(job.logistics.residence_type)}</p>
                <p>Address: {joined([job.logistics.building_name, job.logistics.street_address, job.logistics.unit ? `Unit ${job.logistics.unit}` : null, job.logistics.city, job.logistics.state, job.logistics.postal_code])}</p>
                <p>Stairs / elevator: {joined([label(job.logistics.stairs), job.logistics.elevator_available === null ? null : job.logistics.elevator_available ? "Elevator available" : "No elevator"])}</p>
                <p>Meeting point: {job.logistics.meeting_point ?? "-"}</p>
                <p>Parking: {job.logistics.parking_notes ?? "-"}</p>
                <p>Arrival instructions: {job.logistics.arrival_instructions ?? "-"}</p>
                <h3>Mobility and contact</h3>
                <p>Mobility aids: {job.logistics.mobility_aids.length ? job.logistics.mobility_aids.map(label).join(", ") : "None reported"}</p>
                <p>Mobility notes: {job.logistics.mobility_notes ?? "-"}</p>
                <p>On-site contact: {joined([job.logistics.onsite_contact_name, job.logistics.onsite_contact_relationship, job.logistics.onsite_contact_phone])}</p>
                <h3>Transportation</h3>
                <p>Outbound plan: {joined([label(job.logistics.transportation_mode), job.logistics.transportation_provider])}</p>
                <p>Pickup: {formatDateTime(job.logistics.pickup_time)}</p>
                <p>Return plan: {label(job.logistics.return_plan)}</p>
                <p>Notes: {job.logistics.transportation_notes ?? "-"}</p>
              </>
            ) : <p>Structured logistics have not been recorded for this legacy request.</p>}
            <div className="actions">
              <button
                className="button"
                onClick={() => updateJobStatus("cancelled")}
                disabled={job.status !== "open" && job.status !== "assigned"}
              >
                Cancel Job
              </button>
              <button
                className="button"
                onClick={() => updateJobStatus("completed")}
                disabled={job.status !== "assigned"}
              >
                Complete Job
              </button>
            </div>
          </div>
          <div>
            <h3>Applicants</h3>
            {applications.length === 0 ? (
              <p>No nurse applications yet.</p>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Nurse</th>
                    <th>Application</th>
                    <th>Verification</th>
                    <th>Applied</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {applications.map((application) => {
                    const canAssign =
                      job.status === "open" &&
                      application.status === "applied" &&
                      application.verification_status === "approved";
                    return (
                      <tr key={application.nurse_user_id}>
                        <td>{application.nurse_name ?? application.nurse_user_id}</td>
                        <td>
                          <span className="badge">{application.status}</span>
                        </td>
                        <td>
                          <span className="badge">{application.verification_status}</span>
                        </td>
                        <td>{new Date(application.created_at).toLocaleString()}</td>
                        <td>
                          <button
                            className="button"
                            onClick={() => assignApplicant(application.nurse_user_id)}
                            disabled={!canAssign || selectedNurse === application.nurse_user_id}
                          >
                            {application.status === "accepted" ? "Assigned" : "Assign"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
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
                      <td>{formatEventType(event.type)}</td>
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
