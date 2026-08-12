import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildJobTimeline, resolveAssignedNurseId } from "../lib/jobDetailView";

describe("admin job detail view", () => {
  it("prefers the persisted job assignment and falls back to the accepted application", () => {
    assert.equal(
      resolveAssignedNurseId(
        {
          id: "job-1",
          status: "assigned",
          created_at: "2026-08-10T10:00:00Z",
          assigned_nurse_user_id: "nurse-direct"
        },
        [{ nurse_user_id: "nurse-accepted", status: "accepted" }]
      ),
      "nurse-direct"
    );

    assert.equal(
      resolveAssignedNurseId(
        { id: "job-2", status: "completed", created_at: "2026-08-10T10:00:00Z" },
        [{ nurse_user_id: "nurse-accepted", status: "accepted" }]
      ),
      "nurse-accepted"
    );
  });

  it("adds truthful persisted lifecycle events when audit rows are absent", () => {
    const events = buildJobTimeline({
      job: {
        id: "job-1",
        status: "completed",
        created_at: "2026-08-10T10:00:00Z",
        updated_at: "2026-08-10T12:00:00Z"
      },
      auditEvents: [],
      identityLabels: new Map(),
      patientName: "Patient One"
    });

    assert.deepEqual(events, [
      {
        id: "job-created-job-1",
        type: "job_created",
        created_at: "2026-08-10T10:00:00Z",
        actor_name: "Patient One"
      },
      {
        id: "job-status-job-1-completed",
        type: "job_completed",
        created_at: "2026-08-10T12:00:00Z",
        actor_name: "System record"
      }
    ]);
  });

  it("preserves audit events and does not duplicate a recorded current status", () => {
    const events = buildJobTimeline({
      job: {
        id: "job-1",
        status: "assigned",
        created_at: "2026-08-10T10:00:00Z",
        updated_at: "2026-08-10T11:00:00Z"
      },
      auditEvents: [
        {
          id: "audit-1",
          action: "job_assigned",
          actor_id: "admin-1",
          created_at: "2026-08-10T11:00:00Z"
        }
      ],
      identityLabels: new Map([["admin-1", "Admin One"]]),
      patientName: null
    });

    assert.equal(events.filter((event) => event.type === "job_assigned").length, 1);
    assert.equal(events[1]?.actor_name, "Admin One");
  });
});
