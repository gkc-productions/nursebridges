import type { FastifyInstance } from "fastify";
import { requireAuth, requireRole } from "../auth";
import { supabaseAdmin, supabaseForUser } from "../supabase";

export async function adminRoutes(app: FastifyInstance) {
  app.post("/admin/jobs/assign", async (req, reply) => {
    const authed = await requireAuth(req);
    requireRole(authed, ["admin"]);

    const body = (req.body ?? {}) as { jobId?: string; nurseUserId?: string };
    if (!body.jobId || !body.nurseUserId) {
      return reply.code(400).send({ error: "Missing jobId or nurseUserId" });
    }

    if (!supabaseAdmin) {
      return reply.code(500).send({ error: "Admin client not configured" });
    }

    const { data: job, error: jobError } = await supabaseAdmin
      .from("jobs")
      .select("id")
      .eq("id", body.jobId)
      .single();

    if (jobError || !job) {
      return reply.code(404).send({ error: "Job not found" });
    }

    const { error: acceptError } = await supabaseAdmin
      .from("applications")
      .update({ status: "accepted" })
      .eq("job_id", body.jobId)
      .eq("nurse_user_id", body.nurseUserId);

    if (acceptError) {
      return reply.code(400).send({ error: acceptError.message });
    }

    const { error: rejectError } = await supabaseAdmin
      .from("applications")
      .update({ status: "rejected" })
      .eq("job_id", body.jobId)
      .neq("nurse_user_id", body.nurseUserId);

    if (rejectError) {
      return reply.code(400).send({ error: rejectError.message });
    }

    const { error: jobUpdateError } = await supabaseAdmin
      .from("jobs")
      .update({ status: "assigned" })
      .eq("id", body.jobId);

    if (jobUpdateError) {
      return reply.code(400).send({ error: jobUpdateError.message });
    }

    await supabaseAdmin.from("admin_audit_logs").insert({
      actor_id: authed.userId,
      action: "job_assigned",
      entity_type: "job",
      entity_id: body.jobId,
      metadata: { nurse_user_id: body.nurseUserId }
    });

    const sb = supabaseForUser(authed.jwt);
    const { data: updatedJob } = await sb
      .from("jobs")
      .select("id,status,patient_user_id,title,description,address,start_time,hourly_rate,created_at")
      .eq("id", body.jobId)
      .single();

    return reply.send({ job: updatedJob });
  });
}
