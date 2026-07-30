import type { FastifyInstance, FastifyRequest } from "fastify";
import type { Authed } from "../auth.js";
import {
  buildTerminalJobNotifications,
  createCancelJobCommandPlan,
  createCompleteJobCommandPlan,
  getCancelJobDecision,
  getCompleteJobDecision,
  getWorkflowErrorHttpStatus,
  type TerminalJobStatus,
  type WorkflowErrorCategory
} from "../jobWorkflow.js";
import { markJobCancelledWithClient, markJobCompletedWithClient } from "../jobStatusCore.js";

type TerminalActionDeps = {
  supabaseAdmin: any | null;
  createNotifications(notifications: any[]): Promise<void>;
  writeAdminAuditLog(row: any): Promise<void>;
};

type TerminalRouteDeps = {
  requireAuth(req: FastifyRequest): Promise<Authed>;
  actions: ReturnType<typeof createJobTerminalActions>;
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
  deps: TerminalActionDeps,
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

export function createJobTerminalActions(deps: TerminalActionDeps) {
  async function fetchAcceptedNurseId(jobId: string) {
    if (!deps.supabaseAdmin) return null;

    const { data } = await deps.supabaseAdmin
      .from("applications")
      .select("nurse_user_id")
      .eq("job_id", jobId)
      .eq("status", "accepted")
      .maybeSingle();

    return (data?.nurse_user_id as string | undefined) ?? null;
  }

  async function fetchJobApplications(jobId: string) {
    if (!deps.supabaseAdmin) return [];

    const { data } = await deps.supabaseAdmin
      .from("applications")
      .select("nurse_user_id,status")
      .eq("job_id", jobId);

    return (data ?? []) as Array<{ nurse_user_id: string; status: string }>;
  }

  async function cancelJob(jobId: string, actorId: string, actorRole: string) {
    if (!deps.supabaseAdmin) {
      throw routeError("Admin client not configured", "storage_or_db_error");
    }

    const { data: job, error: jobError } = await deps.supabaseAdmin
      .from("jobs")
      .select("id,status,patient_user_id,title")
      .eq("id", jobId)
      .maybeSingle();

    if (jobError) throw routeError("Unable to update job", "storage_or_db_error");
    if (!job) throw routeError("Job not found", "not_found");

    const decision = getCancelJobDecision({
      actorRole,
      actorUserId: actorId,
      jobStatus: job.status,
      patientUserId: job.patient_user_id
    });
    if (decision) {
      throw routeError(transitionMessage(decision), decision);
    }

    const applications = await fetchJobApplications(jobId);
    const plan = createCancelJobCommandPlan({
      actorRole,
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

    const { data, error } = await markJobCancelledWithClient(deps.supabaseAdmin, jobId, job.status);

    if (error) throw routeError("Unable to update job", persistenceErrorCategory(error));

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

    return data;
  }

  async function completeJob(jobId: string, actorId: string, actorRole: string) {
    if (!deps.supabaseAdmin) {
      throw routeError("Admin client not configured", "storage_or_db_error");
    }

    const { data: job, error: jobError } = await deps.supabaseAdmin
      .from("jobs")
      .select("id,status,patient_user_id,title")
      .eq("id", jobId)
      .maybeSingle();

    if (jobError) throw routeError("Unable to update job", "storage_or_db_error");
    if (!job) throw routeError("Job not found", "not_found");

    const acceptedNurseId = await fetchAcceptedNurseId(jobId);
    const decision = getCompleteJobDecision({
      actorRole,
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
      actorRole,
      actorUserId: actorId,
      jobStatus: job.status,
      patientUserId: job.patient_user_id,
      acceptedNurseUserId
    });

    const { data, error } = await markJobCompletedWithClient(deps.supabaseAdmin, jobId, job.status);

    if (error) throw routeError("Unable to update job", persistenceErrorCategory(error));

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

    return data;
  }

  return { cancelJob, completeJob };
}

export async function registerJobTerminalRoutes(app: FastifyInstance, deps: TerminalRouteDeps) {
  app.patch("/jobs/:jobId/cancel", async (req, reply) => {
    const authed = await deps.requireAuth(req);
    const { jobId } = req.params as any;
    const job = await deps.actions.cancelJob(jobId, authed.userId, authed.role);
    return reply.send({ job });
  });

  app.patch("/jobs/:jobId/complete", async (req, reply) => {
    const authed = await deps.requireAuth(req);
    const { jobId } = req.params as any;
    const job = await deps.actions.completeJob(jobId, authed.userId, authed.role);
    return reply.send({ job });
  });
}
