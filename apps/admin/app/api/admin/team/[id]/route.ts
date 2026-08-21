import { NextRequest } from "next/server";
import { requireAdmin } from "../../../../../lib/adminAuth";
import { writeAdminAuditLog } from "../../../../../lib/auditLog";
import { adminJson } from "../../../../../lib/requestId";
import { supabaseAdmin } from "../../../../../lib/supabaseAdmin";

const roles = ["operator", "supervisor", "credential_reviewer", "support", "finance"] as const;

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return adminJson(request, { error: auth.error }, { status: auth.status });
  const { id } = await params;
  const body = await request.json().catch(() => null) as { operations_role?: string; active?: boolean } | null;
  if (!body || !roles.includes(body.operations_role as typeof roles[number]) || typeof body.active !== "boolean") {
    return adminJson(request, { error: "Choose a valid operations role and status" }, { status: 400 });
  }

  const { data: before } = await supabaseAdmin
    .from("admin_team_members")
    .select("admin_user_id,operations_role,active")
    .eq("admin_user_id", id)
    .maybeSingle();

  const { data, error } = await supabaseAdmin.rpc("manage_admin_team_member", {
    p_actor_id: auth.user.id,
    p_target_id: id,
    p_operations_role: body.operations_role,
    p_active: body.active
  });
  if (error) {
    const status = error.code === "42501" ? 403 : error.code === "23514" ? 409 : 400;
    return adminJson(request, { error: error.message || "Unable to update the team member" }, { status });
  }

  await writeAdminAuditLog({
    actor_id: auth.user.id,
    action: before ? "admin_team_member_updated" : "admin_team_member_configured",
    entity_type: "admin_team_member",
    entity_id: id,
    metadata: {
      previous_role: before?.operations_role ?? null,
      previous_active: before?.active ?? null,
      operations_role: body.operations_role,
      active: body.active
    }
  });

  return adminJson(request, { member: data });
}
