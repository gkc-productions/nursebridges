export type JobDetailSource = {
  id: string;
  status: string;
  created_at: string;
  updated_at?: string | null;
  assigned_nurse_user_id?: string | null;
};

export type JobApplicationSource = {
  nurse_user_id: string;
  status: string;
};

export type JobAuditSource = {
  id: string;
  action: string;
  actor_id?: string | null;
  created_at: string;
};

export type JobTimelineEvent = {
  id: string;
  type: string;
  created_at: string;
  actor_name: string | null;
};

export function resolveAssignedNurseId(
  job: JobDetailSource,
  applications: JobApplicationSource[]
) {
  return (
    job.assigned_nurse_user_id ??
    applications.find((application) => application.status === "accepted")?.nurse_user_id ??
    null
  );
}

export function buildJobTimeline(input: {
  job: JobDetailSource;
  auditEvents: JobAuditSource[];
  identityLabels: Map<string, string>;
  patientName: string | null;
}) {
  const events: JobTimelineEvent[] = input.auditEvents.map((event) => ({
    id: event.id,
    type: event.action,
    created_at: event.created_at,
    actor_name: event.actor_id
      ? input.identityLabels.get(event.actor_id) ?? "System record"
      : "System record"
  }));

  if (!events.some((event) => event.type === "job_created")) {
    events.push({
      id: `job-created-${input.job.id}`,
      type: "job_created",
      created_at: input.job.created_at,
      actor_name: input.patientName ?? "Patient"
    });
  }

  const currentStatusEvent = `job_${input.job.status}`;
  if (
    input.job.status !== "open" &&
    !events.some((event) => event.type === currentStatusEvent)
  ) {
    events.push({
      id: `job-status-${input.job.id}-${input.job.status}`,
      type: currentStatusEvent,
      created_at: input.job.updated_at ?? input.job.created_at,
      actor_name: "System record"
    });
  }

  return events.sort(
    (left, right) =>
      new Date(left.created_at).getTime() - new Date(right.created_at).getTime()
  );
}
