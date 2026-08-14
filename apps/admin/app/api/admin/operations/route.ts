import { NextRequest } from "next/server";
import { requireAdmin } from "../../../../lib/adminAuth";
import { writeAdminAuditLog } from "../../../../lib/auditLog";
import { adminJson } from "../../../../lib/requestId";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";

const caseTypes = ["intake", "credential", "matching", "support", "incident", "service_recovery", "finance"];
const priorities = ["low", "normal", "high", "urgent"];

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return adminJson(request, { error: auth.error }, { status: auth.status });
  const url = new URL(request.url);
  let query = supabaseAdmin.from("operations_cases").select("*").order("last_activity_at", { ascending: false }).limit(250);
  const type = url.searchParams.get("type");
  const status = url.searchParams.get("status");
  const owner = url.searchParams.get("owner");
  if (type && caseTypes.includes(type)) query = query.eq("case_type", type);
  if (status) query = query.eq("status", status);
  if (owner === "me") query = query.eq("owner_user_id", auth.user.id);
  if (owner === "unclaimed") query = query.is("owner_user_id", null);
  const { data, error } = await query;
  if (error) return adminJson(request, { error: "Unable to load operations queue" }, { status: 400 });
  return adminJson(request, { cases: data ?? [], current_admin_id: auth.user.id });
}
export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return adminJson(request, { error: auth.error }, { status: auth.status });
  const body = await request.json() as Record<string, unknown>;
  const caseType = String(body.case_type ?? "");
  const title = String(body.title ?? "").trim();
  const priority = String(body.priority ?? "normal");
  if (!caseTypes.includes(caseType) || !priorities.includes(priority) || title.length < 3 || title.length > 180) {
    return adminJson(request, { error: "Invalid operations case" }, { status: 400 });
  }
  const { data, error } = await supabaseAdmin.from("operations_cases").insert({
    case_type: caseType,
    subject_type: String(body.subject_type ?? "general").slice(0, 80),
    subject_id: body.subject_id || null,
    title,
    description: String(body.description ?? "").trim().slice(0, 4000) || null,
    priority,
    owner_user_id: body.claim ? auth.user.id : null,
    reported_by_user_id: auth.user.id,
    due_at: body.due_at || null
  }).select("*").single();
  if (error) return adminJson(request, { error: "Unable to create operations case" }, { status: 400 });
  await writeAdminAuditLog({ actor_id: auth.user.id, action: "operations_case_created", entity_type: "operations_case", entity_id: data.id, metadata: { case_type: caseType, priority } });
  return adminJson(request, { case: data }, { status: 201 });
}
