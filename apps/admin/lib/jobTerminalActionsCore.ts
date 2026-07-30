import {
  buildTerminalJobNotifications,
  createCancelJobCommandPlan,
  createCompleteJobCommandPlan,
  getCancelJobDecision,
  getCompleteJobDecision,
  getWorkflowErrorHttpStatus,
  type JobStatus,
  type TerminalJobStatus,
  type WorkflowErrorCategory
} from "./workflowRules";

type JobRow = {
  id: string;
  status: JobStatus;
  patient_user_id: string | null;
  title: string | null;
};

type ApplicationRow = {
  nurse_user_id: string;
  status: string;
};

type AdminJobTerminalDeps = {
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

function transitionMessage(category: WorkflowErrorCategory) {
  return category === "forbidden" ? "Forbidden" : "Invalid job transition";
}

async function notifyJobStatus(
  deps: AdminJobTerminalDeps,
  job: { id: string; title?: string | null; patient_user_id?: string | null },
  status: TerminalJobStatus,
  nurseIds: string[]
) {
  await deps.createNotifications(
    buildTerminalJobNotifications({
      jobId: job.id,
      jobTitle: job.title,
      patientUserId: job.patient_user_id,
      status,
      nurseUserIds: nurseIds
    })
  );
}

export function createAdminJobTerminalActions(deps: AdminJobTerminalDeps) {
  async function fetchJob(jobId: string) {
    const { data, error } = await deps.supabaseAdmin
      .from("jobs")
      .select("id,status,patient_user_id,title")
      .eq("id", jobId)
      .maybeSingle();

    if (error) throw routeError("Unable to update job", "storage_or_db_error");
    if (!data) throw routeError("not_found", "not_found");

    return data as JobRow;
  }

  async function fetchApplications(jobId: string) {
    const { data, error } = await deps.supabaseAdmin
      .from("applications")
      .select("nurse_user_id,status")
      .eq("job_id", jobId);

    if (error) throw routeError("Unable to update job", "storage_or_db_error");

    return (data ?? []) as ApplicationRow[];
  }

  async function markJobStatus(jobId: string, currentStatus: string, nextStatus: "cancelled" | "completed") {
    const { data, error } = await deps.supabaseAdmin
      .from("jobs")
      .update({ status: nextStatus })
      .eq("id", jobId)
      .eq("status", currentStatus)
      .select("*")
      .single();

    if (error || !data) {
      throw routeError("Unable to update job", persistenceErrorCategory(error));
    }

    return data;
  }

  async function cancelJobAsAdmin(jobId: string, actorId: string) {
    const job = await fetchJob(jobId);
    const decision = getCancelJobDecision({
      actorRole: "admin",
      actorUserId: actorId,
      jobStatus: job.status,
      patientUserId: job.patient_user_id
    });
    if (decision) {
      throw routeError(transitionMessage(decision), decision);
    }

    const applications = await fetchApplications(jobId);
    const plan = createCancelJobCommandPlan({
      actorRole: "admin",
      actorUserId: actorId,
      jobStatus: job.status,
      patientUserId: job.patient_user_id,
      applications
    });

    if (plan.rejectAppliedApplications) {
      const { error: rejectError } = await deps.supabaseAdmin
        .from("applications")
        .update({ status: "rejected" })
        .eq("job_id", jobId)
        .eq("status", "applied");

      if (rejectError) throw routeError("Unable to update job", persistenceErrorCategory(rejectError));
    }

    const updatedJob = await markJobStatus(jobId, job.status, plan.nextStatus);

    await notifyJobStatus(deps, job, plan.nextStatus, plan.notificationNurseUserIds);
    if (plan.audit) {
      await deps.writeAdminAuditLog({
        actor_id: actorId,
        action: plan.audit.action,
        entity_type: "job",
        entity_id: jobId,
        metadata: plan.audit.metadata
      });
    }

    return updatedJob;
  }

  async function completeJobAsAdmin(jobId: string, actorId: string) {
    const job = await fetchJob(jobId);
    const applications = await fetchApplications(jobId);
    const acceptedNurseId =
      applications.find((application) => application.status === "accepted")?.nurse_user_id ?? null;

    const decision = getCompleteJobDecision({
      actorRole: "admin",
      actorUserId: actorId,
      jobStatus: job.status,
      patientUserId: job.patient_user_id,
      acceptedNurseUserId: acceptedNurseId
    });
    if (decision) {
      throw routeError(transitionMessage(decision), decision);
    }
    const acceptedNurseUserId = acceptedNurseId as string;
    const plan = createCompleteJobCommandPlan({
      actorRole: "admin",
      actorUserId: actorId,
      jobStatus: job.status,
      patientUserId: job.patient_user_id,
      acceptedNurseUserId
    });

    const updatedJob = await markJobStatus(jobId, job.status, plan.nextStatus);

    await notifyJobStatus(deps, job, plan.nextStatus, plan.notificationNurseUserIds);
    if (plan.audit) {
      await deps.writeAdminAuditLog({
        actor_id: actorId,
        action: plan.audit.action,
        entity_type: "job",
        entity_id: jobId,
        metadata: plan.audit.metadata
      });
    }

    return updatedJob;
  }

  return { cancelJobAsAdmin, completeJobAsAdmin };
}
