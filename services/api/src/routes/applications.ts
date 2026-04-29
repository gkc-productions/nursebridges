import type { FastifyInstance } from "fastify";
import { requireAuth, requireRole } from "../auth.js";
import { createNotifications } from "../notifications.js";
import { supabaseAdmin, supabaseForUser } from "../supabase.js";
import { decideApplicationSchema } from "../validators.js";

function isTerminalJobStatus(status: string) {
  return status === "cancelled" || status === "completed";
}

async function isApprovedNurse(nurseUserId: string) {
  if (!supabaseAdmin) return false;

  const { data } = await supabaseAdmin
    .from("nurse_profiles")
    .select("verification_status")
    .eq("nurse_id", nurseUserId)
    .maybeSingle();

  return data?.verification_status === "approved";
}

async function markJobAssigned(jobId: string, nurseUserId: string) {
  if (!supabaseAdmin) return { error: new Error("Admin client not configured") };

  const withAssignedColumn = await supabaseAdmin
    .from("jobs")
    .update({ status: "assigned", assigned_nurse_user_id: nurseUserId })
    .eq("id", jobId);

  if (!withAssignedColumn.error) return { error: null };

  const code = (withAssignedColumn.error as any).code;
  if (code !== "PGRST204" && code !== "42703") {
    return { error: withAssignedColumn.error };
  }

  const statusOnly = await supabaseAdmin.from("jobs").update({ status: "assigned" }).eq("id", jobId);
  return { error: statusOnly.error };
}

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

  // Patient decides application (accept/reject) for their job
  app.post("/v1/applications/:applicationId/decide", async (req, reply) => {
    const authed = await requireAuth(req);
    requireRole(authed, ["patient"]);

    const { applicationId } = req.params as any;
    const body = decideApplicationSchema.parse(req.body ?? {});

    if (!supabaseAdmin) {
      return reply.code(500).send({ error: "Admin client not configured" });
    }

    const { data: appRow, error: appErr } = await supabaseAdmin
      .from("applications")
      .select("id,job_id,nurse_user_id,status")
      .eq("id", applicationId)
      .single();

    if (appErr || !appRow) return reply.code(404).send({ error: "Application not found" });

    const nextStatus = body.decision === "accept" ? "accepted" : "rejected";

    const { data: job, error: jobError } = await supabaseAdmin
      .from("jobs")
      .select("id,status,patient_user_id")
      .eq("id", (appRow as any).job_id)
      .single();

    if (jobError || !job) {
      return reply.code(404).send({ error: "Job not found" });
    }
    if (job.patient_user_id !== authed.userId) {
      return reply.code(403).send({ error: "Forbidden" });
    }

    if (body.decision === "accept") {
      if (job.status !== "open" || isTerminalJobStatus(job.status)) {
        return reply.code(400).send({ error: "Invalid job transition" });
      }
      if (!(await isApprovedNurse((appRow as any).nurse_user_id))) {
        return reply.code(403).send({ error: "Nurse verification required" });
      }
    }

    const { data, error } = await supabaseAdmin
      .from("applications")
      .update({ status: nextStatus })
      .eq("id", applicationId)
      .select("*")
      .single();

    if (error) return reply.code(400).send({ error: "Unable to decide application" });

    if (body.decision === "accept") {
      const { data: rejectedApplications } = await supabaseAdmin
        .from("applications")
        .select("nurse_user_id,status")
        .eq("job_id", (appRow as any).job_id)
        .neq("nurse_user_id", (appRow as any).nurse_user_id);

      const { error: rejectError } = await supabaseAdmin
        .from("applications")
        .update({ status: "rejected" })
        .eq("job_id", (appRow as any).job_id)
        .neq("nurse_user_id", (appRow as any).nurse_user_id);

      if (rejectError) return reply.code(400).send({ error: "Unable to decide application" });

      const { error: jobUpdateError } = await markJobAssigned((appRow as any).job_id, (appRow as any).nurse_user_id);
      if (jobUpdateError) return reply.code(400).send({ error: "Unable to decide application" });

      const { data: jobForNotification } = await supabaseAdmin
        .from("jobs")
        .select("id,title")
        .eq("id", (appRow as any).job_id)
        .maybeSingle();

      const jobTitle = jobForNotification?.title ?? "Job";
      await createNotifications([
        {
          userId: (appRow as any).nurse_user_id,
          type: "job_assigned",
          title: "Job assigned",
          body: `${jobTitle} has been assigned to you.`,
          entityType: "job",
          entityId: (appRow as any).job_id
        },
        ...((rejectedApplications ?? [])
          .filter((row) => row.status !== "rejected")
          .map((row) => ({
            userId: row.nurse_user_id as string,
            type: "application_rejected",
            title: "Application not selected",
            body: `${jobTitle} was assigned to another nurse.`,
            entityType: "job",
            entityId: (appRow as any).job_id
          })))
      ]);
    }

    return reply.send({ application: data });
  });
}
