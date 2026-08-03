import type { FastifyInstance, FastifyRequest } from "fastify";
import type { Authed, UserRole } from "../auth.js";
import { finalizeAppliedAssignment, type AssignmentFinalizer } from "../jobAssignmentCommand.js";
import { canAssignJob, createAssignmentCommandPlan, getWorkflowErrorHttpStatus } from "../jobWorkflow.js";

type AssignmentRouteDeps = {
  requireAuth(req: FastifyRequest): Promise<Authed>;
  requireRole(authed: Authed, roles: UserRole[]): void;
  supabaseAdmin: any | null;
  supabaseForUser(jwt: string): any;
  isApprovedNurse(nurseUserId: string): Promise<boolean>;
  markJobAssigned(jobId: string, nurseUserId: string): Promise<{ error: any }>;
  createNotifications(notifications: any[]): Promise<void>;
  writeAdminAuditLog(row: any): Promise<void>;
  finalizeAssignment?: AssignmentFinalizer;
};

export async function registerAdminAssignmentRoute(app: FastifyInstance, deps: AssignmentRouteDeps) {
  app.post("/admin/jobs/assign", async (req, reply) => {
    const authed = await deps.requireAuth(req);
    deps.requireRole(authed, ["admin"]);

    const body = (req.body ?? {}) as { jobId?: string; nurseUserId?: string };
    if (!body.jobId || !body.nurseUserId) {
      return reply.code(400).send({ error: "Missing jobId or nurseUserId" });
    }

    if (!deps.supabaseAdmin) {
      return reply.code(getWorkflowErrorHttpStatus("storage_or_db_error")).send({ error: "Admin client not configured" });
    }

    const { data: job, error: jobError } = await deps.supabaseAdmin
      .from("jobs")
      .select("id,status,title,patient_user_id")
      .eq("id", body.jobId)
      .single();

    if (jobError || !job) {
      return reply.code(getWorkflowErrorHttpStatus("not_found")).send({ error: "Job not found" });
    }
    if (!canAssignJob(job.status)) {
      return reply.code(getWorkflowErrorHttpStatus("invalid_transition")).send({ error: "Invalid job transition" });
    }
    if (!(await deps.isApprovedNurse(body.nurseUserId))) {
      return reply.code(getWorkflowErrorHttpStatus("forbidden")).send({ error: "Nurse verification required" });
    }

    const { data: applications, error: applicationsError } = await deps.supabaseAdmin
      .from("applications")
      .select("id,status,nurse_user_id")
      .eq("job_id", body.jobId);

    if (applicationsError) {
      return reply.code(getWorkflowErrorHttpStatus("storage_or_db_error")).send({ error: "Unable to assign job" });
    }

    const assignmentPlan = createAssignmentCommandPlan({
      applications: applications ?? [],
      jobId: body.jobId,
      jobTitle: job.title,
      selectedNurseUserId: body.nurseUserId,
          ...(job.patient_user_id ? { patientUserId: job.patient_user_id } : {}),
      actorRole: "admin"
    });

    if (!assignmentPlan.selectedApplication) {
      return reply.code(400).send({ error: "Nurse has not applied to this job" });
    }
    if (!assignmentPlan.selectedApplicationSelectable) {
      return reply.code(400).send({ error: "Application is not selectable" });
    }

    const finalizeAssignment = deps.finalizeAssignment ?? finalizeAppliedAssignment;
    const { error: assignmentError, category: assignmentErrorCategory } = await finalizeAssignment(
      {
        supabaseAdmin: deps.supabaseAdmin,
        markJobAssigned: deps.markJobAssigned,
        createNotifications: deps.createNotifications
      },
      {
        jobId: body.jobId,
        jobTitle: job.title,
        selectedApplicationId: (assignmentPlan.selectedApplication as any).id,
        selectedNurseUserId: body.nurseUserId,
        ...(job.patient_user_id ? { patientUserId: job.patient_user_id } : {}),
        actorId: authed.userId,
        actorRole: authed.role
      }
    );

    if (assignmentError) {
      return reply
        .code(getWorkflowErrorHttpStatus(assignmentErrorCategory ?? "storage_or_db_error"))
        .send({ error: "Unable to assign job" });
    }

    await deps.writeAdminAuditLog({
      actor_id: authed.userId,
      action: assignmentPlan.audit?.action ?? "job_assigned",
      entity_type: "job",
      entity_id: body.jobId,
      metadata: assignmentPlan.audit?.metadata ?? { nurse_user_id: body.nurseUserId }
    });

    const sb = deps.supabaseForUser(authed.jwt);
    const { data: updatedJob } = await sb
      .from("jobs")
      .select("id,status,patient_user_id,title,description,address,start_time,hourly_rate,created_at")
      .eq("id", body.jobId)
      .single();

    return reply.send({ job: updatedJob });
  });
}
