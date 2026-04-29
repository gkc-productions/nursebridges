import type { FastifyInstance } from "fastify";
import { requireAuth, requireRole } from "../auth";
import { supabaseAdmin, supabaseForUser } from "../supabase";
import { applyJobSchema, createJobSchema, updateJobSchema } from "../validators";

type JobRow = {
  id: string;
  status: string;
  patient_user_id: string | null;
  title: string;
  description: string | null;
  address: string | null;
  start_time: string | null;
  hourly_rate: number | null;
  created_at: string;
};

type ApplicationRow = {
  job_id: string;
  nurse_user_id: string;
  status: string;
  created_at: string;
};

async function fetchAssignedNurseMap(jobIds: string[], jwt: string) {
  if (jobIds.length === 0) return { assigned: new Map<string, string>(), names: new Map<string, string>() };

  const sb = supabaseForUser(jwt);
  const { data: apps } = await sb
    .from("applications")
    .select("job_id,nurse_user_id,status")
    .in("job_id", jobIds)
    .eq("status", "accepted");

  const assigned = new Map<string, string>();
  for (const row of apps ?? []) {
    const app = row as ApplicationRow;
    if (!assigned.has(app.job_id)) assigned.set(app.job_id, app.nurse_user_id);
  }

  const nurseIds = Array.from(new Set(Array.from(assigned.values())));
  const names = new Map<string, string>();

  if (nurseIds.length > 0 && supabaseAdmin) {
    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id,full_name")
      .in("id", nurseIds);

    for (const p of profiles ?? []) {
      names.set(p.id as string, (p as any).full_name ?? "");
    }
  }

  return { assigned, names };
}

export async function jobRoutes(app: FastifyInstance) {
  // Create job (patient only)
  app.post("/jobs", async (req, reply) => {
    const authed = await requireAuth(req);
    requireRole(authed, ["patient"]);

    const body = createJobSchema.parse(req.body ?? {});
    const sb = supabaseForUser(authed.jwt);

    const payload = {
      created_by: authed.userId,
      patient_user_id: authed.userId,
      title: body.title,
      description: body.description ?? null,
      address: body.address ?? null,
      start_time: body.start_time ?? null,
      hourly_rate: body.hourly_rate ?? null,
      status: "open"
    };

    const { data, error } = await sb.from("jobs").insert(payload).select("*").single();
    if (error) return reply.code(400).send({ error: error.message });

    return reply.send({ job: data });
  });

  // List jobs (role-aware; relies on RLS)
  app.get("/jobs", async (req, reply) => {
    const authed = await requireAuth(req);
    const sb = supabaseForUser(authed.jwt);

    const { data, error } = await sb
      .from("jobs")
      .select("id,status,patient_user_id,title,description,address,start_time,hourly_rate,created_at")
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) return reply.code(400).send({ error: error.message });

    const jobs = (data ?? []) as JobRow[];
    const jobIds = jobs.map((job) => job.id);
    const { assigned, names } = await fetchAssignedNurseMap(jobIds, authed.jwt);

    const merged = jobs.map((job) => {
      const nurseId = assigned.get(job.id) ?? null;
      return {
        ...job,
        assigned_nurse_user_id: nurseId,
        assigned_nurse_name: nurseId ? names.get(nurseId) ?? null : null
      };
    });

    return reply.send({ jobs: merged });
  });

  // Job detail (role-aware)
  app.get("/jobs/:jobId", async (req, reply) => {
    const authed = await requireAuth(req);
    const { jobId } = req.params as any;
    const sb = supabaseForUser(authed.jwt);

    const { data: job, error } = await sb
      .from("jobs")
      .select("id,status,patient_user_id,title,description,address,start_time,hourly_rate,created_at")
      .eq("id", jobId)
      .single();

    if (error || !job) return reply.code(404).send({ error: "Job not found" });

    const { assigned, names } = await fetchAssignedNurseMap([jobId], authed.jwt);
    const nurseId = assigned.get(jobId) ?? null;

    return reply.send({
      job: {
        ...(job as JobRow),
        assigned_nurse_user_id: nurseId,
        assigned_nurse_name: nurseId ? names.get(nurseId) ?? null : null
      }
    });
  });

  // Update job (patient can cancel; admin can update status)
  app.patch("/jobs/:jobId", async (req, reply) => {
    const authed = await requireAuth(req);
    const { jobId } = req.params as any;
    const body = updateJobSchema.parse(req.body ?? {});
    const sb = supabaseForUser(authed.jwt);

    let patch: Record<string, any> = {};

    if (authed.role === "patient") {
      patch = { status: "closed" };
    } else if (authed.role === "admin") {
      patch = {
        ...(body.status ? { status: body.status } : {}),
        ...(body.description !== undefined ? { description: body.description } : {}),
        ...(body.address !== undefined ? { address: body.address } : {}),
        ...(body.start_time !== undefined ? { start_time: body.start_time } : {}),
        ...(body.hourly_rate !== undefined ? { hourly_rate: body.hourly_rate } : {})
      };
    } else {
      return reply.code(403).send({ error: "Forbidden" });
    }

    const { data, error } = await sb.from("jobs").update(patch).eq("id", jobId).select("*").single();
    if (error) return reply.code(400).send({ error: error.message });

    if (authed.role === "admin" && supabaseAdmin) {
      await supabaseAdmin.from("admin_audit_logs").insert({
        actor_id: authed.userId,
        action: "job_status_update",
        entity_type: "job",
        entity_id: jobId,
        metadata: patch
      });
    }

    return reply.send({ job: data });
  });

  // Nurse applies to job
  app.post("/jobs/:jobId/apply", async (req, reply) => {
    const authed = await requireAuth(req);
    requireRole(authed, ["nurse"]);

    const { jobId } = req.params as any;
    const body = applyJobSchema.parse(req.body ?? {});
    const sb = supabaseForUser(authed.jwt);

    const { data: job, error: jobErr } = await sb
      .from("jobs")
      .select("id,status")
      .eq("id", jobId)
      .single();

    if (jobErr || !job) return reply.code(404).send({ error: "Job not found" });
    if (job.status !== "open") return reply.code(400).send({ error: "Job is not open" });

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

    if (error) return reply.code(400).send({ error: error.message });
    return reply.send({ application: data });
  });

  // Nurse withdraws application
  app.post("/jobs/:jobId/withdraw", async (req, reply) => {
    const authed = await requireAuth(req);
    requireRole(authed, ["nurse"]);

    const { jobId } = req.params as any;
    const sb = supabaseForUser(authed.jwt);

    const { data, error } = await sb
      .from("applications")
      .update({ status: "withdrawn" })
      .eq("job_id", jobId)
      .eq("nurse_user_id", authed.userId)
      .select("*")
      .single();

    if (error) return reply.code(400).send({ error: error.message });
    return reply.send({ application: data });
  });

  // Patient/admin list applications for job
  app.get("/jobs/:jobId/applications", async (req, reply) => {
    const authed = await requireAuth(req);
    const { jobId } = req.params as any;

    if (authed.role !== "patient" && authed.role !== "admin") {
      return reply.code(403).send({ error: "Forbidden" });
    }

    const sb = supabaseForUser(authed.jwt);
    const { data, error } = await sb
      .from("applications")
      .select("id,job_id,nurse_user_id,status,created_at")
      .eq("job_id", jobId)
      .order("created_at", { ascending: false });

    if (error) return reply.code(400).send({ error: error.message });

    return reply.send({ applications: data ?? [] });
  });
}
