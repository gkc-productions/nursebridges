import type { FastifyInstance } from "fastify";
import { requireAuth, requireRole } from "../auth";
import { supabaseForUser } from "../supabase";
import { decideApplicationSchema } from "../validators";

export async function applicationRoutes(app: FastifyInstance) {
  // List applications:
  // - nurse: their applications
  // - patient: applications for their jobs
  app.get("/v1/applications", async (req, reply) => {
    const authed = await requireAuth(req);
    const sb = supabaseForUser(authed.jwt);

    if (authed.role === "nurse") {
      const { data, error } = await sb
        .from("applications")
        .select("*")
        .eq("nurse_user_id", authed.userId)
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) return reply.code(400).send({ error: error.message });
      return reply.send({ applications: data ?? [] });
    }

    if (authed.role === "patient") {
      const { data, error } = await sb
        .from("applications")
        .select("*, jobs!inner(patient_user_id)")
        .eq("jobs.patient_user_id", authed.userId)
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) return reply.code(400).send({ error: error.message });
      return reply.send({ applications: data ?? [] });
    }

    return reply.code(403).send({ error: "Forbidden" });
  });

  // Patient decides application (accept/reject) for their job
  app.post("/v1/applications/:applicationId/decide", async (req, reply) => {
    const authed = await requireAuth(req);
    requireRole(authed, ["patient"]);

    const { applicationId } = req.params as any;
    const body = decideApplicationSchema.parse(req.body ?? {});
    const sb = supabaseForUser(authed.jwt);

    const { data: appRow, error: appErr } = await sb
      .from("applications")
      .select("id, job_id, nurse_user_id, status, jobs!inner(patient_user_id)")
      .eq("id", applicationId)
      .eq("jobs.patient_user_id", authed.userId)
      .single();

    if (appErr || !appRow) return reply.code(404).send({ error: "Application not found" });

    const nextStatus = body.decision === "accept" ? "accepted" : "rejected";

    const { data, error } = await sb
      .from("applications")
      .update({ status: nextStatus })
      .eq("id", applicationId)
      .select("*")
      .single();

    if (error) return reply.code(400).send({ error: error.message });
    return reply.send({ application: data });
  });
}
