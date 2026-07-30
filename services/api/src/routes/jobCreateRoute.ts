import type { FastifyInstance, FastifyRequest } from "fastify";
import type { Authed, UserRole } from "../auth.js";
import { buildCreateJobPayload } from "../jobPayload.js";
import { createJobSchema } from "../validators.js";

type JobCreateRouteDeps = {
  requireAuth(req: FastifyRequest): Promise<Authed>;
  requireRole(authed: Authed, roles: UserRole[]): void;
  supabaseForUser(jwt: string): any;
};

export async function registerJobCreateRoute(app: FastifyInstance, deps: JobCreateRouteDeps) {
  app.post("/jobs", async (req, reply) => {
    const authed = await deps.requireAuth(req);
    deps.requireRole(authed, ["patient"]);

    const body = createJobSchema.parse(req.body ?? {});
    const sb = deps.supabaseForUser(authed.jwt);

    const payload = buildCreateJobPayload(authed.userId, body);

    const { data, error } = await sb.from("jobs").insert(payload).select("*").single();
    if (error) {
      req.log.warn({
        event: "create_job_failed",
        requestId: req.id,
        reason: "supabase_insert_error",
        userId: authed.userId,
        supabase: {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint
        }
      });
      return reply.code(400).send({ error: "Unable to create job", requestId: req.id });
    }

    return reply.send({ job: data });
  });
}
