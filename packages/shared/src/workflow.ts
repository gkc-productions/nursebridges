export const jobStatuses = ["open", "assigned", "completed", "cancelled"] as const;
export type JobStatus = (typeof jobStatuses)[number];

export const applicationStatuses = ["applied", "accepted", "rejected", "withdrawn"] as const;
export type ApplicationStatus = (typeof applicationStatuses)[number];

export const workflowErrorCategories = [
  "unauthorized",
  "forbidden",
  "not_found",
  "invalid_transition",
  "conflict",
  "storage_or_db_error"
] as const;
export type WorkflowErrorCategory = (typeof workflowErrorCategories)[number];

export const workflowErrorHttpStatus: Record<WorkflowErrorCategory, number> = {
  unauthorized: 401,
  forbidden: 403,
  not_found: 404,
  invalid_transition: 400,
  conflict: 409,
  storage_or_db_error: 500
};

export function isWorkflowErrorCategory(value: string): value is WorkflowErrorCategory {
  return workflowErrorCategories.includes(value as WorkflowErrorCategory);
}

export function getWorkflowErrorHttpStatus(category: WorkflowErrorCategory) {
  return workflowErrorHttpStatus[category];
}

export function isJobStatus(value: string): value is JobStatus {
  return jobStatuses.includes(value as JobStatus);
}

export function isTerminalJobStatus(status: string) {
  return status === "cancelled" || status === "completed";
}

export function canCancelJob(status: string) {
  return status === "open" || status === "assigned";
}

export function canCompleteJob(status: string, hasAcceptedNurse: boolean) {
  return status === "assigned" && hasAcceptedNurse;
}

export function canApplyToJob(status: string) {
  return status === "open";
}

export function canAssignJob(status: string) {
  return status === "open";
}

export function canSelectApplication(status: string) {
  return status === "applied";
}

export function canWithdrawApplication(status: string) {
  return status === "applied";
}

export type WorkflowActorRole = "patient" | "nurse" | "admin";

export function getCancelJobDecision(input: {
  actorRole: string;
  actorUserId: string;
  jobStatus: string;
  patientUserId?: string | null;
}): WorkflowErrorCategory | null {
  if (input.actorRole === "patient" && input.patientUserId !== input.actorUserId) {
    return "forbidden";
  }

  if (input.actorRole !== "patient" && input.actorRole !== "admin") {
    return "forbidden";
  }

  if (!canCancelJob(input.jobStatus)) {
    return "invalid_transition";
  }

  return null;
}

export function getCompleteJobDecision(input: {
  actorRole: string;
  actorUserId: string;
  jobStatus: string;
  patientUserId?: string | null;
  acceptedNurseUserId?: string | null;
}): WorkflowErrorCategory | null {
  if (!input.acceptedNurseUserId || !canCompleteJob(input.jobStatus, true)) {
    return "invalid_transition";
  }

  if (input.actorRole === "patient" && input.patientUserId !== input.actorUserId) {
    return "forbidden";
  }

  if (input.actorRole === "nurse" && input.acceptedNurseUserId !== input.actorUserId) {
    return "forbidden";
  }

  if (input.actorRole !== "patient" && input.actorRole !== "nurse" && input.actorRole !== "admin") {
    return "forbidden";
  }

  return null;
}

export type AssignmentApplicationCandidate = {
  nurse_user_id?: string | null;
  status: string;
};

export type AssignmentApplicationPlan<TApplication extends AssignmentApplicationCandidate> = {
  selectedApplication: TApplication | null;
  selectedApplicationSelectable: boolean;
  rejectedNurseIds: string[];
};

export function createAssignmentApplicationPlan<TApplication extends AssignmentApplicationCandidate>(
  applications: TApplication[],
  selectedNurseUserId: string
): AssignmentApplicationPlan<TApplication> {
  const selectedApplication =
    applications.find((application) => application.nurse_user_id === selectedNurseUserId) ?? null;

  return {
    selectedApplication,
    selectedApplicationSelectable: selectedApplication ? canSelectApplication(selectedApplication.status) : false,
    rejectedNurseIds: applications
      .filter((application) => application.nurse_user_id !== selectedNurseUserId && application.status === "applied")
      .map((application) => application.nurse_user_id)
      .filter((nurseUserId): nurseUserId is string => Boolean(nurseUserId))
  };
}

export type AssignmentNotification = {
  userId: string;
  type: "job_assigned" | "application_rejected";
  title: string;
  body: string;
  entityType: "job";
  entityId: string;
};

export function buildAssignmentNotifications(input: {
  jobId: string;
  jobTitle?: string | null;
  selectedNurseUserId: string;
  rejectedNurseIds: string[];
}): AssignmentNotification[] {
  const jobTitle = input.jobTitle || "Job";

  return [
    {
      userId: input.selectedNurseUserId,
      type: "job_assigned",
      title: "Job assigned",
      body: `${jobTitle} has been assigned to you.`,
      entityType: "job",
      entityId: input.jobId
    },
    ...input.rejectedNurseIds.map((nurseUserId) => ({
      userId: nurseUserId,
      type: "application_rejected" as const,
      title: "Application not selected",
      body: `${jobTitle} was assigned to another nurse.`,
      entityType: "job" as const,
      entityId: input.jobId
    }))
  ];
}

export type AssignmentAuditPlan = {
  action: "job_assigned";
  metadata: Record<string, string>;
};

export type AssignmentCommandPlan<TApplication extends AssignmentApplicationCandidate> =
  AssignmentApplicationPlan<TApplication> & {
    acceptSelectedApplication: boolean;
    rejectCompetingApplications: boolean;
    notifications: AssignmentNotification[];
    audit: AssignmentAuditPlan | null;
  };

export function createAssignmentCommandPlan<TApplication extends AssignmentApplicationCandidate>(input: {
  applications: TApplication[];
  jobId: string;
  jobTitle?: string | null;
  selectedNurseUserId: string;
  actorRole?: string;
}): AssignmentCommandPlan<TApplication> {
  const applicationPlan = createAssignmentApplicationPlan(input.applications, input.selectedNurseUserId);
  const canFinalize = Boolean(applicationPlan.selectedApplication && applicationPlan.selectedApplicationSelectable);

  return {
    ...applicationPlan,
    acceptSelectedApplication: canFinalize,
    rejectCompetingApplications: canFinalize,
    notifications: canFinalize
      ? buildAssignmentNotifications({
          jobId: input.jobId,
          jobTitle: input.jobTitle,
          selectedNurseUserId: input.selectedNurseUserId,
          rejectedNurseIds: applicationPlan.rejectedNurseIds
        })
      : [],
    audit:
      canFinalize && input.actorRole === "admin"
        ? { action: "job_assigned", metadata: { nurse_user_id: input.selectedNurseUserId } }
        : null
  };
}

export type TerminalJobStatus = "cancelled" | "completed";

export type TerminalJobNotification = {
  userId: string;
  type: "job_cancelled" | "job_completed" | "assigned_job_cancelled" | "assigned_job_completed";
  title: string;
  body: string;
  entityType: "job";
  entityId: string;
};

export type TerminalApplicationCandidate = {
  nurse_user_id?: string | null;
  status: string;
};

export type TerminalAuditPlan = {
  action: "job_cancelled" | "job_completed";
  metadata: Record<string, string>;
};

export type CancelJobCommandPlan = {
  decision: WorkflowErrorCategory | null;
  nextStatus: "cancelled";
  rejectAppliedApplications: boolean;
  notificationNurseUserIds: string[];
  audit: TerminalAuditPlan | null;
};

export type CompleteJobCommandPlan = {
  decision: WorkflowErrorCategory | null;
  nextStatus: "completed";
  notificationNurseUserIds: string[];
  audit: TerminalAuditPlan | null;
};

function activeTerminalNurseUserIds(applications: TerminalApplicationCandidate[]) {
  return applications
    .filter((application) => application.status === "accepted" || application.status === "applied")
    .map((application) => application.nurse_user_id)
    .filter((nurseUserId): nurseUserId is string => Boolean(nurseUserId));
}

export function createCancelJobCommandPlan(input: {
  actorRole: string;
  actorUserId: string;
  jobStatus: string;
  patientUserId?: string | null;
  applications: TerminalApplicationCandidate[];
}): CancelJobCommandPlan {
  const decision = getCancelJobDecision(input);

  return {
    decision,
    nextStatus: "cancelled",
    rejectAppliedApplications: !decision,
    notificationNurseUserIds: decision ? [] : activeTerminalNurseUserIds(input.applications),
    audit:
      !decision && input.actorRole === "admin"
        ? { action: "job_cancelled", metadata: { previous_status: input.jobStatus } }
        : null
  };
}

export function createCompleteJobCommandPlan(input: {
  actorRole: string;
  actorUserId: string;
  jobStatus: string;
  patientUserId?: string | null;
  acceptedNurseUserId?: string | null;
}): CompleteJobCommandPlan {
  const decision = getCompleteJobDecision(input);
  const acceptedNurseUserId = input.acceptedNurseUserId ?? "";

  return {
    decision,
    nextStatus: "completed",
    notificationNurseUserIds: decision ? [] : [acceptedNurseUserId],
    audit:
      !decision && input.actorRole === "admin"
        ? {
            action: "job_completed",
            metadata: { previous_status: input.jobStatus, nurse_user_id: acceptedNurseUserId }
          }
        : null
  };
}

export function buildTerminalJobNotifications(input: {
  jobId: string;
  jobTitle?: string | null;
  patientUserId?: string | null;
  status: TerminalJobStatus;
  nurseUserIds: string[];
}): TerminalJobNotification[] {
  const jobTitle = input.jobTitle || "Job";
  const notificationTitle = input.status === "cancelled" ? "Job cancelled" : "Job completed";
  const body = `${jobTitle} is now ${input.status}.`;
  const nurseUserIds = Array.from(new Set(input.nurseUserIds.filter(Boolean)));

  return [
    {
      userId: input.patientUserId,
      type: `job_${input.status}`,
      title: notificationTitle,
      body,
      entityType: "job",
      entityId: input.jobId
    },
    ...nurseUserIds.map((nurseUserId) => ({
      userId: nurseUserId,
      type: `assigned_job_${input.status}` as const,
      title: notificationTitle,
      body,
      entityType: "job" as const,
      entityId: input.jobId
    }))
  ].filter((notification): notification is TerminalJobNotification => Boolean(notification.userId));
}
