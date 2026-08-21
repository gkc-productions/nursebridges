import { NextRequest } from "next/server";
import { requireAdmin } from "../../../../lib/adminAuth";
import { adminJson } from "../../../../lib/requestId";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return adminJson(request, { error: auth.error }, { status: auth.status });

  const { data: members, error } = await supabaseAdmin
    .from("admin_team_members")
    .select("admin_user_id,operations_role,active,created_at,updated_at")
    .order("active", { ascending: false })
    .order("operations_role");
  if (error) return adminJson(request, { error: "Unable to load the operations team" }, { status: 400 });

  const { data: profiles, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("id,full_name")
    .eq("role", "admin")
    .order("full_name");
  if (profileError) return adminJson(request, { error: "Unable to load team profiles" }, { status: 400 });

  const byId = new Map((members ?? []).map((member) => [member.admin_user_id, member]));
  const activeSupervisors = (members ?? []).filter((member) => member.active && member.operations_role === "supervisor");
  const currentMember = byId.get(auth.user.id);
  return adminJson(request, {
    current_admin_id: auth.user.id,
    can_manage: activeSupervisors.length === 0 || Boolean(currentMember?.active && currentMember.operations_role === "supervisor"),
    bootstrap_required: activeSupervisors.length === 0,
    members: (profiles ?? []).map((profile) => {
      const member = byId.get(profile.id);
      return {
        admin_user_id: profile.id,
        display_name: profile.full_name ?? "Operations team member",
        operations_role: member?.operations_role ?? "operator",
        active: member?.active ?? false,
        configured: Boolean(member),
        created_at: member?.created_at ?? null,
        updated_at: member?.updated_at ?? null
      };
    })
  });
}
