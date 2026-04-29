import { NextRequest } from "next/server";
import { adminJson } from "../../../../../lib/requestId";
import { writeAdminAuditLog } from "../../../../../lib/auditLog";
import { requireAdmin } from "../../../../../lib/adminAuth";
import { createNotification } from "../../../../../lib/notifications";
import { supabaseAdmin } from "../../../../../lib/supabaseAdmin";

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) {
    return adminJson(request, { error: auth.error }, { status: auth.status });
  }

  const body = (await request.json()) as {
    nurse_id: string;
    status?: "approved" | "rejected";
    decision?: "approved" | "rejected";
    rejection_reason?: string;
  };
  const status = body.decision ?? body.status;
  if (status !== "approved" && status !== "rejected") {
    return adminJson(request, { error: "Invalid verification decision" }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from("nurse_profiles")
    .update({
      verification_status: status,
      verified_at: status === "approved" ? new Date().toISOString() : null,
      is_active: status === "approved"
    })
    .eq("nurse_id", body.nurse_id);

  if (error) {
    return adminJson(request, { error: "Unable to update nurse verification" }, { status: 400 });
  }

  await supabaseAdmin
    .from("nurse_verification_documents")
    .update({
      status,
      reviewed_by: auth.user.id,
      reviewed_at: new Date().toISOString(),
      rejection_reason: status === "rejected" ? body.rejection_reason ?? null : null
    })
    .eq("nurse_user_id", body.nurse_id)
    .eq("status", "pending");

  await createNotification({
    userId: body.nurse_id,
    type: status === "approved" ? "nurse_verification_approved" : "nurse_verification_rejected",
    title: status === "approved" ? "Verification approved" : "Verification rejected",
    body:
      status === "approved"
        ? "Your nurse verification has been approved."
        : body.rejection_reason
          ? `Your nurse verification was rejected: ${body.rejection_reason}`
          : "Your nurse verification was rejected.",
    entityType: "nurse_profile",
    entityId: body.nurse_id
  });

  await writeAdminAuditLog({
    actor_id: auth.user.id,
    action: "nurse_verification",
    entity_type: "nurse_profile",
    entity_id: body.nurse_id,
    metadata: { status }
  });

  return adminJson(request, { ok: true });
}
