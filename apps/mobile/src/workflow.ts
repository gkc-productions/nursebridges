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
  mobility_notes: "",
  start_time: "",
  residence_type: "apartment" as "house" | "apartment" | "assisted_living" | "other",
  street_address: "",
  unit: "",
  building_name: "",
  city: "",
  state: "GA",
  postal_code: "",
  stairs: "none" as "none" | "entrance" | "interior" | "both" | "unknown",
  elevator_available: "unknown" as "yes" | "no" | "unknown",
  meeting_point: "",
  parking_notes: "",
  arrival_instructions: "",
  mobility_aids: [] as Array<"cane" | "walker" | "wheelchair" | "scooter" | "other">,
  onsite_contact_name: "",
  onsite_contact_relationship: "",
  onsite_contact_phone: "",
  transportation_mode: "not_arranged" as "patient_arranged" | "family_friend" | "rideshare" | "medical_transport" | "public_transit" | "other" | "not_arranged",
  transportation_provider: "",
  pickup_time: "",
  return_plan: "not_arranged" as "round_trip" | "one_way" | "family_pickup" | "other" | "not_arranged",
  transportation_notes: ""
};

export type CreateCareRequestForm = typeof emptyJobForm;

export type CreateCareRequestPayload = {
  title: string;
  description: string;
  start_time?: string;
  logistics: {
    residence_type: CreateCareRequestForm["residence_type"];
    street_address: string;
    unit?: string;
    building_name?: string;
    city: string;
    state: string;
    postal_code: string;
    stairs: CreateCareRequestForm["stairs"];
    elevator_available?: boolean;
    meeting_point?: string;
    parking_notes?: string;
    arrival_instructions?: string;
    mobility_aids: CreateCareRequestForm["mobility_aids"];
    mobility_notes?: string;
    onsite_contact_name?: string;
    onsite_contact_relationship?: string;
    onsite_contact_phone?: string;
    transportation_mode: CreateCareRequestForm["transportation_mode"];
    transportation_provider?: string;
    pickup_time?: string;
    return_plan: CreateCareRequestForm["return_plan"];
    transportation_notes?: string;
  };
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
  access: string;
  mobility: string;
  transportation: string;
  onsiteContact: string;
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
  access: string;
  mobility: string;
  transportation: string;
  onsiteContact: string;
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
    service_city?: string | null;
    service_state?: string | null;
    logistics?: LogisticsDetail | null;
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
    location: formatResidence(input.job),
    access: formatAccessDetails(input.job.logistics),
    mobility: formatMobilityDetails(input.job.logistics),
    transportation: formatTransportationDetails(input.job.logistics),
    onsiteContact: formatOnsiteContact(input.job.logistics),
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
    service_city?: string | null;
    service_state?: string | null;
    logistics?: LogisticsDetail | null;
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
    location: input.job.logistics ? formatResidence(input.job) : formatServiceArea(input.job),
    access: formatAccessDetails(input.job.logistics),
    mobility: formatMobilityDetails(input.job.logistics),
    transportation: formatTransportationDetails(input.job.logistics),
    onsiteContact: formatOnsiteContact(input.job.logistics),
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

type LogisticsDetail = {
  residence_type?: string | null;
  street_address?: string | null;
  unit?: string | null;
  building_name?: string | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
  stairs?: string | null;
  elevator_available?: boolean | null;
  meeting_point?: string | null;
  parking_notes?: string | null;
  arrival_instructions?: string | null;
  mobility_aids?: string[] | null;
  mobility_notes?: string | null;
  onsite_contact_name?: string | null;
  onsite_contact_relationship?: string | null;
  onsite_contact_phone?: string | null;
  transportation_mode?: string | null;
  transportation_provider?: string | null;
  pickup_time?: string | null;
  return_plan?: string | null;
  transportation_notes?: string | null;
};

function humanize(value: string | null | undefined) {
  return value ? value.replace(/_/g, " ") : "";
}

export function formatServiceArea(job: { service_city?: string | null; service_state?: string | null }) {
  return [job.service_city, job.service_state].filter(Boolean).join(", ") || "Service area not provided";
}

export function formatResidence(job: {
  address?: string | null;
  service_city?: string | null;
  service_state?: string | null;
  logistics?: LogisticsDetail | null;
}) {
  const logistics = job.logistics;
  if (!logistics) {
    const serviceArea = [job.service_city, job.service_state].filter(Boolean).join(", ");
    return job.address?.trim() || serviceArea || "Location not provided";
  }
  const street = [logistics.street_address, logistics.unit ? `Unit ${logistics.unit}` : null].filter(Boolean).join(", ");
  const locality = [logistics.city, logistics.state, logistics.postal_code].filter(Boolean).join(" ");
  return [logistics.building_name, street, locality].filter(Boolean).join(" · ") || formatServiceArea(job);
}

export function formatAccessDetails(logistics?: LogisticsDetail | null) {
  if (!logistics) return "Shared after assignment";
  const stairs = logistics.stairs && logistics.stairs !== "none" ? `Stairs: ${humanize(logistics.stairs)}` : "No stairs reported";
  const elevator = logistics.elevator_available === null || logistics.elevator_available === undefined
    ? ""
    : logistics.elevator_available ? "Elevator available" : "No elevator";
  return [stairs, elevator, logistics.meeting_point, logistics.parking_notes, logistics.arrival_instructions]
    .filter(Boolean)
    .join(" · ");
}

export function formatMobilityDetails(logistics?: LogisticsDetail | null) {
  if (!logistics) return "Shared after assignment";
  const aids = logistics.mobility_aids?.filter((aid) => aid !== "none").map(humanize).join(", ");
  return [aids ? `Aids: ${aids}` : "No mobility aids reported", logistics.mobility_notes].filter(Boolean).join(" · ");
}

export function formatTransportationDetails(logistics?: LogisticsDetail | null) {
  if (!logistics) return "Shared after assignment";
  const pickup = logistics.pickup_time ? `Pickup ${formatDate(logistics.pickup_time)}` : "";
  return [
    humanize(logistics.transportation_mode) || "Not arranged",
    logistics.transportation_provider,
    pickup,
    logistics.return_plan ? `Return: ${humanize(logistics.return_plan)}` : "",
    logistics.transportation_notes
  ].filter(Boolean).join(" · ");
}

export function formatOnsiteContact(logistics?: LogisticsDetail | null) {
  if (!logistics) return "Shared after assignment";
  return [logistics.onsite_contact_name, logistics.onsite_contact_relationship, logistics.onsite_contact_phone]
    .filter(Boolean)
    .join(" · ") || "No additional contact provided";
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

  const currentYear = new Date().getFullYear();
  if (date.getFullYear() < currentYear || date.getFullYear() > currentYear + 2) return null;

  return date.toISOString();
}

function buildCareRequestDescription(form: CreateCareRequestForm) {
  return form.description.trim().slice(0, 4000);
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
      error: "Use a date within the next two years, or leave it blank. Example: 2026-08-05 10:00 AM."
    };
  }

  const requiredLogistics = [
    [form.street_address, "Enter the residence street address."],
    [form.city, "Enter the residence city."],
    [form.state, "Enter the two-letter state code."],
    [form.postal_code, "Enter the residence ZIP code."]
  ] as const;
  for (const [value, error] of requiredLogistics) {
    if (!value.trim()) return { ok: false, error };
  }
  if (!/^[A-Za-z]{2}$/.test(form.state.trim())) return { ok: false, error: "Enter a two-letter state code." };
  if (!/^\d{5}(?:-\d{4})?$/.test(form.postal_code.trim())) return { ok: false, error: "Enter a valid ZIP code." };
  if (form.residence_type === "apartment" && !form.unit.trim()) {
    return { ok: false, error: "Enter the apartment or unit number." };
  }
  if (/\b(?:door|gate|alarm|lockbox|keypad|entry)\s*(?:code|pin)\b|\bcode\s*(?:is|:)\s*[a-z0-9#*]{3,}\b/i.test(form.arrival_instructions)) {
    return { ok: false, error: "Do not enter access codes. Share time-limited access details by phone after a nurse is assigned." };
  }

  const pickupTime = parseStartTimeInput(form.pickup_time);
  if (pickupTime === null) return { ok: false, error: "Select a valid transportation pickup time or leave it blank." };

  return {
    ok: true,
    payload: {
      title,
      description: buildCareRequestDescription(form),
      start_time: startTime,
      logistics: {
        residence_type: form.residence_type,
        street_address: form.street_address.trim().slice(0, 200),
        ...(form.unit.trim() ? { unit: form.unit.trim().slice(0, 50) } : {}),
        ...(form.building_name.trim() ? { building_name: form.building_name.trim().slice(0, 120) } : {}),
        city: form.city.trim().slice(0, 100),
        state: form.state.trim().toUpperCase(),
        postal_code: form.postal_code.trim(),
        stairs: form.stairs,
        ...(form.elevator_available !== "unknown" ? { elevator_available: form.elevator_available === "yes" } : {}),
        ...(form.meeting_point.trim() ? { meeting_point: form.meeting_point.trim().slice(0, 300) } : {}),
        ...(form.parking_notes.trim() ? { parking_notes: form.parking_notes.trim().slice(0, 500) } : {}),
        ...(form.arrival_instructions.trim() ? { arrival_instructions: form.arrival_instructions.trim().slice(0, 500) } : {}),
        mobility_aids: form.mobility_aids,
        ...(form.mobility_notes.trim() ? { mobility_notes: form.mobility_notes.trim().slice(0, 1000) } : {}),
        ...(form.onsite_contact_name.trim() ? { onsite_contact_name: form.onsite_contact_name.trim().slice(0, 120) } : {}),
        ...(form.onsite_contact_relationship.trim() ? { onsite_contact_relationship: form.onsite_contact_relationship.trim().slice(0, 80) } : {}),
        ...(form.onsite_contact_phone.trim() ? { onsite_contact_phone: form.onsite_contact_phone.trim().slice(0, 30) } : {}),
        transportation_mode: form.transportation_mode,
        ...(form.transportation_provider.trim() ? { transportation_provider: form.transportation_provider.trim().slice(0, 120) } : {}),
        ...(pickupTime ? { pickup_time: pickupTime } : {}),
        return_plan: form.return_plan,
        ...(form.transportation_notes.trim() ? { transportation_notes: form.transportation_notes.trim().slice(0, 1000) } : {})
      }
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
