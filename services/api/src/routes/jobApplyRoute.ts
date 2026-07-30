import type { FastifyInstance, FastifyRequest } from "fastify";
import type { Authed, UserRole } from "../auth.js";
import { canApplyToJob } from "../jobWorkflow.js";
import { applyJobSchema } from "../validators.js";

type JobApplyRouteDeps = {
  requireAuth(req: FastifyRequest): Promise<Authed>;
  requireRole(authed: Authed, roles: UserRole[]): void;
  requireVerifiedNurse(userId: string, jwt: string): Promise<void>;
  supabaseAdmin: any | null;
  supabaseForUser(jwt: string): any;
  createNotification(notification: any): Promise<void>;
};

export async function registerJobApplyRoute(app: FastifyInstance, deps: JobApplyRouteDeps) {
  app.post("/jobs/:jobId/apply", async (req, reply) => {
    const authed = await deps.requireAuth(req);
    deps.requireRole(authed, ["nurse"]);
    await deps.requireVerifiedNurse(authed.userId, authed.jwt);

    const { jobId } = req.params as any;
    const body = applyJobSchema.parse(req.body ?? {});
    const sb = deps.supabaseForUser(authed.jwt);

    const jobClient = deps.supabaseAdmin ?? sb;
    const { data: job, error: jobErr } = await jobClient.from("jobs").select("id,status").eq("id", jobId).single();

    if (jobErr || !job) return reply.code(404).send({ error: "Job not found" });
    if (!canApplyToJob(job.status)) {
      return reply.code(400).send({ error: "Invalid job transition" });
    }

    const { data: existingApplication, error: existingApplicationError } = await sb
      .from("applications")
      .select("id,status")
      .eq("job_id", jobId)
      .eq("nurse_user_id", authed.userId)
      .maybeSingle();

    if (existingApplicationError) {
      return reply.code(400).send({ error: "Unable to apply to job" });
    }
    if (existingApplication) {
      return reply.code(409).send({ error: "Application already exists" });
    }

    const { data, error } = await sb
      .from("applications")
      .insert({
        job_id: jobId,
        nurse_user_id: authed.userId,
        status: "applied",
        note: body.note ?? ""
      })
      .select("*")
      .single();

    if (error) {
      const code = (error as any).code;
      return reply
        .code(code === "23505" ? 409 : 400)
        .send({ error: code === "23505" ? "Application already exists" : "Unable to apply to job" });
    }

    if (deps.supabaseAdmin) {
      const { data: jobForNotification } = await deps.supabaseAdmin
        .from("jobs")
        .select("id,title,patient_user_id")
        .eq("id", jobId)
        .maybeSingle();

      await deps.createNotification({
        userId: jobForNotification?.patient_user_id,
        type: "nurse_applied",
        title: "New nurse application",
        body: `${authed.email ?? "A nurse"} applied to ${jobForNotification?.title ?? "your job"}.`,
        entityType: "job",
        entityId: jobId
      });
    }

    return reply.send({ application: data });
  });
}
