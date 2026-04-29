import type { FastifyInstance } from "fastify";
import { writeAdminAuditLog } from "../audit.js";
import { requireAuth, requireRole } from "../auth.js";
import { createNotifications } from "../notifications.js";
import { supabaseAdmin, supabaseForUser } from "../supabase.js";
import { verifyNurseSchema } from "../validators.js";

async function isApprovedNurse(nurseUserId: string) {
  if (!supabaseAdmin) return false;

  const { data } = await supabaseAdmin
    .from("nurse_profiles")
    .select("verification_status")
    .eq("nurse_id", nurseUserId)
    .maybeSingle();

  return data?.verification_status === "approved";
}

function isTerminalJobStatus(status: string) {
  return status === "cancelled" || status === "completed";
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

export async function adminRoutes(app: FastifyInstance) {
  app.get("/admin/nurses/:id/verification-documents", async (req, reply) => {
    const authed = await requireAuth(req);
    requireRole(authed, ["admin"]);

    if (!supabaseAdmin) {
      return reply.code(500).send({ error: "Admin client not configured" });
    }

    const { id } = req.params as any;
    const { data, error } = await supabaseAdmin
      .from("nurse_verification_documents")
      .select("id,nurse_user_id,storage_bucket,storage_path,document_type,status,reviewed_by,reviewed_at,rejection_reason,created_at")
      .eq("nurse_user_id", id)
      .order("created_at", { ascending: false });

    if (error) {
      const code = (error as any).code;
      if (code === "PGRST205" || code === "42P01") return reply.send({ documents: [] });
      return reply.code(400).send({ error: "Unable to load verification documents" });
    }

    return reply.send({ documents: data ?? [] });
  });

  app.post("/admin/nurses/:id/verify", async (req, reply) => {
    const authed = await requireAuth(req);
    requireRole(authed, ["admin"]);

    if (!supabaseAdmin) {
      return reply.code(500).send({ error: "Admin client not configured" });
    }

    const { id } = req.params as any;
    const body = verifyNurseSchema.parse(req.body ?? {});
    const reviewedAt = new Date().toISOString();

    const { data: nurseProfile, error } = await supabaseAdmin
      .from("nurse_profiles")
      .update({
        verification_status: body.decision,
        verified_at: body.decision === "approved" ? reviewedAt : null,
        is_active: body.decision === "approved"
      })
      .eq("nurse_id", id)
      .select("nurse_id,verification_status,verified_at")
      .maybeSingle();

    if (error || !nurseProfile) {
      return reply.code(400).send({ error: "Unable to update nurse verification" });
    }

    await supabaseAdmin
      .from("nurse_verification_documents")
      .update({
        status: body.decision,
        reviewed_by: authed.userId,
        reviewed_at: reviewedAt,
        rejection_reason: body.decision === "rejected" ? body.rejection_reason ?? null : null
      })
      .eq("nurse_user_id", id)
      .eq("status", "pending");

    await createNotifications([
      {
        userId: id,
        type: body.decision === "approved" ? "nurse_verification_approved" : "nurse_verification_rejected",
        title: body.decision === "approved" ? "Verification approved" : "Verification rejected",
        body:
          body.decision === "approved"
            ? "Your nurse verification has been approved."
            : body.rejection_reason
              ? `Your nurse verification was rejected: ${body.rejection_reason}`
              : "Your nurse verification was rejected.",
        entityType: "nurse_profile",
        entityId: id
      }
    ]);

    await writeAdminAuditLog({
      actor_id: authed.userId,
      action: "nurse_verification",
      entity_type: "nurse_profile",
      entity_id: id,
      metadata: { status: body.decision }
    });

    return reply.send({ nurse_profile: nurseProfile });
  });

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
      .select("id,status,title")
      .eq("id", body.jobId)
      .single();

    if (jobError || !job) {
      return reply.code(404).send({ error: "Job not found" });
    }
    if (isTerminalJobStatus(job.status)) {
      return reply.code(400).send({ error: "Invalid job transition" });
    }
    if (!(await isApprovedNurse(body.nurseUserId))) {
      return reply.code(403).send({ error: "Nurse verification required" });
    }

    const { data: applications, error: applicationsError } = await supabaseAdmin
      .from("applications")
      .select("id,status,nurse_user_id")
      .eq("job_id", body.jobId);

    if (applicationsError) {
      return reply.code(400).send({ error: "Unable to assign job" });
    }

    const application = (applications ?? []).find((row) => row.nurse_user_id === body.nurseUserId);

    if (!application) {
      return reply.code(400).send({ error: "Nurse has not applied to this job" });
    }

    const rejectedNurseIds = (applications ?? [])
      .filter((row) => row.nurse_user_id !== body.nurseUserId && row.status !== "rejected")
      .map((row) => row.nurse_user_id as string)
      .filter(Boolean);

    const { error: applicationError } = await supabaseAdmin
      .from("applications")
      .select("id,status")
      .eq("job_id", body.jobId)
      .eq("nurse_user_id", body.nurseUserId)
      .maybeSingle();

    if (applicationError) {
      return reply.code(400).send({ error: "Unable to assign job" });
    }

    const { error: acceptError } = await supabaseAdmin
      .from("applications")
      .update({ status: "accepted" })
      .eq("job_id", body.jobId)
      .eq("nurse_user_id", body.nurseUserId);

    if (acceptError) {
      return reply.code(400).send({ error: "Unable to assign job" });
    }

    const { error: rejectError } = await supabaseAdmin
      .from("applications")
      .update({ status: "rejected" })
      .eq("job_id", body.jobId)
      .neq("nurse_user_id", body.nurseUserId);

    if (rejectError) {
      return reply.code(400).send({ error: "Unable to assign job" });
    }

    const { error: jobUpdateError } = await markJobAssigned(body.jobId, body.nurseUserId);

    if (jobUpdateError) {
      return reply.code(400).send({ error: "Unable to assign job" });
    }

    const jobTitle = job.title || "Job";
    await createNotifications([
      {
        userId: body.nurseUserId,
        type: "job_assigned",
        title: "Job assigned",
        body: `${jobTitle} has been assigned to you.`,
        entityType: "job",
        entityId: body.jobId
      },
      ...rejectedNurseIds.map((nurseUserId) => ({
        userId: nurseUserId,
        type: "application_rejected",
        title: "Application not selected",
        body: `${jobTitle} was assigned to another nurse.`,
        entityType: "job",
        entityId: body.jobId
      }))
    ]);

    await writeAdminAuditLog({
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
