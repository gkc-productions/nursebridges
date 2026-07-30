import {
  canAssignJob,
  createAssignmentCommandPlan,
  getWorkflowErrorHttpStatus,
  type WorkflowErrorCategory
} from "./workflowRules";

type AdminAssignmentDeps = {
  supabaseAdmin: any;
  createNotifications(notifications: any[]): Promise<void>;
  writeAdminAuditLog(row: any): Promise<void>;
};

function routeError(message: string, category: WorkflowErrorCategory) {
  return Object.assign(new Error(message), { statusCode: getWorkflowErrorHttpStatus(category), category });
}

function persistenceErrorCategory(error: any): WorkflowErrorCategory {
  return error?.code === "PGRST116" ? "conflict" : "storage_or_db_error";
}

async function isApprovedNurse(deps: AdminAssignmentDeps, nurseId: string) {
  const { data } = await deps.supabaseAdmin
    .from("nurse_profiles")
    .select("verification_status")
    .eq("nurse_id", nurseId)
    .maybeSingle();

  return data?.verification_status === "approved";
}

async function markJobAssigned(deps: AdminAssignmentDeps, jobId: string, nurseId: string) {
  const withAssignedColumn = await deps.supabaseAdmin
    .from("jobs")
    .update({ status: "assigned", assigned_nurse_user_id: nurseId })
    .eq("id", jobId)
    .eq("status", "open")
    .select("id")
    .single();

  if (!withAssignedColumn.error) return { error: null };

  const code = (withAssignedColumn.error as any).code;
  if (code !== "PGRST204" && code !== "42703") {
    return { error: withAssignedColumn.error };
  }

  const statusOnly = await deps.supabaseAdmin
    .from("jobs")
    .update({ status: "assigned" })
    .eq("id", jobId)
    .eq("status", "open")
    .select("id")
    .single();
  return { error: statusOnly.error };
}

export function createAdminJobAssignmentActions(deps: AdminAssignmentDeps) {
  async function assignJobAsAdmin(input: { jobId: string; nurseId: string; actorId: string }) {
    const { data: job, error: jobError } = await deps.supabaseAdmin
      .from("jobs")
      .select("id,status,title")
      .eq("id", input.jobId)
      .single();

    if (jobError || !job) {
      throw routeError("job_not_found", "not_found");
    }
    if (!canAssignJob(job.status)) {
      throw routeError("Invalid job transition", "invalid_transition");
    }
    if (!(await isApprovedNurse(deps, input.nurseId))) {
      throw routeError("Nurse verification required", "forbidden");
    }

    const { data: applications, error: applicationsError } = await deps.supabaseAdmin
      .from("applications")
      .select("id,status,nurse_user_id")
      .eq("job_id", input.jobId);

    if (applicationsError) {
      throw routeError("Unable to assign job", "storage_or_db_error");
    }

    const assignmentPlan = createAssignmentCommandPlan({
      applications: applications ?? [],
      jobId: input.jobId,
      jobTitle: job.title,
      selectedNurseUserId: input.nurseId,
      actorRole: "admin"
    });
    if (!assignmentPlan.selectedApplication) {
      throw routeError("Nurse has not applied to this job", "invalid_transition");
    }
    if (!assignmentPlan.selectedApplicationSelectable) {
      throw routeError("Application is not selectable", "invalid_transition");
    }

    const { error: jobUpdateError } = await markJobAssigned(deps, input.jobId, input.nurseId);

    if (jobUpdateError) {
      throw routeError("Unable to assign job", persistenceErrorCategory(jobUpdateError));
    }

    const { error: acceptError } = await deps.supabaseAdmin
      .from("applications")
      .update({ status: "accepted" })
      .eq("job_id", input.jobId)
      .eq("nurse_user_id", input.nurseId)
      .eq("status", "applied")
      .select("id")
      .single();

    if (acceptError) {
      throw routeError("Unable to assign job", persistenceErrorCategory(acceptError));
    }

    if (assignmentPlan.rejectCompetingApplications) {
      const { error: rejectError } = await deps.supabaseAdmin
        .from("applications")
        .update({ status: "rejected" })
        .eq("job_id", input.jobId)
        .eq("status", "applied")
        .neq("nurse_user_id", input.nurseId);

      if (rejectError) {
        throw routeError("Unable to assign job", persistenceErrorCategory(rejectError));
      }
    }

    await deps.createNotifications(assignmentPlan.notifications);

    if (assignmentPlan.audit) {
      await deps.writeAdminAuditLog({
        actor_id: input.actorId,
        action: assignmentPlan.audit.action,
        entity_type: "job",
        entity_id: input.jobId,
        metadata: assignmentPlan.audit.metadata
      });
    }

    return { ok: true };
  }

  return { assignJobAsAdmin };
}
