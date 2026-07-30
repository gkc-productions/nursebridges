import type { FastifyInstance, FastifyRequest } from "fastify";
import type { Authed, UserRole } from "../auth.js";
import { canWithdrawApplication } from "../jobWorkflow.js";

type JobWithdrawRouteDeps = {
  requireAuth(req: FastifyRequest): Promise<Authed>;
  requireRole(authed: Authed, roles: UserRole[]): void;
  supabaseForUser(jwt: string): any;
};

export async function registerJobWithdrawRoute(app: FastifyInstance, deps: JobWithdrawRouteDeps) {
  app.post("/jobs/:jobId/withdraw", async (req, reply) => {
    const authed = await deps.requireAuth(req);
    deps.requireRole(authed, ["nurse"]);

    const { jobId } = req.params as any;
    const sb = deps.supabaseForUser(authed.jwt);

    const { data: existingApplication, error: existingApplicationError } = await sb
      .from("applications")
      .select("id,status")
      .eq("job_id", jobId)
      .eq("nurse_user_id", authed.userId)
      .maybeSingle();

    if (existingApplicationError) {
      return reply.code(400).send({ error: "Unable to withdraw application" });
    }
    if (!existingApplication) {
      return reply.code(404).send({ error: "Application not found" });
    }
    if (!canWithdrawApplication((existingApplication as any).status)) {
      return reply.code(400).send({ error: "Application cannot be withdrawn" });
    }

    const { data, error } = await sb
      .from("applications")
      .update({ status: "withdrawn" })
      .eq("id", (existingApplication as any).id)
      .eq("job_id", jobId)
      .eq("nurse_user_id", authed.userId)
      .eq("status", "applied")
      .select("*")
      .single();

    if (error) return reply.code(400).send({ error: "Unable to withdraw application" });
    return reply.send({ application: data });
  });
}
