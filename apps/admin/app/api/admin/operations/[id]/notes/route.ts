import { NextRequest } from "next/server";
import { requireAdmin } from "../../../../../../lib/adminAuth";
import { writeAdminAuditLog } from "../../../../../../lib/auditLog";
import { adminJson } from "../../../../../../lib/requestId";
import { supabaseAdmin } from "../../../../../../lib/supabaseAdmin";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return adminJson(request, { error: auth.error }, { status: auth.status });
  const { id } = await context.params;
  const body = await request.json() as { body?: string; visibility?: string };
  const note = body.body?.trim() ?? "";
  const visibility = body.visibility === "reporter" ? "reporter" : "internal";
  if (!note || note.length > 4000) return adminJson(request, { error: "Note must be between 1 and 4000 characters" }, { status: 400 });
  const { data, error } = await supabaseAdmin.from("operations_case_notes").insert({ case_id: id, author_user_id: auth.user.id, body: note, visibility }).select("id,author_user_id,body,visibility,created_at").single();
  if (error) return adminJson(request, { error: "Unable to add case note" }, { status: 400 });
  await supabaseAdmin.from("operations_cases").update({ last_activity_at: new Date().toISOString() }).eq("id", id);
  await writeAdminAuditLog({ actor_id: auth.user.id, action: "operations_case_note_added", entity_type: "operations_case", entity_id: id, metadata: { visibility } });
  return adminJson(request, { note: data }, { status: 201 });
}
