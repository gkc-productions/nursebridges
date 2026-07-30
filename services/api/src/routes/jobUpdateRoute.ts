import type { FastifyInstance, FastifyRequest } from "fastify";
import type { Authed } from "../auth.js";
import { updateJobSchema } from "../validators.js";
import type { createJobTerminalActions } from "./jobTerminalRoute.js";

type JobUpdateRouteDeps = {
  requireAuth(req: FastifyRequest): Promise<Authed>;
  terminalActions: ReturnType<typeof createJobTerminalActions>;
  supabaseForUser(jwt: string): any;
  writeAdminAuditLog(row: any): Promise<void>;
};

export async function registerJobUpdateRoute(app: FastifyInstance, deps: JobUpdateRouteDeps) {
  app.patch("/jobs/:jobId", async (req, reply) => {
    const authed = await deps.requireAuth(req);
    const { jobId } = req.params as any;
    const body = updateJobSchema.parse(req.body ?? {});

    let patch: Record<string, any> = {};

    if (authed.role === "patient") {
      if (body.status !== "cancelled") {
        return reply.code(400).send({ error: "Invalid job transition" });
      }

      const data = await deps.terminalActions.cancelJob(jobId, authed.userId, authed.role);
      return reply.send({ job: data });
    } else if (authed.role === "admin") {
      if (body.status === "cancelled") {
        const data = await deps.terminalActions.cancelJob(jobId, authed.userId, authed.role);
        return reply.send({ job: data });
      }
      if (body.status === "completed") {
        const data = await deps.terminalActions.completeJob(jobId, authed.userId, authed.role);
        return reply.send({ job: data });
      }

      patch = {
        ...(body.description !== undefined ? { description: body.description } : {}),
        ...(body.address !== undefined ? { address: body.address } : {}),
        ...(body.start_time !== undefined ? { start_time: body.start_time } : {}),
        ...(body.hourly_rate !== undefined ? { hourly_rate: body.hourly_rate } : {})
      };
    } else {
      return reply.code(403).send({ error: "Forbidden" });
    }

    const sb = deps.supabaseForUser(authed.jwt);
    const { data, error } = await sb.from("jobs").update(patch).eq("id", jobId).select("*").single();
    if (error) return reply.code(400).send({ error: "Unable to update job" });

    if (authed.role === "admin") {
      await deps.writeAdminAuditLog({
        actor_id: authed.userId,
        action: "job_status_update",
        entity_type: "job",
        entity_id: jobId,
        metadata: patch
      });
    }

    return reply.send({ job: data });
  });
}
