import type { FastifyInstance } from "fastify";
import { writeAdminAuditLog } from "../audit.js";
import { requireAuth, requireRole } from "../auth.js";
import { isApprovedNurse, markJobAssigned } from "../jobAssignment.js";
import { finalizeAppliedAssignmentWithRpc } from "../jobAssignmentCommand.js";
import { createNotifications } from "../notifications.js";
import { supabaseAdmin, supabaseForUser } from "../supabase.js";
import { verifyNurseSchema } from "../validators.js";
import { registerAdminAssignmentRoute } from "./adminAssignmentRoute.js";

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

  await registerAdminAssignmentRoute(app, {
    requireAuth,
    requireRole,
    supabaseAdmin,
    supabaseForUser,
    isApprovedNurse,
    markJobAssigned,
    createNotifications,
    writeAdminAuditLog,
    finalizeAssignment: finalizeAppliedAssignmentWithRpc
  });
}
