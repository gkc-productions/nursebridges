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

type VisitOperations = {
  events: Array<{
    id: string;
    event_type: string;
    occurred_at: string;
    patient_visible: boolean;
    note: string | null;
  }>;
  report: {
    status: string;
    visit_summary: string | null;
    provider_instructions: string | null;
    follow_up_tasks: string | null;
    transportation_outcome: string | null;
    submitted_at: string | null;
  } | null;
  feedback: {
    rating: number;
    comments: string | null;
    would_rebook: boolean | null;
    prefer_same_nurse: boolean;
    updated_at: string;
  } | null;
  care_circle: Array<{
    id: string;
    display_name: string;
    relationship: string;
    receive_milestones: boolean;
    receive_summary: boolean;
    consented_at: string;
  }>;
};

const emptyVisitOperations: VisitOperations = {
  events: [],
  report: null,
  feedback: null,
  care_circle: []
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
  const [visit, setVisit] = useState<VisitOperations>(emptyVisitOperations);
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
    setVisit((data.visit ?? emptyVisitOperations) as VisitOperations);
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
      <div className="detail-heading">
        <div>
          <p className="eyebrow">Care coordination</p>
          <h2>Care request detail</h2>
          <p>Review the request, arrival plan, transportation, applicants, and activity before taking action.</p>
        </div>
        {job ? <span className="badge detail-status">{label(job.status)}</span> : null}
      </div>
      {error ? <p className="notice">{error}</p> : null}
      {!job && !error ? (
        <div className="loading-state" role="status" aria-live="polite">
          <span className="loading-indicator" aria-hidden="true" />
          <div>
            <strong>Loading care request</strong>
            <p>Retrieving coordination details and the latest activity.</p>
          </div>
        </div>
      ) : null}
      {job ? (
        <div className="request-detail-grid">
          <article className="detail-panel request-summary-panel">
            <h3>{job.title}</h3>
            <dl className="detail-list">
              <div><dt>Patient</dt><dd>{job.patient_name ?? "-"}</dd></div>
              <div><dt>Assigned nurse</dt><dd>{job.nurse_name ?? job.nurse_user_id ?? "Unassigned"}</dd></div>
              <div><dt>Service area</dt><dd>{[job.service_city, job.service_state].filter(Boolean).join(", ") || "-"}</dd></div>
              <div><dt>Appointment</dt><dd>{formatDateTime(job.start_time)}</dd></div>
              <div><dt>Legacy rate field</dt><dd>{formatRate(job.hourly_rate)}</dd></div>
              <div><dt>Requested</dt><dd>{formatDateTime(job.created_at)}</dd></div>
            </dl>
            <div className="detail-note"><span>Request notes</span><p>{job.description ?? "No additional notes provided."}</p></div>
          </article>

          <article className="detail-panel request-actions-panel">
            <p className="label">Request controls</p>
            <h3>Coordinate next steps</h3>
            <p>Actions are available only when the current care-request status allows them.</p>
            <div className="actions">
              <button
                className="button secondary"
                onClick={() => updateJobStatus("cancelled")}
                disabled={job.status !== "open" && job.status !== "assigned"}
              >
                Cancel request
              </button>
              <button
                className="button"
                onClick={() => updateJobStatus("completed")}
                disabled={
                  job.status !== "assigned" ||
                  !visit.events.some((event) => event.event_type === "visit_completed") ||
                  (visit.report?.status !== "submitted" && visit.report?.status !== "amended")
                }
              >
                Complete care
              </button>
            </div>
            {job.status === "assigned" && (!visit.events.some((event) => event.event_type === "visit_completed") || !visit.report || visit.report.status === "draft") ? (
              <p className="notice">Completion unlocks after the nurse submits the report and records the final visit checkpoint.</p>
            ) : null}
          </article>

          <div className="detail-span-full logistics-grid">
            {job.logistics ? (
              <>
                <article className="detail-panel logistics-panel">
                  <p className="label">Arrival plan</p>
                  <h3>Residence and access</h3>
                  <dl className="detail-list compact">
                    <div><dt>Residence</dt><dd>{label(job.logistics.residence_type)}</dd></div>
                    <div><dt>Address</dt><dd>{joined([job.logistics.building_name, job.logistics.street_address, job.logistics.unit ? `Unit ${job.logistics.unit}` : null, job.logistics.city, job.logistics.state, job.logistics.postal_code])}</dd></div>
                    <div><dt>Stairs / elevator</dt><dd>{joined([label(job.logistics.stairs), job.logistics.elevator_available === null ? null : job.logistics.elevator_available ? "Elevator available" : "No elevator"])}</dd></div>
                    <div><dt>Meeting point</dt><dd>{job.logistics.meeting_point ?? "-"}</dd></div>
                    <div><dt>Parking</dt><dd>{job.logistics.parking_notes ?? "-"}</dd></div>
                    <div><dt>Arrival instructions</dt><dd>{job.logistics.arrival_instructions ?? "-"}</dd></div>
                  </dl>
                </article>
                <article className="detail-panel logistics-panel">
                  <p className="label">Patient support</p>
                  <h3>Mobility and contact</h3>
                  <dl className="detail-list compact">
                    <div><dt>Mobility aids</dt><dd>{job.logistics.mobility_aids.length ? job.logistics.mobility_aids.map(label).join(", ") : "None reported"}</dd></div>
                    <div><dt>Mobility notes</dt><dd>{job.logistics.mobility_notes ?? "-"}</dd></div>
                    <div><dt>On-site contact</dt><dd>{joined([job.logistics.onsite_contact_name, job.logistics.onsite_contact_relationship, job.logistics.onsite_contact_phone])}</dd></div>
                  </dl>
                </article>
                <article className="detail-panel logistics-panel">
                  <p className="label">Travel plan</p>
                  <h3>Transportation</h3>
                  <dl className="detail-list compact">
                    <div><dt>Outbound plan</dt><dd>{joined([label(job.logistics.transportation_mode), job.logistics.transportation_provider])}</dd></div>
                    <div><dt>Pickup</dt><dd>{formatDateTime(job.logistics.pickup_time)}</dd></div>
                    <div><dt>Return plan</dt><dd>{label(job.logistics.return_plan)}</dd></div>
                    <div><dt>Notes</dt><dd>{job.logistics.transportation_notes ?? "-"}</dd></div>
                  </dl>
                </article>
              </>
            ) : <article className="detail-panel"><p>Structured logistics have not been recorded for this legacy request.</p></article>}
          </div>

          <article className="detail-panel detail-span-full">
            <p className="label">Live operations</p>
            <h3>Visit execution timeline</h3>
            {visit.events.length === 0 ? (
              <p>No visit checkpoints have been recorded.</p>
            ) : (
              <table>
                <thead><tr><th>Time</th><th>Checkpoint</th><th>Patient visible</th><th>Operational note</th></tr></thead>
                <tbody>
                  {visit.events.map((event) => (
                    <tr key={event.id}>
                      <td>{formatDateTime(event.occurred_at)}</td>
                      <td>{formatEventType(event.event_type)}</td>
                      <td>{event.patient_visible ? "Yes" : "No"}</td>
                      <td>{event.note ?? "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </article>

          <article className="detail-panel">
            <p className="label">Nurse documentation</p>
            <h3>Visit report</h3>
            {visit.report ? (
              <dl className="detail-list compact">
                <div><dt>Status</dt><dd>{label(visit.report.status)}</dd></div>
                <div><dt>Visit summary</dt><dd>{visit.report.visit_summary ?? "-"}</dd></div>
                <div><dt>Provider instructions</dt><dd>{visit.report.provider_instructions ?? "-"}</dd></div>
                <div><dt>Follow-up tasks</dt><dd>{visit.report.follow_up_tasks ?? "-"}</dd></div>
                <div><dt>Transportation outcome</dt><dd>{visit.report.transportation_outcome ?? "-"}</dd></div>
                <div><dt>Submitted</dt><dd>{formatDateTime(visit.report.submitted_at)}</dd></div>
              </dl>
            ) : <p>No report has been started.</p>}
          </article>

          <article className="detail-panel">
            <p className="label">Patient experience</p>
            <h3>Feedback and rebooking</h3>
            {visit.feedback ? (
              <dl className="detail-list compact">
                <div><dt>Rating</dt><dd>{visit.feedback.rating} / 5</dd></div>
                <div><dt>Would rebook</dt><dd>{visit.feedback.would_rebook === null ? "Not answered" : visit.feedback.would_rebook ? "Yes" : "No"}</dd></div>
                <div><dt>Same nurse preferred</dt><dd>{visit.feedback.prefer_same_nurse ? "Yes" : "No"}</dd></div>
                <div><dt>Private feedback</dt><dd>{visit.feedback.comments ?? "-"}</dd></div>
              </dl>
            ) : <p>No patient feedback has been submitted.</p>}
          </article>

          <article className="detail-panel detail-span-full">
            <p className="label">Consent registry</p>
            <h3>Care circle</h3>
            {visit.care_circle.length === 0 ? <p>No active care-circle consent is recorded.</p> : (
              <table>
                <thead><tr><th>Recipient</th><th>Relationship</th><th>Authorized updates</th><th>Consented</th></tr></thead>
                <tbody>{visit.care_circle.map((recipient) => (
                  <tr key={recipient.id}>
                    <td>{recipient.display_name}</td>
                    <td>{recipient.relationship}</td>
                    <td>{[recipient.receive_milestones ? "Milestones" : null, recipient.receive_summary ? "Summary" : null].filter(Boolean).join(" and ")}</td>
                    <td>{formatDateTime(recipient.consented_at)}</td>
                  </tr>
                ))}</tbody>
              </table>
            )}
          </article>

          <article className="detail-panel detail-span-full">
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
          </article>
          <article className="detail-panel detail-span-full">
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
          </article>
        </div>
      ) : null}
    </section>
  );
}
