import type { FastifyInstance } from "fastify";
import { writeAdminAuditLog } from "../audit.js";
import { requireAuth, requireRole } from "../auth.js";
import { isApprovedNurse, markJobAssigned } from "../jobAssignment.js";
import { finalizeAppliedAssignmentWithRpc } from "../jobAssignmentCommand.js";
import { createNotifications } from "../notifications.js";
import { supabaseAdmin, supabaseForUser } from "../supabase.js";
import { registerApplicationDecisionRoute } from "./applicationDecisionRoute.js";

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

      if (error) return reply.code(400).send({ error: "Unable to load applications" });
      return reply.send({ applications: data ?? [] });
    }

    if (authed.role === "patient") {
      const { data, error } = await sb
        .from("applications")
        .select("*, jobs!inner(patient_user_id)")
        .eq("jobs.patient_user_id", authed.userId)
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) return reply.code(400).send({ error: "Unable to load applications" });
      return reply.send({ applications: data ?? [] });
    }

    return reply.code(403).send({ error: "Forbidden" });
  });

  await registerApplicationDecisionRoute(app, {
    requireAuth,
    requireRole,
    supabaseAdmin,
    isApprovedNurse,
    markJobAssigned,
    createNotifications,
    writeAdminAuditLog,
    finalizeAssignment: finalizeAppliedAssignmentWithRpc
  });
}
