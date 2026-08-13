import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  canApplyToJob,
  canAssignJob,
  buildAssignmentNotifications,
  buildTerminalJobNotifications,
  canCancelJob,
  canCompleteJob,
  canRecordVisitEvent,
  canSubmitPatientFeedback,
  canSubmitVisitReport,
  canSelectApplication,
  canWithdrawApplication,
  createAssignmentCommandPlan,
  createCancelJobCommandPlan,
  createCompleteJobCommandPlan,
  createAssignmentApplicationPlan,
  getCancelJobDecision,
  getCompleteJobDecision,
  getWorkflowErrorHttpStatus,
  isJobStatus,
  isTerminalJobStatus,
  isWorkflowErrorCategory,
  workflowErrorCategories
} from "../dist/workflow.js";

describe("shared workflow rules", () => {
  it("identifies canonical and terminal job statuses", () => {
    assert.equal(isJobStatus("open"), true);
    assert.equal(isJobStatus("assigned"), true);
    assert.equal(isJobStatus("completed"), true);
    assert.equal(isJobStatus("cancelled"), true);
    assert.equal(isJobStatus("pending_dispatch"), false);

    assert.equal(isTerminalJobStatus("open"), false);
    assert.equal(isTerminalJobStatus("assigned"), false);
    assert.equal(isTerminalJobStatus("completed"), true);
    assert.equal(isTerminalJobStatus("cancelled"), true);
  });

  it("keeps job lifecycle actions inside the closed-beta workflow", () => {
    assert.equal(canCancelJob("open"), true);
    assert.equal(canCancelJob("assigned"), true);
    assert.equal(canCancelJob("completed"), false);
    assert.equal(canCancelJob("cancelled"), false);

    assert.equal(canCompleteJob("open", false), false);
    assert.equal(canCompleteJob("assigned", false), false);
    assert.equal(canCompleteJob("assigned", true), true);
    assert.equal(canCompleteJob("completed", true), false);

    assert.equal(canApplyToJob("open"), true);
    assert.equal(canApplyToJob("assigned"), false);
    assert.equal(canAssignJob("open"), true);
    assert.equal(canAssignJob("cancelled"), false);
  });

  it("keeps application transitions guarded", () => {
    assert.equal(canSelectApplication("applied"), true);
    assert.equal(canSelectApplication("accepted"), false);
    assert.equal(canSelectApplication("rejected"), false);
    assert.equal(canSelectApplication("withdrawn"), false);

    assert.equal(canWithdrawApplication("applied"), true);
    assert.equal(canWithdrawApplication("accepted"), false);
    assert.equal(canWithdrawApplication("rejected"), false);
    assert.equal(canWithdrawApplication("withdrawn"), false);
  });

  it("classifies cancel job decisions for patient, admin, and forbidden actors", () => {
    assert.equal(
      getCancelJobDecision({
        actorRole: "patient",
        actorUserId: "patient-1",
        jobStatus: "open",
        patientUserId: "patient-1"
      }),
      null
    );
    assert.equal(
      getCancelJobDecision({
        actorRole: "patient",
        actorUserId: "patient-2",
        jobStatus: "open",
        patientUserId: "patient-1"
      }),
      "forbidden"
    );
    assert.equal(
      getCancelJobDecision({
        actorRole: "admin",
        actorUserId: "admin-1",
        jobStatus: "completed",
        patientUserId: "patient-1"
      }),
      "invalid_transition"
    );
    assert.equal(
      getCancelJobDecision({
        actorRole: "nurse",
        actorUserId: "nurse-1",
        jobStatus: "assigned",
        patientUserId: "patient-1"
      }),
      "forbidden"
    );
  });

  it("allows only the accepted nurse or an admin to complete assigned care", () => {
    assert.equal(
      getCompleteJobDecision({
        actorRole: "patient",
        actorUserId: "patient-1",
        jobStatus: "assigned",
        patientUserId: "patient-1",
        acceptedNurseUserId: "nurse-1"
      }),
      "forbidden"
    );
    assert.equal(
      getCompleteJobDecision({
        actorRole: "nurse",
        actorUserId: "nurse-1",
        jobStatus: "assigned",
        patientUserId: "patient-1",
        acceptedNurseUserId: "nurse-1"
      }),
      null
    );
    assert.equal(
      getCompleteJobDecision({
        actorRole: "admin",
        actorUserId: "admin-1",
        jobStatus: "assigned",
        patientUserId: "patient-1",
        acceptedNurseUserId: "nurse-1"
      }),
      null
    );
    assert.equal(
      getCompleteJobDecision({
        actorRole: "nurse",
        actorUserId: "nurse-2",
        jobStatus: "assigned",
        patientUserId: "patient-1",
        acceptedNurseUserId: "nurse-1"
      }),
      "forbidden"
    );
    assert.equal(
      getCompleteJobDecision({
        actorRole: "patient",
        actorUserId: "patient-2",
        jobStatus: "assigned",
        patientUserId: "patient-1",
        acceptedNurseUserId: "nurse-1"
      }),
      "forbidden"
    );
    assert.equal(
      getCompleteJobDecision({
        actorRole: "admin",
        actorUserId: "admin-1",
        jobStatus: "open",
        patientUserId: "patient-1",
        acceptedNurseUserId: "nurse-1"
      }),
      "invalid_transition"
    );
    assert.equal(
      getCompleteJobDecision({
        actorRole: "admin",
        actorUserId: "admin-1",
        jobStatus: "assigned",
        patientUserId: "patient-1",
        acceptedNurseUserId: null
      }),
      "invalid_transition"
    );
  });

  it("plans assignment application selection and rejection recipients", () => {
    const plan = createAssignmentApplicationPlan(
      [
        { id: "app-1", nurse_user_id: "nurse-1", status: "applied" },
        { id: "app-2", nurse_user_id: "nurse-2", status: "applied" },
        { id: "app-3", nurse_user_id: "nurse-3", status: "withdrawn" },
        { id: "app-4", nurse_user_id: null, status: "applied" }
      ],
      "nurse-1"
    );

    assert.equal(plan.selectedApplication?.id, "app-1");
    assert.equal(plan.selectedApplicationSelectable, true);
    assert.deepEqual(plan.rejectedNurseIds, ["nurse-2"]);
  });

  it("plans assignment command side effects for selected and competing applications", () => {
    const plan = createAssignmentCommandPlan({
      applications: [
        { id: "app-1", nurse_user_id: "nurse-1", status: "applied" },
        { id: "app-2", nurse_user_id: "nurse-2", status: "applied" },
        { id: "app-3", nurse_user_id: "nurse-3", status: "withdrawn" }
      ],
      jobId: "job-1",
      jobTitle: "Morning care",
      selectedNurseUserId: "nurse-1",
      actorRole: "admin"
    });

    assert.equal(plan.selectedApplication?.id, "app-1");
    assert.equal(plan.acceptSelectedApplication, true);
    assert.equal(plan.rejectCompetingApplications, true);
    assert.deepEqual(plan.rejectedNurseIds, ["nurse-2"]);
    assert.deepEqual(
      plan.notifications.map((notification) => [notification.userId, notification.type]),
      [
        ["nurse-1", "job_assigned"],
        ["nurse-2", "application_rejected"]
      ]
    );
    assert.deepEqual(plan.audit, { action: "job_assigned", metadata: { nurse_user_id: "nurse-1" } });
  });

  it("does not plan assignment writes or side effects for an unselectable application", () => {
    const plan = createAssignmentCommandPlan({
      applications: [{ id: "app-1", nurse_user_id: "nurse-1", status: "withdrawn" }],
      jobId: "job-1",
      jobTitle: "Morning care",
      selectedNurseUserId: "nurse-1",
      actorRole: "admin"
    });

    assert.equal(plan.selectedApplication?.id, "app-1");
    assert.equal(plan.selectedApplicationSelectable, false);
    assert.equal(plan.acceptSelectedApplication, false);
    assert.equal(plan.rejectCompetingApplications, false);
    assert.deepEqual(plan.rejectedNurseIds, []);
    assert.deepEqual(plan.notifications, []);
    assert.equal(plan.audit, null);
  });

  it("plans cancel terminal command side effects", () => {
    const plan = createCancelJobCommandPlan({
      actorRole: "admin",
      actorUserId: "admin-1",
      jobStatus: "open",
      patientUserId: "patient-1",
      applications: [
        { nurse_user_id: "nurse-1", status: "applied" },
        { nurse_user_id: "nurse-2", status: "accepted" },
        { nurse_user_id: "nurse-3", status: "withdrawn" },
        { nurse_user_id: null, status: "applied" }
      ]
    });

    assert.equal(plan.decision, null);
    assert.equal(plan.nextStatus, "cancelled");
    assert.equal(plan.rejectAppliedApplications, true);
    assert.deepEqual(plan.notificationNurseUserIds, ["nurse-1", "nurse-2"]);
    assert.deepEqual(plan.audit, { action: "job_cancelled", metadata: { previous_status: "open" } });

    const blocked = createCancelJobCommandPlan({
      actorRole: "nurse",
      actorUserId: "nurse-1",
      jobStatus: "open",
      patientUserId: "patient-1",
      applications: [{ nurse_user_id: "nurse-1", status: "applied" }]
    });

    assert.equal(blocked.decision, "forbidden");
    assert.equal(blocked.rejectAppliedApplications, false);
    assert.deepEqual(blocked.notificationNurseUserIds, []);
    assert.equal(blocked.audit, null);
  });

  it("plans complete terminal command side effects", () => {
    const plan = createCompleteJobCommandPlan({
      actorRole: "admin",
      actorUserId: "admin-1",
      jobStatus: "assigned",
      patientUserId: "patient-1",
      acceptedNurseUserId: "nurse-1"
    });

    assert.equal(plan.decision, null);
    assert.equal(plan.nextStatus, "completed");
    assert.deepEqual(plan.notificationNurseUserIds, ["nurse-1"]);
    assert.deepEqual(plan.audit, {
      action: "job_completed",
      metadata: { previous_status: "assigned", nurse_user_id: "nurse-1" }
    });

    const blocked = createCompleteJobCommandPlan({
      actorRole: "admin",
      actorUserId: "admin-1",
      jobStatus: "assigned",
      patientUserId: "patient-1",
      acceptedNurseUserId: null
    });

    assert.equal(blocked.decision, "invalid_transition");
    assert.deepEqual(blocked.notificationNurseUserIds, []);
    assert.equal(blocked.audit, null);
  });

  it("builds assignment notifications from the shared assignment plan", () => {
    const notifications = buildAssignmentNotifications({
      jobId: "job-1",
      jobTitle: "Morning care",
      selectedNurseUserId: "nurse-1",
      rejectedNurseIds: ["nurse-2"]
    });

    assert.deepEqual(
      notifications.map((notification) => [notification.userId, notification.type, notification.body]),
      [
        ["nurse-1", "job_assigned", "A care request has been assigned to you."],
        ["nurse-2", "application_rejected", "A care request was assigned to another nurse or caregiver."]
      ]
    );
  });

  it("builds terminal job notifications for patients and active nurses", () => {
    const notifications = buildTerminalJobNotifications({
      jobId: "job-1",
      jobTitle: "Morning care",
      patientUserId: "patient-1",
      status: "cancelled",
      nurseUserIds: ["nurse-1", "nurse-1", ""]
    });

    assert.deepEqual(
      notifications.map((notification) => [notification.userId, notification.type, notification.body]),
      [
        ["patient-1", "job_cancelled", "A care request is now cancelled."],
        ["nurse-1", "assigned_job_cancelled", "A care request is now cancelled."]
      ]
    );
  });

  it("defines stable workflow error categories and HTTP statuses", () => {
    assert.deepEqual(workflowErrorCategories, [
      "unauthorized",
      "forbidden",
      "not_found",
      "invalid_transition",
      "conflict",
      "storage_or_db_error"
    ]);

    assert.equal(isWorkflowErrorCategory("invalid_transition"), true);
    assert.equal(isWorkflowErrorCategory("validation_error"), false);
    assert.equal(getWorkflowErrorHttpStatus("unauthorized"), 401);
    assert.equal(getWorkflowErrorHttpStatus("forbidden"), 403);
    assert.equal(getWorkflowErrorHttpStatus("not_found"), 404);
    assert.equal(getWorkflowErrorHttpStatus("invalid_transition"), 400);
    assert.equal(getWorkflowErrorHttpStatus("conflict"), 409);
    assert.equal(getWorkflowErrorHttpStatus("storage_or_db_error"), 500);
  });

  it("guards visit checkpoints, reporting, and patient feedback", () => {
    assert.equal(canRecordVisitEvent({ jobStatus: "assigned", eventType: "pre_visit_confirmed" }), true);
    assert.equal(canRecordVisitEvent({ jobStatus: "assigned", eventType: "arrived", previousEventType: "en_route" }), true);
    assert.equal(canRecordVisitEvent({ jobStatus: "assigned", eventType: "appointment_started", previousEventType: "en_route" }), false);
    assert.equal(canRecordVisitEvent({ jobStatus: "open", eventType: "pre_visit_confirmed" }), false);
    assert.equal(canRecordVisitEvent({ jobStatus: "assigned", eventType: "escalation_requested", previousEventType: "arrived" }), true);
    assert.equal(canSubmitVisitReport({ jobStatus: "assigned", latestEventType: "patient_handoff", visitSummary: "Returned safely." }), true);
    assert.equal(canSubmitVisitReport({ jobStatus: "assigned", latestEventType: "appointment_ended", visitSummary: "Not handed off." }), false);
    assert.equal(canSubmitPatientFeedback({ jobStatus: "completed", rating: 5 }), true);
    assert.equal(canSubmitPatientFeedback({ jobStatus: "assigned", rating: 5 }), false);
  });
});
