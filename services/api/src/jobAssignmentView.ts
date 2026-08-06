export type AssignmentViewJob = {
  id: string;
  assigned_nurse_user_id?: string | null;
};

export type AcceptedApplication = {
  job_id: string;
  nurse_user_id: string;
};

export function buildAssignedNurseMap(
  jobs: AssignmentViewJob[],
  acceptedApplications: AcceptedApplication[]
) {
  const assigned = new Map<string, string>();

  for (const application of acceptedApplications) {
    if (!assigned.has(application.job_id)) {
      assigned.set(application.job_id, application.nurse_user_id);
    }
  }

  for (const job of jobs) {
    if (!assigned.has(job.id) && job.assigned_nurse_user_id) {
      assigned.set(job.id, job.assigned_nurse_user_id);
    }
  }

  return assigned;
}
