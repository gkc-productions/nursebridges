import type { FastifyInstance, FastifyRequest } from "fastify";
import type { Authed, UserRole } from "../auth.js";
import { finalizeAppliedAssignment, type AssignmentFinalizer } from "../jobAssignmentCommand.js";
import { canAssignJob, canSelectApplication, getWorkflowErrorHttpStatus } from "../jobWorkflow.js";
import { decideApplicationSchema } from "../validators.js";

type ApplicationDecisionRouteDeps = {
  requireAuth(req: FastifyRequest): Promise<Authed>;
  requireRole(authed: Authed, roles: UserRole[]): void;
  supabaseAdmin: any | null;
  isApprovedNurse(nurseUserId: string): Promise<boolean>;
  markJobAssigned(jobId: string, nurseUserId: string): Promise<{ error: any }>;
  createNotifications(notifications: any[]): Promise<void>;
  writeAdminAuditLog?(row: any): Promise<void>;
  finalizeAssignment?: AssignmentFinalizer;
};

export async function registerApplicationDecisionRoute(app: FastifyInstance, deps: ApplicationDecisionRouteDeps) {
  app.post("/v1/applications/:applicationId/decide", async (req, reply) => {
    const authed = await deps.requireAuth(req);
    deps.requireRole(authed, ["patient"]);

    const { applicationId } = req.params as any;
    const body = decideApplicationSchema.parse(req.body ?? {});

    if (!deps.supabaseAdmin) {
      return reply.code(getWorkflowErrorHttpStatus("storage_or_db_error")).send({ error: "Admin client not configured" });
    }

    const { data: appRow, error: appErr } = await deps.supabaseAdmin
      .from("applications")
      .select("id,job_id,nurse_user_id,status")
      .eq("id", applicationId)
      .single();

    if (appErr || !appRow) return reply.code(getWorkflowErrorHttpStatus("not_found")).send({ error: "Application not found" });
    if (!canSelectApplication((appRow as any).status)) {
      return reply.code(getWorkflowErrorHttpStatus("invalid_transition")).send({ error: "Application is not selectable" });
    }

    const nextStatus = body.decision === "accept" ? "accepted" : "rejected";

    const { data: job, error: jobError } = await deps.supabaseAdmin
      .from("jobs")
      .select("id,status,patient_user_id,title")
      .eq("id", (appRow as any).job_id)
      .single();

    if (jobError || !job) {
      return reply.code(getWorkflowErrorHttpStatus("not_found")).send({ error: "Job not found" });
    }
    if (job.patient_user_id !== authed.userId) {
      return reply.code(getWorkflowErrorHttpStatus("forbidden")).send({ error: "Forbidden" });
    }

    if (body.decision === "accept") {
      if (!canAssignJob(job.status)) {
        return reply.code(getWorkflowErrorHttpStatus("invalid_transition")).send({ error: "Invalid job transition" });
      }
      if (!(await deps.isApprovedNurse((appRow as any).nurse_user_id))) {
        return reply.code(getWorkflowErrorHttpStatus("forbidden")).send({ error: "Nurse verification required" });
      }
      const finalizeAssignment = deps.finalizeAssignment ?? finalizeAppliedAssignment;
      const { error: assignmentError, category: assignmentErrorCategory } = await finalizeAssignment(
        {
          supabaseAdmin: deps.supabaseAdmin,
          markJobAssigned: deps.markJobAssigned,
          createNotifications: deps.createNotifications
        },
        {
          jobId: (appRow as any).job_id,
          jobTitle: (job as any).title,
          selectedApplicationId: applicationId,
          selectedNurseUserId: (appRow as any).nurse_user_id,
          actorId: authed.userId,
          actorRole: authed.role
        }
      );

      if (assignmentError) {
        return reply
          .code(getWorkflowErrorHttpStatus(assignmentErrorCategory ?? "storage_or_db_error"))
          .send({ error: "Unable to decide application" });
      }
    }

    let data: any = { ...appRow, status: nextStatus };
    if (body.decision === "reject") {
      const { data: rejectedApplication, error } = await deps.supabaseAdmin
        .from("applications")
        .update({ status: nextStatus })
        .eq("id", applicationId)
        .eq("status", "applied")
        .select("*")
        .single();

      if (error) {
        return reply.code(getWorkflowErrorHttpStatus("storage_or_db_error")).send({ error: "Unable to decide application" });
      }
      data = rejectedApplication;
    }

    await deps.writeAdminAuditLog?.({
      actor_id: authed.userId,
      action: "application_decision",
      entity_type: "application",
      entity_id: applicationId,
      metadata: {
        decision: body.decision,
        status: nextStatus,
        job_id: (appRow as any).job_id,
        nurse_user_id: (appRow as any).nurse_user_id
      }
    });

    return reply.send({ application: data });
  });
}
