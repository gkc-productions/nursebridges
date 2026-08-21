import { NextRequest } from "next/server";
import { requireAdmin } from "../../../../../lib/adminAuth";
import { writeAdminAuditLog } from "../../../../../lib/auditLog";
import { adminJson } from "../../../../../lib/requestId";
import { supabaseAdmin } from "../../../../../lib/supabaseAdmin";

const transitions: Record<string, string[]> = {
  draft: ["pending_review", "cancelled"],
  pending_review: ["active", "cancelled"],
  active: ["paused", "completed", "cancelled"],
  paused: ["active", "completed", "cancelled"],
  completed: [],
  cancelled: []
};

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return adminJson(request, { error: auth.error }, { status: auth.status });
  const { id } = await params;
  const body = await request.json().catch(() => null) as { status?: string } | null;
  const nextStatus = body?.status ?? "";

  const [{ count: configuredCount }, { data: currentMember }, { data: plan }] = await Promise.all([
    supabaseAdmin.from("admin_team_members").select("admin_user_id", { count: "exact", head: true }).eq("active", true),
    supabaseAdmin.from("admin_team_members").select("operations_role,active").eq("admin_user_id", auth.user.id).maybeSingle(),
    supabaseAdmin.from("recurring_care_plans").select("*").eq("id", id).maybeSingle()
  ]);
  if ((configuredCount ?? 0) > 0 && (!currentMember?.active || !["operator", "supervisor"].includes(currentMember.operations_role))) {
    return adminJson(request, { error: "Active operator or supervisor role required" }, { status: 403 });
  }
  if (!plan) return adminJson(request, { error: "Recurring care plan not found" }, { status: 404 });
  if (!transitions[plan.status]?.includes(nextStatus)) {
    return adminJson(request, { error: `Cannot change a ${plan.status} plan to ${nextStatus}` }, { status: 409 });
  }

  const { data: updated, error } = await supabaseAdmin.from("recurring_care_plans")
    .update({ status: nextStatus, updated_at: new Date().toISOString() })
    .eq("id", id).eq("status", plan.status).select("*").maybeSingle();
  if (error) return adminJson(request, { error: "Unable to update recurring care plan" }, { status: 400 });
  if (!updated) return adminJson(request, { error: "The plan changed in another session. Refresh and retry." }, { status: 409 });

  const caseStatus = nextStatus === "active" || ["completed", "cancelled"].includes(nextStatus) ? "resolved" : nextStatus === "paused" ? "waiting" : "in_progress";
  await supabaseAdmin.from("operations_cases").update({
    status: caseStatus,
    resolution_summary: nextStatus === "active" ? "Recurring care pattern approved. Each occurrence still requires individual scope, availability, assignment, and pricing review." : ["completed", "cancelled"].includes(nextStatus) ? `Recurring care plan ${nextStatus}.` : null,
    resolved_at: caseStatus === "resolved" ? new Date().toISOString() : null,
    last_activity_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }).eq("subject_type", "recurring_care_plan").eq("subject_id", id).not("status", "in", "(resolved,closed)");

  await writeAdminAuditLog({ actor_id: auth.user.id, action: "recurring_care_status_changed", entity_type: "recurring_care_plan", entity_id: id, metadata: { from_status: plan.status, to_status: nextStatus } });
  return adminJson(request, { plan: updated });
}
