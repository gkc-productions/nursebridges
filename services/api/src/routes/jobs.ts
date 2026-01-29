import type { FastifyInstance } from "fastify";
import { requireAuth, requireRole } from "../auth";
import { supabaseForUser } from "../supabase";
import { createJobSchema, applyJobSchema } from "../validators";

export async function jobRoutes(app: FastifyInstance) {
  // Create a job (patient only)
  app.post("/v1/jobs", async (req, reply) => {
    const authed = await requireAuth(req);
    requireRole(authed, ["patient"]);

    const body = createJobSchema.parse(req.body ?? {});
    const sb = supabaseForUser(authed.jwt);

    const payload: any = {
      patient_user_id: authed.userId,
      title: body.title,
      description: body.description ?? "",
      location: body.location ?? "",
      status: "open",
    };

    if (body.scheduled_at) payload.scheduled_at = body.scheduled_at;

    const { data, error } = await sb.from("jobs").insert(payload).select("*").single();
    if (error) return reply.code(400).send({ ok: false, error: error.message });

    return reply.send({ ok: true, job: data });
  });

  // List jobs:
  // - patient: only their jobs
  // - nurse: open jobs
  // - admin: all jobs (RLS might block; we will allow admin later via admin route)
  app.get("/v1/jobs", async (req, reply) => {
    const authed = await requireAuth(req);
    const sb = supabaseForUser(authed.jwt);

    let q = sb.from("jobs").select("*").order("created_at", { ascending: false }).limit(100);

    if (authed.role === "patient") {
      q = q.eq("patient_user_id", authed.userId);
    } else if (authed.role === "nurse") {
      q = q.eq("status", "open");
    }

    const { data, error } = await q;
    if (error) return reply.code(400).send({ ok: false, error: error.message });

    return reply.send({ ok: true, jobs: data ?? [] });
  });

  // Nurse applies to a job
  app.post("/v1/jobs/:jobId/apply", async (req, reply) => {
    const authed = await requireAuth(req);
    requireRole(authed, ["nurse"]);

    const { jobId } = req.params as any;
    const body = applyJobSchema.parse(req.body ?? {});
    const sb = supabaseForUser(authed.jwt);

    // Ensure job exists and open (RLS may still allow select)
    const { data: job, error: jobErr } = await sb.from("jobs").select("id,status").eq("id", jobId).single();
    if (jobErr) return reply.code(404).send({ ok: false, error: "Job not found or not accessible" });
    if (job.status !== "open") return reply.code(400).send({ ok: false, error: "Job is not open" });

    const { data, error } = await sb
      .from("applications")
      .insert({
        job_id: jobId,
        nurse_user_id: authed.userId,
        status: "applied",
        note: body.note ?? "",
      })
      .select("*")
      .single();

    if (error) return reply.code(400).send({ ok: false, error: error.message });
    return reply.send({ ok: true, application: data });
  });
}
