import {
  applicationStatuses,
  canApplyToJob as canApplyToJobStatus,
  canAssignJob as canAssignJobStatus,
  canCancelJob as canCancelJobStatus,
  canCompleteJob as canCompleteJobStatus,
  canSelectApplication,
  getWorkflowErrorHttpStatus,
  isJobStatus,
  isWorkflowErrorCategory,
  isTerminalJobStatus as terminalJobStatus,
  jobStatuses,
  workflowErrorCategories,
  workflowErrorHttpStatus,
  type ApplicationStatus,
  type JobStatus,
  type WorkflowErrorCategory
} from "@nursebridge/shared/workflow";

export const emptyJobForm = {
  title: "",
  description: "",
  contact_context: "",
  mobility_notes: "",
  address: "",
  start_time: "",
  hourly_rate: ""
};

export type CreateCareRequestForm = typeof emptyJobForm;

export type CreateCareRequestPayload = {
  title: string;
  description: string;
  address: string;
  start_time?: string;
  hourly_rate?: number;
};

export type CreateCareRequestValidation =
  | { ok: true; payload: CreateCareRequestPayload }
  | { ok: false; error: string };

export const VERIFICATION_BUCKET = "nurse-verification";

export {
  applicationStatuses,
  canApplyToJobStatus,
  canAssignJobStatus,
  canCancelJobStatus,
  canCompleteJobStatus,
  canSelectApplication,
  getWorkflowErrorHttpStatus,
  isJobStatus,
  isWorkflowErrorCategory,
  jobStatuses,
  terminalJobStatus,
  workflowErrorCategories,
  workflowErrorHttpStatus,
  type ApplicationStatus,
  type JobStatus,
  type WorkflowErrorCategory
};

export type WorkflowJob = {
  status: string;
  created_at: string;
  assigned_nurse_user_id?: string | null;
};

export function careRequestStatusLabel(status: string | null | undefined) {
  if (status === "open") return "Open";
  if (status === "assigned") return "Assigned";
  if (status === "completed") return "Completed";
  if (status === "cancelled") return "Cancelled";
  return "Status unknown";
}

export function careRequestProgressSummary(status: string | null | undefined) {
  if (status === "open") return "Request received. Waiting for an approved nurse or caregiver.";
  if (status === "assigned") return "A nurse or caregiver has been assigned.";
  if (status === "completed") return "Care support is marked complete and saved to the record.";
  if (status === "cancelled") return "This request is closed and no longer active.";
  return "Status is being checked.";
}

export function patientEmptyStateCopy() {
  return "No care requests yet. Submit one to start the closed-beta workflow.";
}

export function nurseEmptyStateCopy(isApproved: boolean) {
  return isApproved
    ? "No open care requests are available right now."
    : "Verification approval is required before open care requests appear.";
}

export type WorkflowSnapshot = {
  status: string;
  nextStep: string;
  record: string;
};

export type WorkflowEvidenceSummary = {
  rows: Array<{ label: string; value: string }>;
  copyText: string;
};

export type PatientRequestDetailModel = {
  title: string;
  status: string;
  summary: string;
  assignedCaregiver: string;
  start: string;
  rate: string;
  location: string;
  relatedUpdates: number;
  canCancel: boolean;
  canComplete: boolean;
  timeline: Array<{
    label: string;
    state: "done" | "current" | "pending";
  }>;
};

export type NurseRequestDetailModel = {
  title: string;
  status: string;
  summary: string;
  applicationState: string;
  canApply: boolean;
  canComplete: boolean;
  assignedToYou: boolean;
  start: string;
  rate: string;
  location: string;
  description: string;
};

export type CareRequestTransitionAction = "cancel" | "complete";

export type CareRequestTransitionConfirmation = {
  title: string;
  message: string;
  confirmLabel: string;
  isDestructive: boolean;
};

export function buildPatientWorkflowSnapshot(input: {
  focusJob?: { status: string; title?: string | null } | null;
  totalRequests: number;
  unreadNotifications: number;
}): WorkflowSnapshot {
  const job = input.focusJob;

  if (!job) {
    return {
      status: "No active request",
      nextStep: "Request care support",
      record: input.totalRequests > 0 ? `${input.totalRequests} closed request records` : "No request records yet"
    };
  }

  if (job.status === "open") {
    return {
      status: "Request open",
      nextStep: "Wait for review and assignment",
      record: `${input.unreadNotifications} unread updates`
    };
  }

  if (job.status === "assigned") {
    return {
      status: "Care assigned",
      nextStep: "Track care visit and mark complete after support is finished",
      record: `${input.unreadNotifications} unread updates`
    };
  }

  if (job.status === "completed") {
    return {
      status: "Care completed",
      nextStep: "Review the saved record",
      record: `${input.totalRequests} request records`
    };
  }

  if (job.status === "cancelled") {
    return {
      status: "Request cancelled",
      nextStep: "Create a new request if support is still needed",
      record: `${input.totalRequests} request records`
    };
  }

  return {
    status: "Status being checked",
    nextStep: "Refresh request status",
    record: `${input.totalRequests} request records`
  };
}

export function buildNurseWorkflowSnapshot(input: {
  isApproved: boolean;
  focusJob?: { status: string; assigned_nurse_user_id?: string | null } | null;
  userId?: string;
  pendingApplications: number;
  availableRequests: number;
}): WorkflowSnapshot {
  if (!input.isApproved) {
    return {
      status: "Verification pending",
      nextStep: "Upload documents for admin review",
      record: "Applications locked until approval"
    };
  }

  const assignedToNurse =
    input.focusJob?.status === "assigned" && input.focusJob.assigned_nurse_user_id === input.userId;

  if (assignedToNurse) {
    return {
      status: "Assigned care",
      nextStep: "Complete care after the support visit is finished",
      record: `${input.pendingApplications} pending applications`
    };
  }

  if (input.pendingApplications > 0) {
    return {
      status: "Applications pending",
      nextStep: "Watch for assignment updates",
      record: `${input.pendingApplications} pending applications`
    };
  }

  if (input.availableRequests > 0) {
    return {
      status: "Approved to apply",
      nextStep: "Review open requests",
      record: `${input.availableRequests} available requests`
    };
  }

  return {
    status: "Approved to work",
    nextStep: "Refresh before scheduled beta tests",
    record: "No open requests right now"
  };
}

export function buildWorkflowEvidenceSummary(input: {
  role: "patient" | "nurse" | "admin" | null;
  apiConfigured: boolean;
  focusedRequestId?: string | null;
  focusedRequestStatus?: string | null;
  totalRecords: number;
  unreadNotifications: number;
}): WorkflowEvidenceSummary {
  const role = input.role ?? "signed out";
  const requestId = input.focusedRequestId ?? "none";
  const status = input.focusedRequestStatus ? careRequestStatusLabel(input.focusedRequestStatus) : "No focused request";
  const rows = [
    { label: "Role", value: role },
    { label: "API", value: input.apiConfigured ? "Connected" : "Not configured" },
    { label: "Request ID", value: requestId },
    { label: "Status", value: status },
    { label: "Records", value: String(input.totalRecords) },
    { label: "Unread updates", value: String(input.unreadNotifications) }
  ];

  return {
    rows,
    copyText: rows.map((row) => `${row.label}: ${row.value}`).join("\n")
  };
}

function timelineState(status: string, step: "received" | "assigned" | "closed"): "done" | "current" | "pending" {
  if (step === "received") return status === "open" ? "current" : "done";

  if (step === "assigned") {
    if (status === "open") return "pending";
    if (status === "assigned") return "current";
    return status === "completed" || status === "cancelled" ? "done" : "pending";
  }

  if (status === "completed" || status === "cancelled") return "current";
  return "pending";
}

export function buildPatientRequestDetailModel(input: {
  job: {
    title: string;
    status: string;
    description?: string | null;
    address?: string | null;
    start_time?: string | null;
    hourly_rate?: number | null;
    assigned_nurse_name?: string | null;
    assigned_nurse_user_id?: string | null;
  };
  notifications: Array<{ entity_id?: string | null }>;
  jobId: string;
  role: "patient" | "nurse" | "admin" | null;
  userId?: string;
}): PatientRequestDetailModel {
  const relatedUpdates = input.notifications.filter((notification) => notification.entity_id === input.jobId).length;
  const assignedCaregiver = input.job.assigned_nurse_name ?? input.job.assigned_nurse_user_id ?? "Not assigned yet";

  return {
    title: input.job.title,
    status: careRequestStatusLabel(input.job.status),
    summary: careRequestProgressSummary(input.job.status),
    assignedCaregiver,
    start: formatDate(input.job.start_time ?? null),
    rate: formatRate(input.job.hourly_rate ?? null),
    location: input.job.address?.trim() || "Location not provided",
    relatedUpdates,
    canCancel: canCancelJob(input.job),
    canComplete: canCompleteJob(input.job, input.role, input.userId),
    timeline: [
      { label: "Request received", state: timelineState(input.job.status, "received") },
      { label: "Care assigned", state: timelineState(input.job.status, "assigned") },
      {
        label: input.job.status === "cancelled" ? "Request cancelled" : "Care completed",
        state: timelineState(input.job.status, "closed")
      }
    ]
  };
}

export function buildNurseRequestDetailModel(input: {
  job: {
    title: string;
    status: string;
    description?: string | null;
    address?: string | null;
    start_time?: string | null;
    hourly_rate?: number | null;
    assigned_nurse_user_id?: string | null;
  };
  isApprovedNurse: boolean;
  applicationStatus?: string | null;
  userId?: string;
}): NurseRequestDetailModel {
  const assignedToYou = input.job.status === "assigned" && input.job.assigned_nurse_user_id === input.userId;
  const applicationLabel = nurseApplicationStateLabel(input.applicationStatus);

  return {
    title: input.job.title,
    status: careRequestStatusLabel(input.job.status),
    summary: careRequestProgressSummary(input.job.status),
    applicationState: assignedToYou ? "Assigned to you" : applicationLabel ?? "No application yet",
    canApply: canApplyToCareRequest({
      jobStatus: input.job.status,
      isApprovedNurse: input.isApprovedNurse,
      applicationStatus: input.applicationStatus
    }),
    canComplete: canCompleteJob(input.job, "nurse", input.userId),
    assignedToYou,
    start: formatDate(input.job.start_time ?? null),
    rate: formatRate(input.job.hourly_rate ?? null),
    location: input.job.address?.trim() || "Location not provided",
    description: input.job.description?.trim() || "No description provided."
  };
}

export function buildCareRequestTransitionConfirmation(
  action: CareRequestTransitionAction
): CareRequestTransitionConfirmation {
  if (action === "cancel") {
    return {
      title: "Cancel this request?",
      message: "This closes the request and prevents new applications. The action is recorded for admin review.",
      confirmLabel: "Cancel request",
      isDestructive: true
    };
  }

  return {
    title: "Mark care complete?",
    message: "This records the care request as completed. Only use this after the planned support is finished.",
    confirmLabel: "Mark complete",
    isDestructive: false
  };
}

export function formatDate(value: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

export function formatRate(value: number | null) {
  if (value === null || value === undefined) return "-";
  return `$${value}/hr`;
}

function safeFileName(name: string | null | undefined) {
  const fallback = "verification-document";
  const trimmed = (name ?? fallback).trim() || fallback;
  return trimmed.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || fallback;
}

export function buildVerificationStoragePath(userId: string, fileName: string) {
  return `${userId}/${Date.now()}-${safeFileName(fileName)}`;
}

export function parseStartTimeInput(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return undefined;

  const date = new Date(trimmed);
  if (Number.isNaN(date.getTime())) return null;

  return date.toISOString();
}

export function parseHourlyRateInput(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return undefined;

  const hourlyRate = Number(trimmed);
  if (!Number.isFinite(hourlyRate) || hourlyRate < 0) return null;

  return hourlyRate;
}

function buildCareRequestDescription(form: CreateCareRequestForm) {
  const sections = [
    form.description.trim(),
    form.contact_context.trim() ? `Contact context: ${form.contact_context.trim()}` : "",
    form.mobility_notes.trim() ? `Mobility/support notes: ${form.mobility_notes.trim()}` : ""
  ].filter(Boolean);

  return sections.join("\n\n").slice(0, 4000);
}

export function buildCreateCareRequestPayload(form: CreateCareRequestForm): CreateCareRequestValidation {
  const title = form.title.trim().slice(0, 120);
  if (title.length < 3) {
    return { ok: false, error: "Enter the support type or request title. Use at least 3 characters." };
  }

  const startTime = parseStartTimeInput(form.start_time);
  if (startTime === null) {
    return {
      ok: false,
      error: "Enter a valid date/time or leave it blank. Example: 2026-05-01T14:00:00Z."
    };
  }

  const hourlyRate = parseHourlyRateInput(form.hourly_rate);
  if (hourlyRate === null) {
    return { ok: false, error: "Enter a valid hourly rate of 0 or more, or leave it blank." };
  }

  return {
    ok: true,
    payload: {
      title,
      description: buildCareRequestDescription(form),
      address: form.address.trim().slice(0, 255),
      start_time: startTime,
      hourly_rate: hourlyRate
    }
  };
}

export function canCancelJob(job: Pick<WorkflowJob, "status">) {
  return canCancelJobStatus(job.status);
}

export function canCompleteJob(
  job: Pick<WorkflowJob, "status" | "assigned_nurse_user_id">,
  role: "patient" | "nurse" | "admin" | null,
  userId: string | undefined
) {
  if (!canCompleteJobStatus(job.status, Boolean(job.assigned_nurse_user_id))) return false;
  if (role === "patient") return true;
  if (role === "nurse") return job.assigned_nurse_user_id === userId;
  return false;
}

export function canApplyToCareRequest(input: {
  jobStatus: string;
  isApprovedNurse: boolean;
  applicationStatus?: string | null;
}) {
  return input.isApprovedNurse && canApplyToJobStatus(input.jobStatus) && !input.applicationStatus;
}

export function nurseApplicationStateLabel(applicationStatus?: string | null) {
  if (applicationStatus === "applied") return "Application sent";
  if (applicationStatus === "accepted") return "Assigned to you";
  if (applicationStatus === "rejected") return "Not selected";
  if (applicationStatus === "withdrawn") return "Application withdrawn";
  return null;
}

export function latestByCreatedAt<T extends { created_at: string }>(items: T[]) {
  return [...items].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0] ?? null;
}

export function pickPatientFocusJob<T extends WorkflowJob>(jobs: T[]) {
  return (
    jobs.find((job) => job.status === "assigned") ??
    jobs.find((job) => job.status === "open") ??
    latestByCreatedAt(jobs)
  );
}

export function pickNurseFocusJob<T extends WorkflowJob>(jobs: T[], userId: string | undefined) {
  return (
    jobs.find((job) => job.status === "assigned" && job.assigned_nurse_user_id === userId) ??
    jobs.find((job) => job.status === "open") ??
    latestByCreatedAt(jobs)
  );
}
