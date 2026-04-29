import type { FastifyInstance } from "fastify";
import { requireAuth } from "../auth.js";

export async function meRoutes(app: FastifyInstance) {
  app.get("/me", async (req, reply) => {
    const authed = await requireAuth(req);

    return reply.send({
      ok: true,
      userId: authed.userId,
      email: authed.email,
      role: authed.role
    });
  });

  app.get("/v1/me", async (req, reply) => {
    const authed = await requireAuth(req);

    return reply.send({
      ok: true,
      userId: authed.userId,
      email: authed.email,
      role: authed.role,
      profile: authed.profile
    });
  });
}
