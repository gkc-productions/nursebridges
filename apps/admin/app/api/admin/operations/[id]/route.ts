import { NextRequest } from "next/server";
import { requireAdmin } from "../../../../../lib/adminAuth";
import { writeAdminAuditLog } from "../../../../../lib/auditLog";
import { adminJson } from "../../../../../lib/requestId";
import { supabaseAdmin } from "../../../../../lib/supabaseAdmin";

const statuses = ["open", "triaged", "in_progress", "waiting", "resolved", "closed"];
const priorities = ["low", "normal", "high", "urgent"];

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return adminJson(request, { error: auth.error }, { status: auth.status });
  const { id } = await context.params;
  const [caseResult, notesResult, presenceResult] = await Promise.all([
    supabaseAdmin.from("operations_cases").select("*").eq("id", id).maybeSingle(),
    supabaseAdmin.from("operations_case_notes").select("id,author_user_id,body,visibility,created_at").eq("case_id", id).order("created_at"),
    supabaseAdmin.from("operations_case_presence").select("admin_user_id,mode,expires_at").eq("case_id", id).gt("expires_at", new Date().toISOString())
  ]);
  if (!caseResult.data) return adminJson(request, { error: "Operations case not found" }, { status: 404 });
  return adminJson(request, { case: caseResult.data, notes: notesResult.data ?? [], presence: presenceResult.data ?? [], current_admin_id: auth.user.id });
}
export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return adminJson(request, { error: auth.error }, { status: auth.status });
  const { id } = await context.params;
  const body = await request.json() as Record<string, unknown>;
  const expectedVersion = Number(body.expected_version);
  const status = String(body.status ?? "");
  const priority = String(body.priority ?? "");
  if (!Number.isInteger(expectedVersion) || !statuses.includes(status) || !priorities.includes(priority)) {
    return adminJson(request, { error: "Invalid case update" }, { status: 400 });
  }
  const update = {
    owner_user_id: body.owner_user_id === "me" ? auth.user.id : body.owner_user_id || null,
    status,
    priority,
    due_at: body.due_at || null,
    handoff_note: String(body.handoff_note ?? "").trim().slice(0, 2000) || null,
    resolution_summary: String(body.resolution_summary ?? "").trim().slice(0, 4000) || null,
    resolved_at: ["resolved", "closed"].includes(status) ? new Date().toISOString() : null,
    version: expectedVersion + 1,
    last_activity_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
  const { data, error } = await supabaseAdmin.from("operations_cases").update(update)
    .eq("id", id).eq("version", expectedVersion).select("*").maybeSingle();
  if (error) return adminJson(request, { error: "Unable to update operations case" }, { status: 400 });
  if (!data) return adminJson(request, { error: "This case changed in another session. Refresh before saving." }, { status: 409 });
  await writeAdminAuditLog({ actor_id: auth.user.id, action: "operations_case_updated", entity_type: "operations_case", entity_id: id, metadata: { from_version: expectedVersion, to_version: expectedVersion + 1, status, priority } });
  return adminJson(request, { case: data });
}
