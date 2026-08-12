import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildVerificationStoragePath,
  buildNurseRequestDetailModel,
  buildNurseWorkflowSnapshot,
  buildPatientWorkflowSnapshot,
  buildWorkflowEvidenceSummary,
  buildPatientRequestDetailModel,
  buildCreateCareRequestPayload,
  buildCareRequestTransitionConfirmation,
  careRequestProgressSummary,
  careRequestStatusLabel,
  canApplyToCareRequest,
  canApplyToJobStatus,
  canAssignJobStatus,
  canCancelJob,
  canCancelJobStatus,
  canCompleteJob,
  canCompleteJobStatus,
  canSelectApplication,
  emptyJobForm,
  formatDate,
  formatRate,
  isJobStatus,
  latestByCreatedAt,
  nurseEmptyStateCopy,
  nurseApplicationStateLabel,
  parseStartTimeInput,
  patientEmptyStateCopy,
  pickNurseFocusJob,
  pickPatientFocusJob,
  terminalJobStatus
} from "../src/workflow";
import { isLocalhostBaseUrl, normalizeBaseUrl, shouldFallbackFromLocalhost } from "../src/envCore";

describe("mobile workflow helpers", () => {
  it("normalizes start time input for create-job requests", () => {
    assert.equal(parseStartTimeInput(""), undefined);
    assert.equal(parseStartTimeInput("   "), undefined);
    assert.equal(parseStartTimeInput("not a date"), null);
    assert.equal(parseStartTimeInput("2026-05-01T14:00:00Z"), "2026-05-01T14:00:00.000Z");
  });

  it("builds patient-safe create request payloads without ownership or patient-set pricing fields", () => {
    const result = buildCreateCareRequestPayload({
      ...emptyJobForm,
      title: " Morning appointment support ",
      description: " Help getting ready and into the car. ",
      mobility_notes: " Uses a walker. ",
      street_address: " 123 Test Street ",
      unit: "4B",
      city: "Atlanta",
      postal_code: "30303",
      onsite_contact_name: "Daughter",
      onsite_contact_relationship: "Family",
      mobility_aids: ["walker"],
      start_time: "2026-05-01T14:00:00Z"
    });

    assert.equal(result.ok, true);
    if (!result.ok) assert.fail("Expected valid create request payload.");

    assert.deepEqual(result.payload, {
      title: "Morning appointment support",
      description: "Help getting ready and into the car.",
      start_time: "2026-05-01T14:00:00.000Z",
      logistics: {
        residence_type: "apartment",
        street_address: "123 Test Street",
        unit: "4B",
        city: "Atlanta",
        state: "GA",
        postal_code: "30303",
        stairs: "none",
        mobility_aids: ["walker"],
        mobility_notes: "Uses a walker.",
        onsite_contact_name: "Daughter",
        onsite_contact_relationship: "Family",
        transportation_mode: "not_arranged",
        return_plan: "not_arranged"
      }
    });
    assert.equal("patient_user_id" in result.payload, false);
    assert.equal("patient_id" in result.payload, false);
    assert.equal("created_by" in result.payload, false);
    assert.equal("contact_context" in result.payload, false);
    assert.equal("mobility_notes" in result.payload, false);
    assert.equal("hourly_rate" in result.payload, false);
  });

  it("returns clear create request validation errors", () => {
    assert.deepEqual(
      buildCreateCareRequestPayload({
        ...emptyJobForm,
        title: "  ",
      }),
      { ok: false, error: "Enter the support type or request title. Use at least 3 characters." }
    );
    assert.deepEqual(
      buildCreateCareRequestPayload({
        ...emptyJobForm,
        title: "Check in",
        start_time: "not a date"
      }),
      { ok: false, error: "Use a date within the next two years, or leave it blank. Example: 2026-08-05 10:00 AM." }
    );
  });

  it("formats job fields without crashing on missing or invalid values", () => {
    assert.equal(formatDate(null), "-");
    assert.equal(formatDate("not a date"), "not a date");
    assert.equal(formatRate(null), "-");
    assert.equal(formatRate(40), "$40/hr");
  });

  it("uses patient-safe care request copy instead of internal job language", () => {
    assert.equal(careRequestStatusLabel("open"), "Open");
    assert.equal(careRequestStatusLabel("assigned"), "Assigned");
    assert.equal(careRequestStatusLabel("not_real"), "Status unknown");
    assert.equal(
      careRequestProgressSummary("open"),
      "Request received. Waiting for an approved nurse or caregiver."
    );
    assert.equal(
      careRequestProgressSummary("completed"),
      "Care support is marked complete and saved to the record."
    );
    assert.equal(patientEmptyStateCopy(), "No care requests yet. Submit one to start the closed-beta workflow.");
    assert.equal(nurseEmptyStateCopy(true), "No open care requests are available right now.");
    assert.equal(
      nurseEmptyStateCopy(false),
      "Verification approval is required before open care requests appear."
    );
  });

  it("builds a patient home snapshot around status, next action, and records", () => {
    assert.deepEqual(
      buildPatientWorkflowSnapshot({ focusJob: null, totalRequests: 0, unreadNotifications: 0 }),
      {
        status: "No active request",
        nextStep: "Request care support",
        record: "No request records yet"
      }
    );
    assert.deepEqual(
      buildPatientWorkflowSnapshot({
        focusJob: { status: "assigned", title: "Morning care" },
        totalRequests: 2,
        unreadNotifications: 1
      }),
      {
        status: "Care assigned",
        nextStep: "Track care visit and mark complete after support is finished",
        record: "1 unread updates"
      }
    );
    assert.deepEqual(
      buildPatientWorkflowSnapshot({
        focusJob: { status: "cancelled" },
        totalRequests: 3,
        unreadNotifications: 0
      }),
      {
        status: "Request cancelled",
        nextStep: "Create a new request if support is still needed",
        record: "3 request records"
      }
    );
  });

  it("builds a nurse home snapshot without overclaiming verification", () => {
    assert.deepEqual(
      buildNurseWorkflowSnapshot({
        isApproved: false,
        pendingApplications: 0,
        availableRequests: 0
      }),
      {
        status: "Verification pending",
        nextStep: "Upload documents for admin review",
        record: "Applications locked until approval"
      }
    );
    assert.deepEqual(
      buildNurseWorkflowSnapshot({
        isApproved: true,
        focusJob: { status: "assigned", assigned_nurse_user_id: "nurse-1" },
        userId: "nurse-1",
        pendingApplications: 1,
        availableRequests: 4
      }),
      {
        status: "Assigned care",
        nextStep: "Complete care after the support visit is finished",
        record: "1 pending applications"
      }
    );
    assert.deepEqual(
      buildNurseWorkflowSnapshot({
        isApproved: true,
        pendingApplications: 0,
        availableRequests: 2
      }),
      {
        status: "Approved to apply",
        nextStep: "Review open requests",
        record: "2 available requests"
      }
    );
  });

  it("builds a copyable support snapshot without care details", () => {
    const summary = buildWorkflowEvidenceSummary({
      role: "patient",
      apiConfigured: true,
      focusedRequestId: "job-123",
      focusedRequestStatus: "assigned",
      totalRecords: 2,
      unreadNotifications: 1
    });

    assert.deepEqual(summary.rows, [
      { label: "Role", value: "patient" },
      { label: "API", value: "Connected" },
      { label: "Request ID", value: "job-123" },
      { label: "Status", value: "Assigned" },
      { label: "Records", value: "2" },
      { label: "Unread updates", value: "1" }
    ]);
    assert.match(summary.copyText, /Request ID: job-123/);
    assert.doesNotMatch(summary.copyText, /appointment|mobility|address|description/i);
  });

  it("builds a patient request detail model with status, timeline, updates, and actions", () => {
    const detail = buildPatientRequestDetailModel({
      jobId: "job-1",
      role: "patient",
      userId: "patient-1",
      job: {
        title: "Post-op check in",
        status: "assigned",
        description: "Check on recovery.",
        address: "123 Test Street",
        start_time: "2026-05-01T14:00:00.000Z",
        hourly_rate: 45,
        assigned_nurse_name: "Avery Nurse",
        assigned_nurse_user_id: "nurse-1"
      },
      notifications: [
        { entity_id: "job-1" },
        { entity_id: "job-1" },
        { entity_id: "other-job" }
      ]
    });

    assert.equal(detail.title, "Post-op check in");
    assert.equal(detail.status, "Assigned");
    assert.equal(detail.summary, "A nurse or caregiver has been assigned.");
    assert.equal(detail.assignedCaregiver, "Avery Nurse");
    assert.notEqual(detail.start, "-");
    assert.equal(detail.rate, "$45/hr");
    assert.equal(detail.location, "123 Test Street");
    assert.equal(detail.relatedUpdates, 2);
    assert.equal(detail.canCancel, true);
    assert.equal(detail.canComplete, true);
    assert.deepEqual(detail.timeline, [
      { label: "Request received", state: "done" },
      { label: "Care assigned", state: "current" },
      { label: "Care completed", state: "pending" }
    ]);
  });

  it("keeps final patient request detail states final", () => {
    const completed = buildPatientRequestDetailModel({
      jobId: "job-2",
      role: "patient",
      userId: "patient-1",
      job: {
        title: "Completed request",
        status: "completed",
        address: "",
        start_time: null,
        hourly_rate: null,
        assigned_nurse_user_id: "nurse-1"
      },
      notifications: []
    });
    assert.equal(completed.status, "Completed");
    assert.equal(completed.canCancel, false);
    assert.equal(completed.canComplete, false);
    assert.equal(completed.location, "Location not provided");
    assert.deepEqual(completed.timeline, [
      { label: "Request received", state: "done" },
      { label: "Care assigned", state: "done" },
      { label: "Care completed", state: "current" }
    ]);

    const cancelled = buildPatientRequestDetailModel({
      jobId: "job-3",
      role: "patient",
      userId: "patient-1",
      job: {
        title: "Cancelled request",
        status: "cancelled",
        assigned_nurse_user_id: null
      },
      notifications: []
    });
    assert.equal(cancelled.status, "Cancelled");
    assert.equal(cancelled.canCancel, false);
    assert.equal(cancelled.canComplete, false);
    assert.deepEqual(cancelled.timeline, [
      { label: "Request received", state: "done" },
      { label: "Care assigned", state: "done" },
      { label: "Request cancelled", state: "current" }
    ]);
  });

  it("builds a nurse request detail model for open requests", () => {
    const detail = buildNurseRequestDetailModel({
      isApprovedNurse: true,
      userId: "nurse-1",
      job: {
        title: "Appointment support",
        status: "open",
        description: "Help getting to an appointment.",
        address: "456 Care Ave",
        start_time: "2026-05-01T14:00:00.000Z",
        hourly_rate: 40,
        assigned_nurse_user_id: null
      }
    });

    assert.equal(detail.title, "Appointment support");
    assert.equal(detail.status, "Open");
    assert.equal(detail.summary, "Request received. Waiting for an approved nurse or caregiver.");
    assert.equal(detail.applicationState, "No application yet");
    assert.equal(detail.canApply, true);
    assert.equal(detail.canComplete, false);
    assert.equal(detail.assignedToYou, false);
    assert.notEqual(detail.start, "-");
    assert.equal(detail.rate, "$40/hr");
    assert.equal(detail.location, "Service area not provided");
    assert.equal(detail.description, "Help getting to an appointment.");
  });

  it("builds a nurse request detail model for assigned work without overexposing actions", () => {
    const assignedToCurrentNurse = buildNurseRequestDetailModel({
      isApprovedNurse: true,
      userId: "nurse-1",
      applicationStatus: "accepted",
      job: {
        title: "Post-op support",
        status: "assigned",
        description: "",
        address: "",
        start_time: null,
        hourly_rate: null,
        assigned_nurse_user_id: "nurse-1"
      }
    });

    assert.equal(assignedToCurrentNurse.status, "Assigned");
    assert.equal(assignedToCurrentNurse.applicationState, "Assigned to you");
    assert.equal(assignedToCurrentNurse.canApply, false);
    assert.equal(assignedToCurrentNurse.canComplete, true);
    assert.equal(assignedToCurrentNurse.assignedToYou, true);
    assert.equal(assignedToCurrentNurse.location, "Service area not provided");
    assert.equal(assignedToCurrentNurse.description, "No description provided.");

    const assignedToAnotherNurse = buildNurseRequestDetailModel({
      isApprovedNurse: true,
      userId: "nurse-2",
      applicationStatus: "rejected",
      job: {
        title: "Post-op support",
        status: "assigned",
        assigned_nurse_user_id: "nurse-1"
      }
    });
    assert.equal(assignedToAnotherNurse.applicationState, "Not selected");
    assert.equal(assignedToAnotherNurse.canApply, false);
    assert.equal(assignedToAnotherNurse.canComplete, false);
    assert.equal(assignedToAnotherNurse.assignedToYou, false);
  });

  it("builds care request transition confirmation copy", () => {
    assert.deepEqual(buildCareRequestTransitionConfirmation("cancel"), {
      title: "Cancel this request?",
      message: "This closes the request and prevents new applications. The action is recorded for admin review.",
      confirmLabel: "Cancel request",
      isDestructive: true
    });
    assert.deepEqual(buildCareRequestTransitionConfirmation("complete"), {
      title: "Mark care complete?",
      message: "This records the care request as completed. Only use this after the planned support is finished.",
      confirmLabel: "Mark complete",
      isDestructive: false
    });
  });

  it("builds nurse verification storage paths with sanitized file names", () => {
    const originalNow = Date.now;
    Date.now = () => 1784260000000;

    try {
      assert.equal(
        buildVerificationStoragePath("nurse-123", "License Card (front).pdf"),
        "nurse-123/1784260000000-License-Card-front-.pdf"
      );
      assert.equal(
        buildVerificationStoragePath("nurse-123", "  "),
        "nurse-123/1784260000000-verification-document"
      );
    } finally {
      Date.now = originalNow;
    }
  });

  it("keeps mobile terminal actions aligned to the closed-beta job lifecycle", () => {
    assert.equal(canApplyToJobStatus("open"), true);
    assert.equal(canApplyToJobStatus("assigned"), false);
    assert.equal(canApplyToJobStatus("completed"), false);
    assert.equal(canApplyToJobStatus("cancelled"), false);

    assert.equal(canAssignJobStatus("open"), true);
    assert.equal(canAssignJobStatus("assigned"), false);

    assert.equal(canSelectApplication("applied"), true);
    assert.equal(canSelectApplication("accepted"), false);
    assert.equal(canSelectApplication("rejected"), false);
    assert.equal(canSelectApplication("withdrawn"), false);

    assert.equal(canCancelJobStatus("open"), true);
    assert.equal(canCancelJobStatus("assigned"), true);
    assert.equal(canCancelJobStatus("completed"), false);
    assert.equal(canCancelJobStatus("cancelled"), false);

    assert.equal(canCancelJob({ status: "open" }), true);
    assert.equal(canCancelJob({ status: "assigned" }), true);
    assert.equal(canCancelJob({ status: "completed" }), false);
    assert.equal(canCancelJob({ status: "cancelled" }), false);

    assert.equal(canCompleteJobStatus("assigned", true), true);
    assert.equal(canCompleteJobStatus("assigned", false), false);
    assert.equal(canCompleteJobStatus("open", true), false);

    assert.equal(canCompleteJob({ status: "assigned", assigned_nurse_user_id: "nurse-1" }, "patient", "patient-1"), true);
    assert.equal(canCompleteJob({ status: "assigned", assigned_nurse_user_id: "nurse-1" }, "nurse", "nurse-1"), true);
    assert.equal(canCompleteJob({ status: "assigned", assigned_nurse_user_id: "nurse-2" }, "nurse", "nurse-1"), false);
    assert.equal(canCompleteJob({ status: "assigned", assigned_nurse_user_id: null }, "patient", "patient-1"), false);
    assert.equal(canCompleteJob({ status: "open", assigned_nurse_user_id: "nurse-1" }, "patient", "patient-1"), false);
    assert.equal(canCompleteJob({ status: "assigned", assigned_nurse_user_id: "nurse-1" }, "admin", "admin-1"), false);

    assert.equal(isJobStatus("open"), true);
    assert.equal(isJobStatus("pending_dispatch"), false);
    assert.equal(terminalJobStatus("completed"), true);
    assert.equal(terminalJobStatus("cancelled"), true);
    assert.equal(terminalJobStatus("assigned"), false);
  });

  it("only allows approved nurses to apply to eligible open care requests", () => {
    assert.equal(canApplyToCareRequest({ jobStatus: "open", isApprovedNurse: true }), true);
    assert.equal(canApplyToCareRequest({ jobStatus: "assigned", isApprovedNurse: true }), false);
    assert.equal(canApplyToCareRequest({ jobStatus: "completed", isApprovedNurse: true }), false);
    assert.equal(canApplyToCareRequest({ jobStatus: "open", isApprovedNurse: false }), false);
    assert.equal(
      canApplyToCareRequest({ jobStatus: "open", isApprovedNurse: true, applicationStatus: "applied" }),
      false
    );
    assert.equal(
      canApplyToCareRequest({ jobStatus: "open", isApprovedNurse: true, applicationStatus: "rejected" }),
      false
    );
  });

  it("uses nurse-facing labels for application states", () => {
    assert.equal(nurseApplicationStateLabel("applied"), "Application sent");
    assert.equal(nurseApplicationStateLabel("accepted"), "Assigned to you");
    assert.equal(nurseApplicationStateLabel("rejected"), "Not selected");
    assert.equal(nurseApplicationStateLabel("withdrawn"), "Application withdrawn");
    assert.equal(nurseApplicationStateLabel(null), null);
  });

  it("selects the most useful patient and nurse focus job", () => {
    const jobs = [
      { id: "completed", status: "completed", created_at: "2026-01-03T00:00:00.000Z" },
      { id: "open", status: "open", created_at: "2026-01-01T00:00:00.000Z" },
      { id: "assigned", status: "assigned", assigned_nurse_user_id: "nurse-2", created_at: "2026-01-02T00:00:00.000Z" }
    ];

    assert.equal(pickPatientFocusJob(jobs)?.id, "assigned");
    assert.equal(pickNurseFocusJob(jobs, "nurse-2")?.id, "assigned");
    assert.equal(pickNurseFocusJob(jobs, "nurse-1")?.id, "open");
    assert.equal(latestByCreatedAt(jobs.filter((job) => job.status === "completed"))?.id, "completed");
  });

  it("normalizes API base URLs", () => {
    assert.equal(normalizeBaseUrl(" https://api.nursebridges.com/ "), "https://api.nursebridges.com");
    assert.equal(normalizeBaseUrl("http://localhost:3000/"), "http://localhost:3000");
  });

  it("detects localhost API URLs that physical devices cannot use", () => {
    assert.equal(isLocalhostBaseUrl("http://localhost:3000"), true);
    assert.equal(isLocalhostBaseUrl("http://127.0.0.1:3000"), true);
    assert.equal(isLocalhostBaseUrl("https://api.nursebridges.com"), false);
  });

  it("falls back from localhost only on physical mobile devices", () => {
    assert.equal(
      shouldFallbackFromLocalhost({ platform: "android", isDevice: true, baseUrl: "http://localhost:3000" }),
      true
    );
    assert.equal(
      shouldFallbackFromLocalhost({ platform: "ios", isDevice: true, baseUrl: "http://localhost:3000" }),
      true
    );
    assert.equal(
      shouldFallbackFromLocalhost({ platform: "android", isDevice: false, baseUrl: "http://localhost:3000" }),
      false
    );
    assert.equal(
      shouldFallbackFromLocalhost({ platform: "ios", isDevice: false, baseUrl: "http://localhost:3000" }),
      false
    );
    assert.equal(
      shouldFallbackFromLocalhost({ platform: "android", isDevice: true, baseUrl: "https://api.nursebridges.com" }),
      false
    );
    assert.equal(
      shouldFallbackFromLocalhost({ platform: "web", isDevice: true, baseUrl: "http://localhost:3000" }),
      false
    );
  });
});
